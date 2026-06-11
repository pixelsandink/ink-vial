// Shared email sending (Resend) + branded templates for Ink Vial.
// Env: RESEND_API_KEY, CONTACT_FROM (default onboarding@resend.dev)

const FROM = process.env.CONTACT_FROM || 'Ink Vial <onboarding@resend.dev>';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Send one email. Returns true on success, false otherwise (never throws).
async function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: replyTo || undefined })
    });
    if (!r.ok) { console.error('Resend', r.status, await r.text().catch(() => '')); return false; }
    return true;
  } catch (e) { console.error('Resend exception', e); return false; }
}

const wrap = inner =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3d2458;line-height:1.6;max-width:520px;margin:0 auto;">
     <div style="font-family:Georgia,serif;font-size:1.6rem;font-weight:700;color:#5c3a9a;margin-bottom:18px;">Ink Vial</div>
     ${inner}
     <hr style="border:none;border-top:1px solid #eee;margin:22px 0 12px;">
     <p style="font-size:12px;color:#999;">Ink Vial - a trading name of Pixels and Ink Ltd · <a href="https://www.inkvial.co.uk" style="color:#8b68cc;">inkvial.co.uk</a></p>
   </div>`;

const itemsUl = lines =>
  `<ul style="margin:0 0 16px;padding-left:18px;">${lines.map(l => `<li style="margin:0 0 4px;">${esc(l.qty)} × ${esc(l.label)}</li>`).join('')}</ul>`;
const itemsTxt = lines => lines.map(l => `${l.qty} x ${l.label}`).join('\n');

// ── Customer: order confirmation (sent on payment) ──
function orderConfirmationEmail({ name, amount, lines, ship }) {
  const hi = name ? `Hi ${esc(name.split(' ')[0])},` : 'Hi there,';
  return {
    subject: 'Thank you for your Ink Vial order! 💜',
    html: wrap(
      `<p>${hi}</p>
       <p>Thank you so much for your order - it genuinely means the world. 💜</p>
       <p style="margin:0 0 6px;"><strong>Your inks${amount ? ' (' + esc(amount) + ')' : ''}:</strong></p>
       ${itemsUl(lines)}
       ${ship ? `<p style="margin:0 0 12px;"><strong>Shipping to:</strong><br>${esc(ship)}</p>` : ''}
       <p>Every vial is hand-filled fresh to order, so please allow <strong>3-5 working days</strong> for us to fill and pack before it's posted via Royal Mail tracked. We'll email you again the moment it's on its way.</p>
       <p>Happy writing,<br>Rupal</p>`),
    text:
      `${name ? 'Hi ' + name.split(' ')[0] + ',' : 'Hi there,'}\n\n` +
      `Thank you for your order!${amount ? ' (' + amount + ')' : ''}\n\n` +
      itemsTxt(lines) + (ship ? `\n\nShipping to: ${ship}` : '') +
      `\n\nEvery vial is hand-filled fresh to order, so please allow 3-5 working days for us to fill and pack before it's posted via Royal Mail tracked. We'll email you when it ships.\n\nHappy writing,\nRupal - Ink Vial`
  };
}

// ── Customer: shipped notification ──
function shippedEmail({ name, lines, tracking }) {
  const hi = name ? `Hi ${esc(name.split(' ')[0])},` : 'Hi there,';
  const trackBlock = tracking
    ? `<p style="margin:0 0 12px;"><strong>Royal Mail tracking:</strong> ${esc(tracking)}<br>
        <a href="https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(tracking)}" style="color:#8b68cc;">Track your parcel</a></p>`
    : `<p style="margin:0 0 12px;">Sent via Royal Mail tracked.</p>`;
  return {
    subject: 'Your Ink Vial order is on its way! 📮',
    html: wrap(
      `<p>${hi}</p>
       <p>Great news - your inks are packed, hand-labelled with love, and have just been posted! 📮</p>
       ${lines && lines.length ? itemsUl(lines) : ''}
       ${trackBlock}
       <p>It should be with you within a few working days. I really hope you love trying them - once you have, I'd love to know what you think. Just hit reply, or tag <strong>@inkvial</strong> if you share a swatch. 💜</p>
       <p>Happy writing,<br>Rupal</p>`),
    text:
      `${name ? 'Hi ' + name.split(' ')[0] + ',' : 'Hi there,'}\n\n` +
      `Your inks are packed and on their way via Royal Mail!\n\n` +
      (lines && lines.length ? itemsTxt(lines) + '\n\n' : '') +
      (tracking ? `Royal Mail tracking: ${tracking}\nhttps://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(tracking)}\n\n` : 'Sent via Royal Mail tracked.\n\n') +
      `It should arrive within a few working days. I'd love to hear what you think once you've tried them!\n\nHappy writing,\nRupal - Ink Vial`
  };
}

// ── Admin: new order alert (to you) ──
function newOrderAdminEmail({ amount, totalVials, lines, ship, email, name }) {
  return {
    subject: `New order - Ink Vial (${amount})`,
    html: wrap(
      `<h2 style="color:#5c3a9a;margin:0 0 6px;">New order - ${esc(amount)}</h2>
       <p style="margin:0 0 12px;color:#666;">${totalVials} vial${totalVials !== 1 ? 's' : ''}</p>
       ${itemsUl(lines)}
       <p style="margin:0 0 4px;"><strong>Ship to:</strong><br>${esc(ship) || '(no address)'}</p>
       <p style="margin:0 0 12px;"><strong>Email:</strong> ${esc(email) || '(none)'}</p>
       <p style="font-size:13px;"><a href="https://www.inkvial.co.uk/orders" style="color:#8b68cc;">Open your orders dashboard →</a></p>`),
    text:
      `New order - ${amount} (${totalVials} vials)\n\n` + itemsTxt(lines) +
      `\n\nShip to: ${ship || '(no address)'}\nEmail: ${email || '(none)'}\n\nManage: https://www.inkvial.co.uk/orders`
  };
}

module.exports = { sendEmail, orderConfirmationEmail, shippedEmail, newOrderAdminEmail };
