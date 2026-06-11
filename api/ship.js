// Mark an order as shipped and email the customer. Protected by ADMIN_KEY.
//   /api/ship?key=ADMIN_KEY&session=cs_...&tracking=AB123456789GB
//   (tracking is optional)

const redis = require('./_redis');
const { sendEmail, shippedEmail } = require('./_email');

const TO = process.env.CONTACT_TO || 'hello@inkvial.co.uk';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (!process.env.ADMIN_KEY || q.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (!redis.isConfigured()) return res.status(500).json({ error: 'Database not connected.' });

  const session = (q.session || '').toString();
  const tracking = (q.tracking || '').toString().trim().slice(0, 60);
  const resend = q.resend === '1';
  if (!session) return res.status(400).json({ error: 'Missing order session.' });

  try {
    const raw = await redis.cmd(['HGET', 'inkvial:orderbook', session]);
    if (!raw) return res.status(404).json({ error: 'Order not found.' });
    const order = JSON.parse(raw);

    if (order.shipped && !resend) {
      return res.status(200).json({ ok: true, alreadyShipped: true });
    }

    // Build line items for the email from the stored strings ("2 x Brand Name")
    const lines = (order.items || []).map(s => {
      const m = String(s).match(/^(\d+)\s*x\s*(.+)$/i);
      return m ? { qty: parseInt(m[1]), label: m[2] } : { qty: 1, label: String(s) };
    });

    let emailed = false;
    if (order.email) {
      const e = shippedEmail({ name: order.name, lines, tracking: tracking || order.tracking });
      emailed = await sendEmail({ to: order.email, subject: e.subject, html: e.html, text: e.text, replyTo: TO });
    }

    order.shipped = true;
    order.shippedAt = new Date().toISOString();
    if (tracking) order.tracking = tracking;
    await redis.cmd(['HSET', 'inkvial:orderbook', session, JSON.stringify(order)]);

    return res.status(200).json({ ok: true, emailed, tracking: order.tracking || '' });
  } catch (err) {
    return res.status(500).json({ error: 'Error: ' + err.message });
  }
};
