#!/usr/bin/env bash
# Decrement Ink Vial stock by 1 for Krystle SC order (106 inks, paid 2026-06-15).
#
# Usage:
#   KEY=your_admin_key bash decrement-krystle-order.sh            # live run
#   KEY=your_admin_key bash decrement-krystle-order.sh --dry-run  # preview only, changes nothing
#
# A live run saves stock snapshots to stock-before-krystle.json and
# stock-after-krystle.json so you can diff them.
set -euo pipefail
BASE="https://www.inkvial.co.uk/api/admin-stock"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
if [ "$DRY" = "0" ] && [ -z "${KEY:-}" ]; then echo "Set KEY=your_admin_key first (or use --dry-run)"; exit 1; fi

IDS=(
  colorverse-and
  colorverse-brunch-date
  colorverse-dirty-red
  colorverse-mystic-mountain
  colorverse-sea-europa
  diamine-7-sinners-gluttony
  diamine-7-sinners-wrath
  diamine-a-jug-of-sangria
  diamine-cashmere-rose
  diamine-chichen-itza
  diamine-lady-grey
  diamine-lavender-frost
  diamine-summer-sunset
  diamine-toe-in-the-ocean
  dominant-industry-earl-grey-tea
  dominant-industry-evening
  dominant-industry-les-falaises-a-etretat
  dominant-industry-romania-red
  dominant-industry-sunset
  dominant-industry-tsavorite
  ferris-wheel-press-blue-grass-velvet
  ferris-wheel-press-blushing-mushrooms
  ferris-wheel-press-candy-marsala
  ferris-wheel-press-chidori-cherry-blossom
  ferris-wheel-press-dusk-in-bloom
  ferris-wheel-press-pink-eraser
  ferris-wheel-press-spadina-rose
  ferris-wheel-press-storied-blue
  ferris-wheel-press-terracotta-canyon
  ferris-wheel-press-unfettered-flight
  inkebara-pale-violet
  jherbin-bouquet-dantan
  jherbin-corail-des-tropiques
  jherbin-gris-nuage
  jherbin-hematite-red
  jherbin-larmes-de-cassis
  jherbin-rouille-dancre
  jherbin-stormy-grey
  kaweco-midnight-blue
  kaweco-smokey-grey
  kwz-berry
  kwz-cherry
  laban-aphrodite-pink
  laban-hera-green
  laban-hermes-sky-blue
  laban-zeus-purple
  monteverde-purple-mist
  nagasawa-strawberry-chocolate
  nagasawa-milk-chocolate
  pilot-iroshizuku-fuyu-syogun
  pilot-iroshizuku-hana-ikada
  pilot-iroshizuku-yama-budo
  robert-oster-australian-opal-blue
  robert-oster-australian-opal-pink
  robert-oster-burgundy
  robert-oster-cherry-blossom
  robert-oster-copper
  robert-oster-frankly-blue
  robert-oster-storm-summer
  robert-oster-sushi
  robert-oster-viola
  sailor-kyokkou
  sailor-manyo-nekoyanagi
  sailor-shikori-yozakura
  sailor-studio-173
  sailor-studio-237
  taccia-sunaoiro-momo
  birmingham-gumball
  birmingham-washed-lavender
  tono-lims-mizumanju
  vinta-lakambini
  vinta-sulyap
  vinta-takipsilim
  wearingeul-alice
  wearingeul-floating-cloud
  wearingeul-purgatori
  wearingeul-tsukuyami
  wearingeul-wendy-darling
  nagasawa-bitter-chocolate
  tag-kyo-no-oto-sakuranezumi
  tono-lims-miss-u
  ferris-wheel-press-peter-moss
  ferris-wheel-press-madam-mulberry
  ferris-wheel-press-bayou-berry-mist
  ferris-wheel-press-moonbeam-meadows
  ferris-wheel-press-highland-smoke
  jherbin-emerald-of-chivor
  jherbin-caroube-de-chypre
  pilot-iroshizuku-kon-peki
  pilot-iroshizuku-ku-jaku
  pilot-iroshizuku-syo-ro
  pilot-iroshizuku-sui-gyoku
  pilot-iroshizuku-syun-gyo
  pilot-iroshizuku-murasaki-shikibu
  sailor-manyo-aka-mai
  sailor-manyo-kuri
  wearingeul-metamorphosis
  wearingeul-a-watery-star
  wearingeul-a-grape-coloured-night
  wearingeul-adventures-of-tom-sawyer
  wearingeul-mad-hatter
  wearingeul-crime-and-punishment
  wearingeul-carmilla
  wearingeul-captain-hook
  wearingeul-sedna
  wearingeul-the-great-sage-heavens-equal
)

if [ "$DRY" = "1" ]; then
  echo "DRY RUN - no changes will be made. Would decrement ${#IDS[@]} inks by 1:"
  for id in "${IDS[@]}"; do echo "  add $id count=-1"; done
  echo "Re-run without --dry-run to apply."
  exit 0
fi

echo "Saving stock-before-krystle.json ..."
curl -s "$BASE?key=$KEY&action=list" > stock-before-krystle.json

echo "Decrementing ${#IDS[@]} inks by 1..."
fail=0
for id in "${IDS[@]}"; do
  resp=$(curl -s "$BASE?key=$KEY&action=add&id=$id&count=-1")
  echo "$id -> $resp"
  case "$resp" in *\"ok\":true*) ;; *) echo "  WARNING: unexpected response for $id"; fail=1;; esac
done

echo "Saving stock-after-krystle.json ..."
curl -s "$BASE?key=$KEY&action=list" > stock-after-krystle.json

if [ "$fail" = "1" ]; then
  echo "Completed WITH WARNINGS - check the lines above and the two snapshot files."
else
  echo "Done cleanly. Compare stock-before-krystle.json vs stock-after-krystle.json."
fi
