// Stripe webhook - fires after a successful payment and subtracts the
// purchased quantities from live stock. Fully automatic; no manual upkeep.
//
// Env vars needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// (Redis/Upstash vars are injected automatically when you connect the store.)

const Stripe = require('stripe');
const redis = require('./_redis');

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
    if (token && redis.isConfigured()) {
      try {
        const raw = await redis.get('order:' + token);
        const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(items)) {
          for (const it of items) {
            // atomic decrement - never lets two orders double-spend the same vial
            await redis.hincrby('inkvial:stock', it.id, -Math.abs(it.qty || 1));
          }
        }
        await redis.del('order:' + token);   // one-time use
      } catch (e) {
        console.error('Stock decrement error:', e);
      }
    }
  }

  return res.status(200).json({ received: true });
};
