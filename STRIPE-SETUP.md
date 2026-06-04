# Ink Vial — Stripe Checkout setup

Your cart hands off to Stripe's secure payment page. Prices are validated
server-side (in `catalog.json`) so they can't be tampered with in the browser.

## One-time setup

### 1. Create a Stripe account
- Go to https://stripe.com and sign up (free).
- Business location: United Kingdom. Currency: GBP.

### 2. Get your secret key
- Stripe Dashboard → Developers → API keys.
- Copy the **Secret key** (starts with `sk_live_...` for real payments,
  or `sk_test_...` while testing).

### 3. Add the key to Vercel
- Vercel Dashboard → your inkvial project → Settings → Environment Variables.
- Add:  Name = `STRIPE_SECRET_KEY`   Value = your secret key.
- Apply to Production (and Preview if you like). Save.
- Redeploy (Vercel → Deployments → ••• → Redeploy) so the key is picked up.

### 4. Done
- Add inks to the basket → Checkout → you'll land on Stripe's payment page.
- After paying, customers return to `/success` and their basket clears.

## Testing before going live
- Use your `sk_test_...` key first.
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
- No real money moves in test mode.

## Good to know
- **Shipping**: £3.50 Royal Mail Tracked, automatically FREE over £25 subtotal.
  (Change in `api/create-checkout-session.js` and `cart.js`.)
- **Discount codes**: create them in Stripe → Products → Coupons. The checkout
  page already shows a "promo code" box (`allow_promotion_codes: true`).
- **Receipts**: Stripe emails customers automatically. Turn on in
  Stripe → Settings → Emails → "Successful payments".
- **Your order notifications**: Stripe → Settings → Emails, or watch the
  Payments tab. (For packing lists, see Stripe → Payments → each order.)

## IMPORTANT: keep prices in sync
`catalog.json` holds the prices Stripe charges. If you change any price in
`prices.js`, regenerate the catalogue before deploying:

```
node -e "const fs=require('fs');const INKS=new Function(fs.readFileSync('inks.js','utf8')+';return INKS;')();eval(fs.readFileSync('prices.js','utf8'));const c={};INKS.forEach(i=>c[i.id]={name:i.name,brand:i.brand,price:getInkPrice(i)});fs.writeFileSync('catalog.json',JSON.stringify(c));console.log('catalog.json rebuilt:',Object.keys(c).length,'inks');"
```

## Local preview
Running locally with `npx serve` there's no serverless function, so the
Checkout button falls back to composing an order email to hello@inkvial.co.uk.
The real Stripe flow only runs once deployed to Vercel.
