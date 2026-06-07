# Contact & Ink-Suggestion forms — setup

Both forms (Contact Us + Suggest an Ink) now POST to your own endpoint
`/api/contact`, which **emails you the submission** and keeps a backup in your
Upstash database. No third-party form service, no email popup for the visitor.

## One-time setup (≈5 minutes)

### 1. Create a Resend account
- Go to https://resend.com and sign up (free tier = 3,000 emails/month).
- Sign up with **hello@inkvial.co.uk** if you can — that makes test sending work
  immediately.

### 2. Get an API key
- Resend dashboard → **API Keys** → **Create API Key** → copy it (starts `re_...`).

### 3. Add it in Vercel
- Vercel → your project → **Settings → Environment Variables** → add:
  - `RESEND_API_KEY` = the `re_...` key
- **Redeploy** (Deployments → ⋯ → Redeploy).

That's it — submissions now arrive at **hello@inkvial.co.uk**.

## Recommended: verify your domain (so email comes "from" you)
Until you verify a domain, Resend sends **from** `onboarding@resend.dev` and can
only deliver to the address you signed up with. To send from your own address:
- Resend → **Domains** → **Add Domain** → `inkvial.co.uk`
- Add the DNS records it shows you (in GoDaddy). Wait for "Verified".
- In Vercel add: `CONTACT_FROM` = `Ink Vial <hello@inkvial.co.uk>` and redeploy.

## Optional env vars
- `CONTACT_TO`   — where submissions are emailed (default `hello@inkvial.co.uk`)
- `CONTACT_FROM` — the From address (default `Ink Vial <onboarding@resend.dev>`)

## Reading the backups
Every submission is also stored in Upstash as a safety net. View them at:

    https://www.inkvial.co.uk/api/messages?key=YOUR_ADMIN_KEY

(uses the same `ADMIN_KEY` you set for stock).

## If `RESEND_API_KEY` isn't set yet
The form still works and saves to the database (so nothing is lost) — it just
won't email until you add the key.
