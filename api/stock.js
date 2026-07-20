// GET /api/stock - returns live stock STATUS for every ink (never the raw count).
// Reads the single hash "inkvial:stock". Falls back to seed if Redis is empty/unset.

const redis = require('./_redis');
const seed = require('../stock-seed.json');
let catalog = {};
try { catalog = require('../catalog.json'); } catch (e) {}

const LOW_AT = 4;
function statusOf(n) {
  const s = parseInt(n);
  if (!Number.isFinite(s) || s <= 0) return 'out';
  if (s <= LOW_AT) return 'low';
  return 'in';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    let counts = {};
    if (redis.isConfigured()) counts = await redis.hgetall('inkvial:stock');
    if (!counts || !Object.keys(counts).length) counts = seed; // not seeded yet
    const statuses = {};
    for (const id of Object.keys(seed)) {
      const n = counts[id] !== undefined ? counts[id] : seed[id];
      statuses[id] = statusOf(n);
    }
    // Packs have no stock counter of their own - their availability is whichever
    // component ink inside them is scarcest right now.
    const RANK = { in: 2, low: 1, out: 0 };
    for (const id of Object.keys(catalog)) {
      const entry = catalog[id];
      if (!entry.components || !entry.components.length) continue;
      let worst = 'in';
      for (const cid of entry.components) {
        const st = statuses[cid] || 'out';
        if (RANK[st] < RANK[worst]) worst = st;
      }
      statuses[id] = worst;
    }
    return res.status(200).json({ statuses });
  } catch (err) {
    // Redis unreachable - let the front-end fall back to its built-in stock
    return res.status(200).json({ statuses: null, note: 'kv-unavailable' });
  }
};
