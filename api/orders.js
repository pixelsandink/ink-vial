// Private orders list (saved by the Stripe webhook). Protected by ADMIN_KEY.
//   /api/orders?key=YOUR_ADMIN_KEY   -> all orders, newest first (JSON)

const redis = require('./_redis');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (!process.env.ADMIN_KEY || q.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (!redis.isConfigured()) return res.status(500).json({ error: 'Database not connected.' });
  try {
    const flat = await redis.cmd(['HGETALL', 'inkvial:orderbook']);
    const orders = [];
    if (Array.isArray(flat)) {
      for (let i = 1; i < flat.length; i += 2) {
        try { orders.push(JSON.parse(flat[i])); } catch (e) {}
      }
    } else if (flat && typeof flat === 'object') {
      for (const k of Object.keys(flat)) { try { orders.push(JSON.parse(flat[k])); } catch (e) {} }
    }
    orders.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return res.status(200).json({ count: orders.length, orders });
  } catch (err) {
    return res.status(500).json({ error: 'Error: ' + err.message });
  }
};
