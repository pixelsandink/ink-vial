#!/usr/bin/env python3
"""Weekly snapshot of competitor ink-sample shops (The Ink Library, Stickky).

Saves each shop's best-selling order, prices and stock to
competitor-snapshots/YYYY-MM-DD.json and writes a markdown summary of what
changed since the previous snapshot to competitor-snapshots/YYYY-MM-DD.md.

Both shops run on Shopify, so "best-selling" order comes from the shop's own
sales. It shows rank only, not quantities.

Usage: python3 scripts/competitor_snapshot.py
"""
import datetime
import glob
import html
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'competitor-snapshots')

SHOPS = {
    'ink-library': {
        'name': 'The Ink Library',
        'base': 'https://www.theinklibrary.co.uk',
        'collection': 'all',
        'sample_type': 'Ink sample',
    },
    'stickky': {
        'name': 'Stickky',
        'base': 'https://stickky.net',
        'collection': 'fountain-pen-ink-samples-uk',
        'sample_type': 'Fountain Pen Ink Sample',
    },
}


def fetch(url):
    """Fetch through curl so the environment's proxy and CA settings apply."""
    for attempt in range(3):
        r = subprocess.run(['curl', '-sSL', '--max-time', '40', url], capture_output=True)
        if r.returncode == 0 and r.stdout:
            return r.stdout.decode('utf-8', 'replace')
        time.sleep(3 * (attempt + 1))
    raise RuntimeError('could not fetch ' + url)


def products(shop):
    out = []
    for page in range(1, 6):
        url = f"{shop['base']}/collections/{shop['collection']}/products.json?limit=250&page={page}"
        batch = json.loads(fetch(url)).get('products', [])
        if not batch:
            break
        out += batch
        time.sleep(1)
    return out


def best_selling_order(shop, expected):
    order = []
    for page in range(1, 30):
        url = f"{shop['base']}/collections/{shop['collection']}?sort_by=best-selling&page={page}"
        before = len(order)
        for h in re.findall(r'href="/(?:collections/[^/"]+/)?products/([a-z0-9\-]+)', fetch(url)):
            if h not in order:
                order.append(h)
        if len(order) == before or len(order) >= expected:
            break
        time.sleep(2)
    return order


def brand_of(p):
    # Stickky lists every ink under its own vendor name; the real brand is in
    # the description as "Brand: X Ink Name: Y".
    body = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', p.get('body_html') or '')))
    m = re.search(r'Brand:\s*(.+?)\s+Ink Name:', body)
    return (m.group(1) if m else p['vendor']).strip()


def sample_price(p):
    """Price of the smallest sample size, with its size, e.g. (2.0, '4ml')."""
    best = None
    for v in p['variants']:
        t = ' '.join(x for x in (v.get('title'), v.get('option1')) if x)
        m = re.search(r'(\d+(?:\.\d+)?)\s*ml', t, re.I)
        if not m or 'bottle' in t.lower():
            continue
        ml = float(m.group(1))
        if best is None or ml < best[1]:
            best = (float(v['price']), ml)
    return best


def snapshot():
    snap = {'date': datetime.date.today().isoformat(), 'shops': {}}
    for key, shop in SHOPS.items():
        ps = [p for p in products(shop) if p.get('product_type') == shop['sample_type']]
        order = best_selling_order(shop, len(ps))
        rank = {h: i + 1 for i, h in enumerate(order)}
        items = []
        for p in ps:
            sp = sample_price(p)
            items.append({
                'handle': p['handle'], 'title': p['title'], 'brand': brand_of(p),
                'price': sp[0] if sp else None, 'ml': sp[1] if sp else None,
                'available': any(v['available'] for v in p['variants']),
                'rank': rank.get(p['handle']), 'created': p['created_at'][:10],
            })
        snap['shops'][key] = {'name': shop['name'], 'count': len(items), 'items': items}
    return snap


def summary(cur, prev):
    lines = [f"# Competitor snapshot – {cur['date']}", '']
    if prev:
        lines += [f"Compared with {prev['date']}.", '']
    for key, shop in cur['shops'].items():
        items = {i['handle']: i for i in shop['items']}
        old = {i['handle']: i for i in prev['shops'][key]['items']} if prev and key in prev['shops'] else {}
        n = shop['count']
        lines += [f"## {shop['name']}", '']
        lines.append(f"- **{n} inks** ({sum(i['available'] for i in items.values())} in stock)"
                     + (f", was {len(old)}" if old else ''))
        added = [i for h, i in items.items() if old and h not in old]
        gone = [i for h, i in old.items() if h not in items]
        if added:
            lines.append(f"- **Added ({len(added)}):** " + ', '.join(f"{i['brand']} {i['title']}" for i in added))
        if gone:
            lines.append(f"- **Removed ({len(gone)}):** " + ', '.join(f"{i['brand']} {i['title']}" for i in gone))
        changed = [(old[h], i) for h, i in items.items() if h in old and i['price'] != old[h]['price']]
        if changed:
            lines.append('- **Price changes:** ' + ', '.join(
                f"{i['brand']} {i['title']} £{o['price']:.2f}→£{i['price']:.2f}" for o, i in changed))
        sold_out = [i for h, i in items.items() if h in old and old[h]['available'] and not i['available']]
        if sold_out:
            lines.append('- **Newly sold out (a sign of demand):** ' + ', '.join(f"{i['brand']} {i['title']}" for i in sold_out))

        ranked = sorted((i for i in items.values() if i['rank']), key=lambda i: i['rank'])
        lines += ['', '**Top 15 best sellers:**', '']
        for i in ranked[:15]:
            move = ''
            if i['handle'] in old and old[i['handle']]['rank']:
                d = old[i['handle']]['rank'] - i['rank']
                move = f" (↑{d})" if d > 0 else (f" (↓{-d})" if d < 0 else '')
            elif old:
                move = ' (new)'
            lines.append(f"{i['rank']}. {i['brand']} – {i['title']}{move}")

        climbers = sorted(((old[h]['rank'] - i['rank'], i) for h, i in items.items()
                           if h in old and i['rank'] and old[h]['rank'] and old[h]['rank'] - i['rank'] >= n * 0.15),
                          key=lambda x: -x[0])[:10]
        if climbers:
            lines += ['', '**Biggest climbers (selling faster this week):** '
                      + ', '.join(f"{i['brand']} {i['title']} ↑{d}" for d, i in climbers)]

        brands = {}
        for i in ranked:
            brands.setdefault(i['brand'], []).append(i['rank'])
        top_brands = sorted(brands.items(), key=lambda b: sum(b[1]) / len(b[1]))
        lines += ['', '**Brands by average best-seller position (lower % = selling better):**', '']
        lines.append(', '.join(f"{b} ({round(100 * sum(r) / len(r) / n)}%)" for b, r in top_brands if len(r) >= 2))
        lines.append('')
    lines.append('_Best-selling order is each shop\'s own Shopify sales ranking; it shows order, not quantities. '
                 'Inks with no sales yet sit at the bottom in no particular order._')
    return '\n'.join(lines) + '\n'


def main():
    os.makedirs(OUT, exist_ok=True)
    cur = snapshot()
    previous = sorted(p for p in glob.glob(os.path.join(OUT, '*.json'))
                      if os.path.basename(p) != cur['date'] + '.json')
    prev = json.load(open(previous[-1])) if previous else None
    with open(os.path.join(OUT, cur['date'] + '.json'), 'w') as f:
        json.dump(cur, f, indent=1, ensure_ascii=False)
    md = summary(cur, prev)
    with open(os.path.join(OUT, cur['date'] + '.md'), 'w') as f:
        f.write(md)
    sys.stdout.write(md)


if __name__ == '__main__':
    main()
