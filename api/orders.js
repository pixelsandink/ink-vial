// Private order list (logged by the Stripe webhook). Protected by ADMIN_KEY.
//   /api/orders?key=YOUR_ADMIN_KEY        -> latest 100 (JSON)
//   /api/orders?key=YOUR_ADMIN_KEY&n=500  -> latest 500

const redis = require('./_redis');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (!process.env.ADMIN_KEY || q.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (!redis.isConfigured()) {
    return res.status(500).json({ error: 'Database not connected.' });
  }
  try {
    const n = Math.max(1, Math.min(5000, parseInt(q.n) || 100));
    const raw = await redis.cmd(['LRANGE', 'inkvial:orders', '0', String(n - 1)]);
    const items = (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return { raw: s }; } });
    return res.status(200).json({ count: items.length, orders: items });
  } catch (err) {
    return res.status(500).json({ error: 'Error: ' + err.message });
  }
};
