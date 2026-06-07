// Private stock admin - seed, view and restock without editing files.
// Protected by the ADMIN_KEY env var. Use from your browser or a bookmark.
//
//   Seed everything from defaults (run once after creating the store):
//     /api/admin-stock?key=YOUR_KEY&action=seed
//   See all current counts:
//     /api/admin-stock?key=YOUR_KEY&action=list
//   Restock one ink to an exact number (e.g. fresh 50ml bottle = 20 vials):
//     /api/admin-stock?key=YOUR_KEY&action=set&id=diamine-lady-grey&count=20
//   Add to an ink (e.g. opened another bottle):
//     /api/admin-stock?key=YOUR_KEY&action=add&id=diamine-lady-grey&count=20

const redis = require('./_redis');
const seed = require('../stock-seed.json');

const LOW_AT = 4;
const statusOf = n => (n <= 0 ? 'out' : (n <= LOW_AT ? 'low' : 'in'));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (!process.env.ADMIN_KEY || q.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (!redis.isConfigured()) {
    return res.status(500).json({ error: 'Stock database not connected yet (create & connect the Upstash/KV store in Vercel).' });
  }

  try {
    const action = q.action || 'list';

    if (action === 'seed') {
      await redis.del('inkvial:stock');
      await redis.hset('inkvial:stock', seed);
      return res.status(200).json({ ok: true, seeded: Object.keys(seed).length });
    }

    if (action === 'set' || action === 'add') {
      const id = q.id;
      const count = parseInt(q.count);
      if (!id || !seed.hasOwnProperty(id)) return res.status(400).json({ error: 'Unknown ink id: ' + id });
      if (!Number.isFinite(count)) return res.status(400).json({ error: 'count must be a number' });
      let newVal;
      if (action === 'add') newVal = await redis.hincrby('inkvial:stock', id, count);
      else { await redis.hset('inkvial:stock', { [id]: count }); newVal = count; }
      return res.status(200).json({ ok: true, id, stock: newVal, status: statusOf(newVal) });
    }

    // action === 'list' (default)
    let counts = await redis.hgetall('inkvial:stock');
    if (!counts || !Object.keys(counts).length) counts = seed;
    const rows = Object.keys(seed).map(id => {
      const n = parseInt(counts[id] !== undefined ? counts[id] : seed[id]);
      return { id, stock: n, status: statusOf(n) };
    });
    const summary = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
    rows.sort((a, b) => a.stock - b.stock);   // low/out first
    return res.status(200).json({ summary, lowAndOut: rows.filter(r => r.status !== 'in'), all: rows });
  } catch (err) {
    console.error('admin-stock error:', err);
    return res.status(500).json({ error: 'Stock database error: ' + err.message });
  }
};
