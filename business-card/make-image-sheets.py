"""Places the card PNGs on A4 for the Herlitz 10-up sheet and writes HTML for PDF export.

TRUE sheet layout (mm): cards 85x55, left strip 15, gap between columns 10, top 10.
Some printers shrink the page to fit their printable area. If that happens, the *compensated*
variants pre-enlarge everything by 1/SCALE and shift by -OFF so it lands on the perforations.
Estimated from a photo of a real print on a Canon iX6800: SCALE ~0.97, OFF ~(2.7, 3.0) mm.
Tune SCALE_X/SCALE_Y/OFF_X/OFF_Y after measuring the calibration print."""
CARD_W, CARD_H = 85, 55
LEFT, TOP, GAP = 15, 10, 10
COLS, ROWS = 2, 5
SCALE_X, SCALE_Y = 0.9706, 0.970
OFF_X, OFF_Y = 2.67, 3.0

def page(img, comp=False, outline=False, note=''):
    kx, ky, ox, oy = (SCALE_X, SCALE_Y, OFF_X, OFF_Y) if comp else (1, 1, 0, 0)
    w, h = CARD_W/kx, CARD_H/ky
    cells = ''
    for r in range(ROWS):
        for c in range(COLS):
            x = (LEFT + c*(CARD_W+GAP) - ox)/kx
            y = (TOP + r*CARD_H - oy)/ky
            cells += f'<img src="{img}" class="c{" o" if outline else ""}" style="left:{x:.3f}mm;top:{y:.3f}mm;width:{w:.3f}mm;height:{h:.3f}mm">'
    return f'<section class="s">{cells}{note}</section>'

css = '''@page{size:A4;margin:0}*{margin:0;padding:0}html,body{background:#fff}
.s{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.c{position:absolute;display:block}
.o{outline:.2mm solid #000;outline-offset:-.1mm}
.n{position:absolute;left:15mm;right:15mm;top:2.5mm;font:2.6mm/1.3 sans-serif;text-align:center}'''
def doc(body): return f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
note = '<p class="n">Alignment test: print at Actual size on plain paper, hold over a card sheet against a window. Outlines should sit on the perforations.</p>'
F, B = 'inkvial-card-event-front.png', 'inkvial-card-event-back.png'
for suffix, comp in (('', False), ('-compensated', True)):
    open(f'sheet-front{suffix}.html','w').write(doc(page(F, comp)))
    open(f'sheet-back{suffix}.html','w').write(doc(page(B, comp)))
    open(f'sheet-test{suffix}.html','w').write(doc(page(F, comp, True, note)))
