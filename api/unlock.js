// POST /api/unlock - checks the preview password and, if correct, sets a
// cookie that lets Edge Middleware allow access to the shop pages.
// Password lives in the SITE_PASSWORD env var (never in the page source).

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  let password = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    password = body.password || '';
  } catch (e) { password = ''; }

  const expected = process.env.SITE_PASSWORD;
  if (!expected) return res.status(500).json({ ok: false, error: 'No password configured.' });

  if (password === expected) {
    const token = process.env.SITE_ACCESS_TOKEN || 'inkvial-early';
    // 30-day access, HttpOnly so it can't be read/forged in the browser
    res.setHeader('Set-Cookie',
      `iv_access=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false });
};
