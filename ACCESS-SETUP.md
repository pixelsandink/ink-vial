# Ink Vial — soft launch (countdown public, shop behind a password)

The countdown page stays public. The shop, product, about, FAQ, how-it-works,
contact and success pages are blocked until a visitor unlocks them with your
preview password. You can share the password with testers; everyone else just
sees the countdown.

## Setup (in Vercel → Settings → Environment Variables)
1. **`SITE_PASSWORD`** = the password you want to give testers (e.g. `inkfriends`).
   → Required. This is what people type on the countdown page.
2. *(optional)* **`SITE_ACCESS_TOKEN`** = any random string. If you set it here,
   it's already handled — no other change needed. If you skip it, a default is used.

Redeploy after adding the variable.

## How testers get in
- Go to inkvial.co.uk → click **"Have a preview password?"** under the countdown
  → enter the password → they're taken into the full shop.
- Access lasts 30 days on that device (a secure cookie), so they won't be asked again.

## 🚀 Going fully live at launch
When you're ready to open the shop to everyone, do **either**:
- **Easiest:** set env var **`SITE_OPEN`** = `true` in Vercel and redeploy. The
  gate switches off for everyone (you can flip it back any time), **or**
- Delete `middleware.js` and redeploy.

## Notes
- The password is stored as a Vercel secret — it is **not** in the page source,
  so people can't find it by "view source".
- The shop pages are blocked at the edge (server side), so they can't be reached
  by guessing the URL either.
- Locally (`npx serve`) there's no middleware, so the gate is inactive — that's
  only for your own development. It activates once deployed to Vercel.
