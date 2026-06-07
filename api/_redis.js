// Tiny Redis client over the Upstash REST API.
// Works whether Vercel injects KV_REST_API_* (old Vercel KV) or
// UPSTASH_REDIS_REST_* (Upstash marketplace) env vars - no SDK needed.

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL || '';
const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN || '';

const isConfigured = () => Boolean(URL && TOKEN);

// Run one Redis command via the Upstash REST endpoint. Returns the `result`.
async function cmd(args) {
  if (!isConfigured()) throw new Error('Redis not configured');
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args.map(String))
  });
  if (!res.ok) throw new Error('Redis HTTP ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error('Redis: ' + data.error);
  return data.result;
}

// Hash helpers (stock lives in a single hash: inkvial:stock { inkId: count })
async function hgetall(key) {
  const flat = await cmd(['HGETALL', key]);          // [field, val, field, val, ...]
  const out = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  } else if (flat && typeof flat === 'object') {
    Object.assign(out, flat);
  }
  return out;
}
async function hset(key, obj) {
  const args = ['HSET', key];
  for (const k of Object.keys(obj)) { args.push(k, obj[k]); }
  return cmd(args);
}
async function hincrby(key, field, by) { return cmd(['HINCRBY', key, field, by]); }
async function del(key)               { return cmd(['DEL', key]); }
async function get(key)               { return cmd(['GET', key]); }
async function set(key, val, exSecs)  {
  const a = ['SET', key, val];
  if (exSecs) a.push('EX', exSecs);
  return cmd(a);
}

module.exports = { isConfigured, cmd, hgetall, hset, hincrby, del, get, set };
