// Ink Vial — contact + ink-suggestion form handler.
// Emails each submission to you via Resend, and keeps a backup copy in Redis.
//
// Required env var:  RESEND_API_KEY      (from https://resend.com)
// Optional env vars: CONTACT_TO          (default hello@inkvial.co.uk)
//                    CONTACT_FROM        (default "Ink Vial <onboarding@resend.dev>")
//                                         once your domain is verified in Resend,
//                                         set this to e.g. "Ink Vial <hello@inkvial.co.uk>"

const redis = require('./_redis');

const TO   = process.env.CONTACT_TO   || 'hello@inkvial.co.uk';
const FROM = process.env.CONTACT_FROM || 'Ink Vial <onboarding@resend.dev>';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body (JSON or form-encoded)
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch (e) {
      const p = new URLSearchParams(body); body = {};
      for (const [k, v] of p) body[k] = v;
    }
  }

  // Honeypot — bots fill hidden fields; pretend success and drop.
  if (body._gotcha) return res.status(200).json({ ok: true });

  const type    = body.type === 'suggest' ? 'suggest' : 'contact';
  const name    = (body.name || '').toString().trim().slice(0, 120);
  const email   = (body.email || '').toString().trim().slice(0, 160);
  const subject = (body.subject || '').toString().trim().slice(0, 160);
  const message = (body.message || '').toString().trim().slice(0, 4000);
  const ink     = (body.ink_suggestion || '').toString().trim().slice(0, 200);
  const note    = (body.note || '').toString().trim().slice(0, 4000);

  // Minimal validation
  if (type === 'contact' && (!email || !message)) {
    return res.status(400).json({ error: 'Please add your email and a message.' });
  }
  if (type === 'suggest' && !ink) {
    return res.status(400).json({ error: 'Please tell us which ink to add.' });
  }

  const isSuggest = type === 'suggest';
  const mailSubject = isSuggest
    ? `New ink suggestion${ink ? ' - ' + ink : ''}`
    : `New contact message${subject ? ' - ' + subject : ''}`;

  const rows = isSuggest
    ? [['Ink / brand', ink], ['Note', note], ['Email', email]]
    : [['Name', name], ['Email', email], ['Subject', subject], ['Message', message]];

  const textBody = rows.filter(r => r[1]).map(r => `${r[0]}: ${r[1]}`).join('\n');
  const htmlBody =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#3d2458;">
       <h2 style="color:#5c3a9a;">${esc(mailSubject)}</h2>
       ${rows.filter(r => r[1]).map(r =>
         `<p style="margin:0 0 10px;"><strong>${esc(r[0])}:</strong><br>${esc(r[1]).replace(/\n/g, '<br>')}</p>`
       ).join('')}
       <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
       <p style="font-size:12px;color:#999;">Sent from the Ink Vial ${isSuggest ? 'suggestion box' : 'contact form'}.</p>
     </div>`;

  // 1) Backup to Redis (best-effort, never blocks the response)
  try {
    if (redis.isConfigured()) {
      const record = JSON.stringify({ type, name, email, subject, message, ink, note, at: new Date().toISOString() });
      await redis.cmd(['LPUSH', 'inkvial:messages', record]);
      await redis.cmd(['LTRIM', 'inkvial:messages', '0', '999']); // keep last 1000
    }
  } catch (e) { /* don't fail the form over a backup error */ }

  // 2) Email via Resend
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          subject: mailSubject,
          html: htmlBody,
          text: textBody,
          reply_to: email || undefined
        })
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        console.error('Resend error', r.status, detail);
        // Email failed but we stored a backup — surface a soft error.
        return res.status(502).json({ error: 'Could not send right now. Please email hello@inkvial.co.uk directly.' });
      }
    } catch (e) {
      console.error('Resend exception', e);
      return res.status(502).json({ error: 'Could not send right now. Please email hello@inkvial.co.uk directly.' });
    }
    return res.status(200).json({ ok: true });
  }

  // No email provider configured yet — we still stored the backup.
  return res.status(200).json({ ok: true, stored: true });
};
