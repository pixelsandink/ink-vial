// Edge Middleware - keeps the shop behind a password until launch.
// The countdown page (/) and all assets stay public. The shop pages
// redirect to the countdown unless the visitor has unlocked access
// (a cookie set by /api/unlock after entering the correct password).
//
// Set SITE_PASSWORD in Vercel env vars. Optionally SITE_ACCESS_TOKEN
// (any random string) - must match between here and /api/unlock; both
// default to the same value if unset.
//
// To OPEN the site to everyone at launch, set SITE_OPEN=true in Vercel
// (or just delete this file and redeploy).

export const config = {
  matcher: [
    '/shop', '/shop.html',
    '/product', '/product.html',
    '/about', '/about.html',
    '/faq', '/faq.html',
    '/how-it-works', '/how-it-works.html',
    '/contact', '/contact.html',
    '/success', '/success.html'
  ]
};

export default function middleware(request) {
  // Launch switch - once set, everyone gets in
  if (process.env.SITE_OPEN === 'true') return;

  const token = process.env.SITE_ACCESS_TOKEN || 'inkvial-early';
  const cookie = request.headers.get('cookie') || '';
  const unlocked = cookie.split(';').some(c => c.trim() === 'iv_access=' + token);

  if (unlocked) return; // allow through

  const url = new URL(request.url);
  return Response.redirect(url.origin + '/?locked=1', 307);
}
