// Ink Vial - Stripe Checkout session creator (Vercel serverless function)
// Prices are looked up server-side from catalog.json so they cannot be tampered with.
// Requires env var STRIPE_SECRET_KEY (set in the Vercel dashboard).

const Stripe = require('stripe');
const catalog = require('../catalog.json');
const seed = require('../stock-seed.json');
const redis = require('./_redis');

// Royal Mail Tracked 48: £2.90 for up to 20 vials, £3.50 above that.
// A pack counts as the vials inside it; accessories don't count.
const SHIPPING_PENCE = 290;
const SHIPPING_LARGE_PENCE = 350;
const SMALL_ORDER_VIALS = 20;
const FREE_SHIP_OVER = 40;      // free over £40 subtotal

// crypto for a short order token (used to hand the order to the webhook)
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe is not configured yet.' });
  const stripe = new Stripe(key);

  try {
    let { items, code } = req.body || {};
    if (typeof req.body === 'string') { ({ items, code } = JSON.parse(req.body) || {}); }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Your basket is empty.' });
    }

    // ── Live stock check (block overselling) ──────────────
    let stock = null;
    if (redis.isConfigured()) {
      try {
        stock = await redis.hgetall('inkvial:stock');
        if (!stock || !Object.keys(stock).length) stock = { ...seed };
      } catch (e) { stock = null; }
    }
    const getStock = id => {
      if (stock && stock[id] !== undefined) return parseInt(stock[id]);
      return seed[id] !== undefined ? seed[id] : 99;   // fallback if KV down
    };

    const line_items = [];
    const orderItems = [];          // {id, qty} handed to the webhook to decrement
    const unavailable = [];
    let subtotalPence = 0;
    let vials = 0;

    for (const it of items) {
      const entry = catalog[it.id];
      if (!entry) continue;                                   // ignore unknown ids
      const qty = Math.max(1, Math.min(20, parseInt(it.qty) || 1));
      // Packs (entry.components present) draw from the shared stock of the inks
      // inside them rather than having their own counter - so availability is
      // whichever component ink is scarcest.
      const have = (entry.components && entry.components.length)
        ? Math.min(...entry.components.map(getStock))
        : getStock(it.id);
      if (have < qty) { unavailable.push(`${entry.brand} ${entry.name}`); continue; }
      const unit = Math.round(entry.price * 100);
      subtotalPence += unit * qty;
      if (entry.type !== 'accessory') vials += qty * (entry.components ? entry.components.length : 1);
      orderItems.push({ id: it.id, qty });
      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'gbp',
          unit_amount: unit,
          product_data: { name: `${entry.brand} ${entry.name}` + (entry.type === 'accessory' ? '' : ' - 2ml sample') }
        }
      });
    }

    if (unavailable.length) {
      return res.status(409).json({ error: 'Some inks just sold out: ' + unavailable.join(', ') + '. Please adjust your basket.', unavailable });
    }
    if (!line_items.length) return res.status(400).json({ error: 'No valid items in basket.' });

    // Stripe Checkout allows at most 100 line items per session. For very large
    // baskets, consolidate into one priced line so checkout still works - the full
    // itemised order is preserved in the order token for stock decrement and the
    // order email, so nothing is lost.
    let checkoutLineItems = line_items;
    if (line_items.length > 100) {
      const totalQty = orderItems.reduce((n, o) => n + o.qty, 0);
      checkoutLineItems = [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: subtotalPence,
          product_data: { name: `Ink Vial order - ${totalQty} items (${line_items.length} products)` }
        }
      }];
    }

    // Stash the order so the webhook can decrement stock after payment
    const token = crypto.randomUUID();
    if (redis.isConfigured()) {
      try { await redis.set('order:' + token, JSON.stringify(orderItems), 172800); } catch (e) {}
    }

    // Gift certificate / promo code typed into the basket. Stripe stays the source
    // of truth (validity, expiry, one-time use); a code whose promotion code or
    // coupon has metadata free_shipping=true also zeroes the postage.
    let promo = null;
    code = (code || '').toString().trim().slice(0, 50);
    if (code) {
      const found = await stripe.promotionCodes.list({ code, active: true, limit: 1, expand: ['data.coupon'] });
      promo = found.data[0];
      const used = promo && promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions;
      if (!promo || used || !promo.coupon.valid) {
        return res.status(400).json({ error: 'Sorry, that code isn\'t valid or has already been used.' });
      }
    }
    const isTrue = v => String(v || '').toLowerCase() === 'true';
    const giftShip = !!promo && (isTrue(promo.metadata.free_shipping) || isTrue(promo.coupon.metadata.free_shipping));

    const freeShip = giftShip || subtotalPence >= FREE_SHIP_OVER * 100;
    const shipPence = freeShip ? 0
      : (vials <= SMALL_ORDER_VIALS ? SHIPPING_PENCE : SHIPPING_LARGE_PENCE);

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: checkoutLineItems,
      // Stripe won't take both: a code from the basket is applied up front,
      // otherwise customers can still type one on the Stripe page.
      ...(promo ? { discounts: [{ promotion_code: promo.id }] } : { allow_promotion_codes: true }),
      phone_number_collection: { enabled: false },
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: shipPence, currency: 'gbp' },
          display_name: freeShip ? 'Free UK delivery - Royal Mail Tracked 48' : 'Royal Mail Tracked 48',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 3 }
          }
        }
      }],
      metadata: { order_token: token },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
