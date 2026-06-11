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
    // One-time import of orders logged by the old webhook (list 'inkvial:orders')
    if (q.migrate === '1') {
      const old = await redis.cmd(['LRANGE', 'inkvial:orders', '0', '999']);
      let imported = 0;
      for (const s of old || []) {
        try {
          const o = JSON.parse(s);
          const key = o.session || ('legacy-' + (o.at || Math.random()));
          const exists = await redis.cmd(['HEXISTS', 'inkvial:orderbook', key]);
          if (!exists || exists === 0) {
            o.shipped = false; o.shippedAt = null; o.tracking = o.tracking || '';
            o.items = (o.items || []).map(x => String(x).replace('×', 'x'));
            await redis.cmd(['HSET', 'inkvial:orderbook', key, JSON.stringify(o)]);
            imported++;
          }
        } catch (e) {}
      }
      return res.status(200).json({ ok: true, imported });
    }

    // Remove a single order from the book (e.g. a test purchase)
    if (q.remove) {
      const n = await redis.cmd(['HDEL', 'inkvial:orderbook', q.remove]);
      return res.status(200).json({ ok: true, removed: n });
    }
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
