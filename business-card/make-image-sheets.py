"""Places the card PNGs on A4 at the Herlitz 10-up layout and writes HTML for PDF export.
Edit MARGIN_X / MARGIN_Y / GAP / OFFSET_* if your sheet or printer needs it."""
CARD_W, CARD_H = 85, 55
MARGIN_X, MARGIN_Y, GAP = 12.5, 11, 15
OFFSET_X, OFFSET_Y = 0, 0
COLS, ROWS = 2, 5

def page(img, outline=False, note=''):
    cells = ''.join(
        f'<img src="{img}" class="c{" o" if outline else ""}" style="left:{MARGIN_X+OFFSET_X+c*(CARD_W+GAP)}mm;top:{MARGIN_Y+OFFSET_Y+r*CARD_H}mm">'
        for r in range(ROWS) for c in range(COLS))
    return f'<section class="s">{cells}{note}</section>'

css = '''@page{size:A4;margin:0}*{margin:0;padding:0}html,body{background:#fff}
.s{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.c{position:absolute;width:85mm;height:55mm;display:block}
.o{outline:.2mm solid #000;outline-offset:-.1mm}
.n{position:absolute;left:12.5mm;right:12.5mm;top:3mm;font:2.6mm/1.3 sans-serif;text-align:center}'''
def doc(body): return f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
note = '<p class="n">Alignment test: print at Actual size on plain paper, hold over a card sheet against a window. Outlines should sit on the perforations.</p>'
open('sheet-front.html','w').write(doc(page('inkvial-card-event-front.png')))
open('sheet-back.html','w').write(doc(page('inkvial-card-event-back.png')))
open('sheet-test.html','w').write(doc(page('inkvial-card-event-front.png', True, note)))
