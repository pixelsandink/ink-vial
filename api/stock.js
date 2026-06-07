// GET /api/stock - returns live stock STATUS for every ink (never the raw count).
// Reads the single hash "inkvial:stock". Falls back to seed if Redis is empty/unset.

const redis = require('./_redis');
const seed = require('../stock-seed.json');

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
    return res.status(200).json({ statuses });
  } catch (err) {
    // Redis unreachable - let the front-end fall back to its built-in stock
    return res.status(200).json({ statuses: null, note: 'kv-unavailable' });
  }
};
