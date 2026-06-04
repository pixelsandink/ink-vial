# Ink Vial — Automatic stock (Level 3)

Stock is tracked in a tiny database (Vercel KV). A Stripe webhook subtracts
stock automatically on every paid order, and the shop reads live stock so
sold-out inks are blocked. Customers only ever see **Available / Low stock /
Sold out** — never a number.

## One-time setup (after the site is deployed to Vercel)

### 1. Create the KV database
- Vercel Dashboard → your inkvial project → **Storage** → **Create Database** →
  choose **KV** (Upstash). Name it anything, e.g. `inkvial-stock`.
- Click **Connect** to your project. Vercel injects the KV env vars automatically.
- Redeploy if prompted.

### 2. Add a Stripe webhook
- Stripe Dashboard → Developers → **Webhooks** → **Add endpoint**.
- Endpoint URL: `https://inkvial.co.uk/api/webhook`
- Events to send: **`checkout.session.completed`**
- Create it, then copy the **Signing secret** (starts `whsec_...`).
- Vercel → Settings → Environment Variables → add
  `STRIPE_WEBHOOK_SECRET` = that signing secret. Redeploy.

### 3. Add an admin key (so you can restock)
- Vercel → Settings → Environment Variables → add
  `ADMIN_KEY` = any long random string you choose (your private password).
  Redeploy.

### 4. Seed the starting stock (run once)
Visit this in your browser (replace YOUR_KEY):
```
https://inkvial.co.uk/api/admin-stock?key=YOUR_KEY&action=seed
```
This loads every ink's opening stock (auto-calculated from bottle size, e.g.
a 50ml bottle ≈ 22 vials). Done — the shop is now live-stock aware.

## Day-to-day: you do nothing
Every paid order automatically subtracts the right quantities. When an ink
hits 0 it shows **Sold out** and can't be bought.

## When a new bottle arrives (the only manual bit)
Only you know when you've opened a fresh bottle, so tell the system in one click:

- **Set to an exact number** (e.g. fresh 50ml bottle ≈ 22 vials):
  ```
  /api/admin-stock?key=YOUR_KEY&action=set&id=diamine-lady-grey&count=22
  ```
- **Add to existing** (opened another bottle alongside what's left):
  ```
  /api/admin-stock?key=YOUR_KEY&action=add&id=diamine-lady-grey&count=22
  ```
Tip: bookmark these. The ink **id** is the bit after `?id=` in the product URL.

## See what needs refilling
```
/api/admin-stock?key=YOUR_KEY&action=list
```
Returns a summary plus everything currently Low or Sold out, so you know what
to reorder.

## Approx vials per bottle (for restocking)
| Bottle size | Vials (~90% usable) |
|---|---|
| 10ml | 4 | 
| 20ml | 9 |
| 30ml | 13 |
| 38ml | 17 |
| 50ml | 22 |
| 65ml | 29 |

## Notes
- **Before KV is set up** (or locally), the shop falls back to the built-in
  opening stock in `inks.js`, so nothing ever breaks — it just isn't live.
- The webhook decrement is **atomic**, so two simultaneous orders can never
  oversell the same vial.
- "Low stock" shows when **4 or fewer** vials remain (change `LOW_AT` in the
  API files / `LOW_STOCK_AT` in `prices.js` if you want a different threshold).
