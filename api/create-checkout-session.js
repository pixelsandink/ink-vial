// Ink Vial - Stripe Checkout session creator (Vercel serverless function)
// Prices are looked up server-side from catalog.json so they cannot be tampered with.
// Requires env var STRIPE_SECRET_KEY (set in the Vercel dashboard).

const Stripe = require('stripe');
const catalog = require('../catalog.json');
const seed = require('../stock-seed.json');
const redis = require('./_redis');

const SHIPPING_PENCE = 350;     // £3.50 flat UK shipping
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
    let { items } = req.body || {};
    if (typeof req.body === 'string') { items = (JSON.parse(req.body) || {}).items; }
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

    for (const it of items) {
      const entry = catalog[it.id];
      if (!entry) continue;                                   // ignore unknown ids
      const qty = Math.max(1, Math.min(20, parseInt(it.qty) || 1));
      const have = getStock(it.id);
      if (have < qty) { unavailable.push(`${entry.brand} ${entry.name}`); continue; }
      const unit = Math.round(entry.price * 100);
      subtotalPence += unit * qty;
      orderItems.push({ id: it.id, qty });
      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'gbp',
          unit_amount: unit,
          product_data: { name: `${entry.brand} ${entry.name} - 2ml sample` }
        }
      });
    }

    if (unavailable.length) {
      return res.status(409).json({ error: 'Some inks just sold out: ' + unavailable.join(', ') + '. Please adjust your basket.', unavailable });
    }
    if (!line_items.length) return res.status(400).json({ error: 'No valid items in basket.' });

    // Stash the order so the webhook can decrement stock after payment
    const token = crypto.randomUUID();
    if (redis.isConfigured()) {
      try { await redis.set('order:' + token, JSON.stringify(orderItems), 172800); } catch (e) {}
    }

    const freeShip = subtotalPence >= FREE_SHIP_OVER * 100;
    const shipPence = freeShip ? 0 : SHIPPING_PENCE;

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      allow_promotion_codes: true,
      phone_number_collection: { enabled: false },
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: shipPence, currency: 'gbp' },
          display_name: freeShip ? 'Free UK delivery' : 'Royal Mail Tracked',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 1 },
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
