// Ink Vial - Price lookup (updated: 50% minimum margin on all brands)
// All prices ensure ≥50% gross margin after ink, vial, label & labour costs.

function getInkPrice(ink) {
  const id    = (ink.id    || '').toLowerCase();
  const brand = (ink.brand || '').toLowerCase();

  // ── Nagasawa Kobe £5.00 ────────────────────────────────
  if (brand.includes('kobe') || brand.includes('nagasawa')) return 5.00;

  // ── TAG Kyo-No-Oto £4.50 ──────────────────────────────
  if (brand.includes('tag') && brand.includes('kyo')) return 4.50;

  // ── Tono & Lims £4.25 ─────────────────────────────────
  if (brand.includes('tono & lims') || brand.includes('lims') ||
      id.startsWith('tono-lims') || id.startsWith('tono-and-lims')) return 4.25;

  // ── J.Herbin 1670 / 350 Anniversary (shimmer) £4.00 ───
  if ((id.includes('jherbin') || brand.includes('j.herbin') || brand.includes('jherbin')) &&
      (ink.shimmer === true || id.includes('1670') || id.includes('emerald-of-chivor') || id.includes('stormy-grey') || id.includes('hematite-red'))) return 4.00;

  // ── Pilot Iroshizuku £4.00 ────────────────────────────
  if (brand.includes('pilot iroshizuku') || id.startsWith('pilot-iroshizuku')) return 4.00;

  // ── Ferris Wheel Press £4.00 ──────────────────────────
  if (brand.includes('ferris wheel press')) return 4.00;

  // ── Wearingeul (standard & special) £4.00 ─────────────
  if (brand.includes('wearingeul')) return 4.00;

  // ── Sailor Manyo £4.00 ────────────────────────────────
  if (id.includes('sailor-manyo')) return 4.00;

  // ── Robert Oster x The Coffee Monster Co. collab £4.00 ──
  if (id.includes('coffee-monster') || id.includes('murky-pond-water')) return 4.00;

  // ── Taccia Ukiyoe £3.75 ───────────────────────────────
  if (id.includes('taccia') && id.includes('ukiyoe')) return 3.75;

  // ── Sailor Mizutama £3.75 ─────────────────────────────
  if (id.includes('sailor-mizutama')) return 3.75;

  // ── Sailor Ink Studio £3.50 ───────────────────────────
  if (id.includes('sailor-studio')) return 3.50;

  // ── Sailor Shikiori £3.50 ─────────────────────────────
  if (id.includes('sailor-shikori')) return 3.50;

  // ── Sailor (standard & Dategokoro) £3.50 ──────────────
  if (brand.includes('sailor')) return 3.50;

  // ── Lennon Tool Bar £3.50 ─────────────────────────────
  if (brand.includes('lennon tool bar') || id.startsWith('lennon-tool-bar')) return 3.50;

  // ── Dominant Industry: Pearl/shimmer £3.25, standard £2.75 ──
  if (brand.includes('dominant industry')) return ink.shimmer === true ? 3.25 : 2.75;

  // ── Vinta £3.25 ───────────────────────────────────────
  if (brand.includes('vinta')) return 3.25;

  // ── Octopus Fluids £3.00 ──────────────────────────────
  if (brand.includes('octopus')) return 3.00;

  // ── Birmingham Pen Company £3.00 ──────────────────────
  if (brand.includes('birmingham')) return 3.00;

  // ── Robert Oster £2.75 ────────────────────────────────
  if (brand.includes('robert oster')) return 2.75;

  // ── J.Herbin (standard) £2.75 ─────────────────────────
  if (brand.includes('j.herbin') || brand.includes('jherbin') ||
      id.startsWith('jherbin')) return 2.75;

  // ── Taccia Sunaoiro £2.75 ─────────────────────────────
  if (brand.includes('taccia')) return 2.75;

  // ── Pentonote £2.50 ───────────────────────────────────
  if (brand.includes('pentonote')) return 2.50;

  // ── Pelikan Edelstein £2.50 ───────────────────────────
  if (id.includes('pelikan') && id.includes('edelstein')) return 2.50;

  // ── Troublemaker £2.25 ────────────────────────────────
  if (brand.includes('troublemaker')) return 2.25;

  // ── De Atramentis £2.25 ───────────────────────────────
  if (brand.includes('de atramentis') || id.startsWith('de-atramentis') || id.startsWith('deatramentis')) return 2.25;

  // ── Laban £2.25 ───────────────────────────────────────
  if (brand.includes('laban')) return 2.25;

  // ── Colorverse £2.00 ──────────────────────────────────
  if (brand.includes('colorverse')) return 2.00;

  // ── KWZ Ink £2.00 ─────────────────────────────────────
  if (brand.includes('kwz')) return 2.00;

  // ── Monteverde £3.00 ──────────────────────────────────
  if (brand.includes('monteverde')) return 3.00;

  // ── Kaweco £2.00 ──────────────────────────────────────
  if (brand.includes('kaweco')) return 2.00;

  // ── Inkebara £2.00 ────────────────────────────────────
  if (brand.includes('inkebara')) return 2.00;

  // ── Standard £1.75 (Diamine, Pelikan 4001, Rohrer & Klingner) ──
  return 1.75;
}

// Stock status - customers see a label only, never the number.
// 'in' = Available · 'low' = Low stock · 'out' = Sold out
var LOW_STOCK_AT = 4;
function getStockStatus(ink) {
  if (!ink) return 'in';
  // Prefer live status from the server (set by the stock API) when available
  if (typeof window !== 'undefined' && window.LIVE_STOCK && window.LIVE_STOCK[ink.id]) {
    return window.LIVE_STOCK[ink.id];
  }
  var s = (typeof ink.stock === 'number') ? ink.stock : 99;
  if (s <= 0) return 'out';
  if (s <= LOW_STOCK_AT) return 'low';
  return 'in';
}

function getColourFamily(hex) {
  if (!hex || hex.length < 7) return 'Other';
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max+min)/2;
  if (max === min) return l < 0.2 ? 'Black' : 'Grey';
  const d = max - min;
  const s = l > 0.5 ? d/(2-max-min) : d/(max+min);
  if (s < 0.18) return l < 0.35 ? 'Brown' : 'Grey';
  let h = 0;
  if (max === r)      h = ((g-b)/d + (g<b?6:0))/6;
  else if (max === g) h = ((b-r)/d + 2)/6;
  else                h = ((r-g)/d + 4)/6;
  h *= 360;
  if (h < 15  || h >= 345) return 'Red';
  if (h < 45)  return 'Orange';
  if (h < 70)  return 'Yellow';
  if (h < 160) return 'Green';
  if (h < 200) return 'Teal';
  if (h < 265) return 'Blue';
  if (h < 310) return 'Purple';
  return 'Pink';
}
