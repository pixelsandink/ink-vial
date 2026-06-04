# Ink Vial — Go-Live Checklist (in order)

Work top to bottom. Each step builds on the last.

## 1. Deploy the site to Vercel
- Upload the project to your GitHub repo (drag the contents of `inkvial-site.zip`
  into the repo, or push the folder). Vercel auto-builds on push.
- After it builds, the countdown is public and the shop is password-gated
  (it'll stay gated until you add SITE_PASSWORD below).

## 2. Add environment variables (Vercel → Settings → Environment Variables)
Add these, then **redeploy** (Deployments → ••• → Redeploy):

| Name | Value | What it does |
|------|-------|--------------|
| `STRIPE_SECRET_KEY` | your Stripe secret key | Card payments. Use `sk_test_…` first to test safely. |
| `SITE_PASSWORD` | a password for testers | Unlocks the shop behind the countdown. |

(KV variables get added automatically in step 4. `STRIPE_WEBHOOK_SECRET`
comes in step 3.)

## 3. Stripe webhook (for automatic stock)
- Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://inkvial.co.uk/api/webhook`
- Event: **`checkout.session.completed`**
- Copy the **signing secret** (`whsec_…`) → add as `STRIPE_WEBHOOK_SECRET`
  in Vercel → redeploy.

## 4. Stock database (Vercel KV)
- Vercel → Storage → Create Database → **KV** → connect to the project.
  (KV env vars are injected automatically.)
- Seed opening stock once, in your browser:
  `https://inkvial.co.uk/api/admin-stock?key=YOUR_ADMIN_KEY&action=seed`
  (first add an `ADMIN_KEY` env var = a private password of your choosing.)

## 5. Test everything (in Stripe TEST mode)
- Unlock the shop with your SITE_PASSWORD.
- Add inks → Checkout → pay with test card `4242 4242 4242 4242`
  (any future expiry, any CVC, any postcode).
- Confirm: you land on the Thank-You page, the basket clears, and stock
  dropped (`…/api/admin-stock?key=…&action=list`).

## 6. Optional before launch
- `STRIPE_SECRET_KEY` → swap `sk_test_…` for `sk_live_…` when ready for real money.
- Connect the contact/suggestion forms (Formspree — see contact.html).
- Add the remaining ink photos.

## 7. LAUNCH 🚀 (5 June, 6pm)
- Set `SITE_OPEN` = `true` in Vercel → redeploy. The shop opens to everyone;
  the countdown can stay as your homepage or be swapped for a proper home page.

---
### Quick reference — all env vars
- `STRIPE_SECRET_KEY` — Stripe payments
- `STRIPE_WEBHOOK_SECRET` — stock auto-decrement
- `SITE_PASSWORD` — preview gate password
- `ADMIN_KEY` — your private stock-admin password
- `SITE_OPEN` — set to `true` to open the shop to everyone at launch
- (KV vars — added automatically by Vercel)
