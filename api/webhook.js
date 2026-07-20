// Stripe webhook - fires after a successful payment. It:
//   1. emails YOU a "New order" notification (via Resend)
//   2. emails the CUSTOMER an order confirmation (via Resend)
//   3. saves the order to Redis (hash 'inkvial:orderbook', keyed by session id)
//   4. subtracts the purchased quantities from live stock
// Fully automatic; no manual upkeep.
//
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY (for email)
// Optional: CONTACT_TO (default hello@inkvial.co.uk), CONTACT_FROM

const Stripe = require('stripe');
const redis = require('./_redis');
const { sendEmail, orderConfirmationEmail, newOrderAdminEmail } = require('./_email');
let catalog = {};
try { catalog = require('../catalog.json'); } catch (e) {}

const TO = process.env.CONTACT_TO || 'hello@inkvial.co.uk';

module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function fmtAddress(d) {
  if (!d || !d.address) return '';
  const a = d.address;
  return [d.name, a.line1, a.line2, a.city, a.postal_code, a.country]
    .filter(Boolean).join(', ');
}

async function handleOrder(session, items) {
  const lines = items.map(it => {
    const c = catalog[it.id] || {};
    return { label: (c.brand ? c.brand + ' ' : '') + (c.name || it.id), qty: it.qty || 1 };
  });
  const totalVials = lines.reduce((n, l) => n + l.qty, 0);
  const amount = session.amount_total != null ? '£' + (session.amount_total / 100).toFixed(2) : '';
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || '';
  const name = (session.customer_details && session.customer_details.name) || '';
  const ship = fmtAddress(session.shipping_details ||
    (session.collected_information && session.collected_information.shipping_details) ||
    session.customer_details);

  const record = {
    at: new Date().toISOString(),
    session: session.id,
    amount, email, name, ship,
    items: lines.map(l => `${l.qty} x ${l.label}`),
    shipped: false, shippedAt: null, tracking: ''
  };

  // Save to the order book (best-effort)
  try {
    if (redis.isConfigured()) {
      await redis.cmd(['HSET', 'inkvial:orderbook', session.id, JSON.stringify(record)]);
    }
  } catch (e) { console.error('order save error', e); }

  // Email YOU (the admin)
  try {
    const a = newOrderAdminEmail({ amount, totalVials, lines, ship, email, name });
    await sendEmail({ to: TO, subject: a.subject, html: a.html, text: a.text, replyTo: email });
  } catch (e) { console.error('admin email error', e); }

  // Email the CUSTOMER an order confirmation
  if (email) {
    try {
      const c = orderConfirmationEmail({ name, amount, lines, ship });
      await sendEmail({ to: email, subject: c.subject, html: c.html, text: c.text, replyTo: TO });
    } catch (e) { console.error('customer confirmation error', e); }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const raw = await readRaw(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const token = session.metadata && session.metadata.order_token;
    let items = [];
    if (token && redis.isConfigured()) {
      try {
        const raw = await redis.get('order:' + token);
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) items = parsed;
      } catch (e) { console.error('order read error', e); }
    }

    try { await handleOrder(session, items); } catch (e) { console.error('handleOrder error', e); }

    // decrement stock
    if (items.length && redis.isConfigured()) {
      try {
        for (const it of items) {
          const qty = Math.abs(it.qty || 1);
          const entry = catalog[it.id];
          // Packs have no stock counter of their own - selling one draws down
          // each of the individual inks it contains, same as if bought as singles.
          if (entry && entry.components && entry.components.length) {
            for (const cid of entry.components) {
              await redis.hincrby('inkvial:stock', cid, -qty);
            }
          } else {
            await redis.hincrby('inkvial:stock', it.id, -qty);
          }
        }
        await redis.del('order:' + token);
      } catch (e) { console.error('Stock decrement error:', e); }
    }
  }

  return res.status(200).json({ received: true });
};
