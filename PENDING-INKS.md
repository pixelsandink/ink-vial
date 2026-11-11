# Pending inks

Bottles that are bought but not yet on the website. When a bottle arrives,
add it to the shop (`inks.js`, `catalog.json`, `stock-seed.json`, plus an image)
and move it off this list.

## Nagasawa Kobe order (November 2026)

Order cost £231.00: £192.00 for 11 bottles plus £39.00 shipping. Shipping is
split evenly, about £3.55 per bottle.

Kobe INK Monogatari bottles are 50ml, so about 22 vials each (see `STOCK-SETUP.md`).
The vial-and-label cost below is an estimate of 20p a vial.

| Ink | Bottles | Bottle price | Landed cost per bottle | Ink cost per vial | Price per 2ml | Margin* | Status |
|---|---|---|---|---|---|---|---|
| #1 Rokko Green | 1 | £16.00 | £19.55 | £0.89 | **£3.25** | ~67% | Pending: new ink |
| #18 Sannomiya Pansy | 1 | £16.00 | £19.55 | £0.89 | **£3.25** | ~67% | Pending: new ink |
| #62 Nunobiki Lavender | 1 | £16.00 | £19.55 | £0.89 | **£3.25** | ~67% | Pending: new ink |
| Special colour: Yuhobika Blue | 1 | £18.00 | £21.55 | £0.98 | **£3.25** | ~64% | Pending: new ink |
| Special colour: Akane-gumo "Anohi-no-yuuyake" | 1 | £18.00 | £21.55 | £0.98 | **£3.25** | ~64% | Pending: new ink |
| Special colour: "Chinbotsu-sen Wine Sauce" | 2 | £18.00 | £21.55 | £0.98 | **£3.25** | ~64% | Pending: new ink |
| Felissimo Chocolate Museum: Milk Chocolate | 2 | £18.00 | £21.55 | £0.98 | £3.25 (already listed) | ~64% | Pending: restock (+44 vials) |
| Felissimo Chocolate Museum: Strawberry Chocolate | 2 | £18.00 | £21.55 | £0.98 | £3.25 (already listed) | ~64% | Pending: restock (+44 vials) |

\* Margin = (price − ink cost − 20p vial and label) ÷ price, before Stripe fees and postage.

**Totals:** 11 bottles, about 242 vials. At £3.25 each that's about £786 in
sales and roughly £505 gross profit after the ink, vials and labels.

### Notes
- All six new inks fit the existing Nagasawa Kobe price of £3.25 in `prices.js`,
  so no pricing code needs to change when they go live.
- Restocks: when the chocolate bottles are opened, use
  `/api/admin-stock?...&action=add&id=nagasawa-milk-chocolate&count=44` (and the
  same for `nagasawa-strawberry-chocolate`), or 22 at a time as each bottle is opened.
