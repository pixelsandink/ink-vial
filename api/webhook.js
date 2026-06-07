// Stripe webhook - fires after a successful payment. It:
//   1. emails you a "New order" notification (via Resend)
//   2. logs the order to Redis (viewable at /api/orders)
//   3. subtracts the purchased quantities from live stock
// Fully automatic; no manual upkeep.
//
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY (for email)
// Optional: CONTACT_TO (default hello@inkvial.co.uk), CONTACT_FROM
// (Redis/Upstash vars are injected automatically when you connect the store.)

const Stripe = require('stripe');
const redis = require('./_redis');
let catalog = {};
try { catalog = require('../catalog.json'); } catch (e) {}

const TO   = process.env.CONTACT_TO   || 'hello@inkvial.co.uk';
const FROM = process.env.CONTACT_FROM || 'Ink Vial <onboarding@resend.dev>';

// Stripe needs the RAW request body to verify the signature
module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fmtAddress(d) {
  if (!d || !d.address) return '';
  const a = d.address;
  return [d.name, a.line1, a.line2, a.city, a.postal_code, a.country]
    .filter(Boolean).join(', ');
}

async function notifyOrder(session, items) {
  const lines = items.map(it => {
    const c = catalog[it.id] || {};
    const label = (c.brand ? c.brand + ' ' : '') + (c.name || it.id);
    return { label, qty: it.qty || 1 };
  });
  const totalVials = lines.reduce((n, l) => n + l.qty, 0);
  const amount = session.amount_total != null ? '£' + (session.amount_total / 100).toFixed(2) : '';
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || '';
  const ship = fmtAddress(session.shipping_details ||
    (session.collected_information && session.collected_information.shipping_details) ||
    session.customer_details);

  // Log to Redis (best-effort)
  try {
    if (redis.isConfigured()) {
      const rec = JSON.stringify({
        at: new Date().toISOString(),
        amount, email, ship,
        items: lines.map(l => `${l.qty}× ${l.label}`),
        session: session.id
      });
      await redis.cmd(['LPUSH', 'inkvial:orders', rec]);
      await redis.cmd(['LTRIM', 'inkvial:orders', '0', '4999']);
    }
  } catch (e) { console.error('order log error', e); }

  // Email via Resend (best-effort)
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const itemsHtml = lines.map(l =>
    `<li style="margin:0 0 4px;">${l.qty}× ${esc(l.label)}</li>`).join('');
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#3d2458;">
       <h2 style="color:#5c3a9a;margin:0 0 6px;">New order - ${esc(amount)}</h2>
       <p style="margin:0 0 12px;color:#666;">${totalVials} vial${totalVials !== 1 ? 's' : ''}</p>
       <ul style="margin:0 0 16px;padding-left:18px;">${itemsHtml}</ul>
       <p style="margin:0 0 4px;"><strong>Ship to:</strong><br>${esc(ship) || '(no address)'}</p>
       <p style="margin:0 0 16px;"><strong>Email:</strong> ${esc(email) || '(none)'}</p>
       <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
       <p style="font-size:12px;color:#999;">Full details in your Stripe dashboard.</p>
     </div>`;
  const text =
    `New order - ${amount} (${totalVials} vials)\n\n` +
    lines.map(l => `${l.qty}x ${l.label}`).join('\n') +
    `\n\nShip to: ${ship || '(no address)'}\nEmail: ${email || '(none)'}`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject: `New order - Ink Vial (${amount})`, html, text, reply_to: email || undefined })
    });
  } catch (e) { console.error('order email error', e); }
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

    // 1) + 2) notify + log (don't let it block stock)
    try { await notifyOrder(session, items); } catch (e) { console.error('notify error', e); }

    // 3) decrement stock
    if (items.length && redis.isConfigured()) {
      try {
        for (const it of items) {
          await redis.hincrby('inkvial:stock', it.id, -Math.abs(it.qty || 1));
        }
        await redis.del('order:' + token);   // one-time use
      } catch (e) {
        console.error('Stock decrement error:', e);
      }
    }
  }

  return res.status(200).json({ received: true });
};
