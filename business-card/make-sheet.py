"""Builds sheet.html: 10-up A4 sheets (front + back) for 85x55mm micro-perforated card stock,
plus an alignment test page. Tweak the margins below if your printer/stock needs it."""
import re
CARD_W, CARD_H = 85, 55          # trim size (mm)
COLS, ROWS = 2, 5
MARGIN_X, MARGIN_Y = 20, 11      # (210-2*85)/2 and (297-5*55)/2: cards fill the sheet, no gaps
BLEED = 1.5                      # extra art past the sheet's outer edge cards, hides small misregistration
OFFSET_X, OFFSET_Y = 0, 0        # nudge everything (mm) to compensate for printer drift

src = open('card.html').read()
style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
style = re.sub(r'@page\{[^}]*\}', '', style)
head = src[:src.index('<style>')]
front = re.search(r'<section class="card front">.*?</section>', src, re.S).group(0)
back = re.search(r'<section class="card back">.*?</section>', src, re.S).group(0)

def slot(card, c, r, bleed):
    x = MARGIN_X + OFFSET_X + c*CARD_W - bleed
    y = MARGIN_Y + OFFSET_Y + r*CARD_H - bleed
    w, h = CARD_W + 2*bleed, CARD_H + 2*bleed
    off = 3 - bleed   # card art is 91x61 with 3mm bleed
    return (f'<div class="slot" style="left:{x}mm;top:{y}mm;width:{w}mm;height:{h}mm">'
            f'<div class="art" style="left:-{off}mm;top:-{off}mm">{card}</div></div>')

def page(card):
    out = []
    # pass 1: art with bleed (visible only past the outer edge of the sheet's card block)
    for r in range(ROWS):
        for c in range(COLS):
            out.append(slot(card, c, r, BLEED))
    # pass 2: exact trim areas on top so neighbouring cards never overlap each other
    for r in range(ROWS):
        for c in range(COLS):
            out.append(slot(card, c, r, 0))
    return '<section class="sheet">' + ''.join(out) + '</section>'

def test_page():
    boxes = ''.join(
        f'<div class="tb" style="left:{MARGIN_X+OFFSET_X+c*CARD_W}mm;top:{MARGIN_Y+OFFSET_Y+r*CARD_H}mm;width:{CARD_W}mm;height:{CARD_H}mm"></div>'
        for r in range(ROWS) for c in range(COLS))
    return ('<section class="sheet">' + boxes +
            '<p class="tn">Alignment test: print at 100% / actual size on plain paper, hold it over a card sheet against a window. '
            'Each box should sit exactly on the perforations. If not, change OFFSET_X / OFFSET_Y in make-sheet.py.</p></section>')

css = style + '''
@page{size:A4;margin:0}
html,body{background:#888}
.sheet{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff;page-break-after:always}
.slot{position:absolute;overflow:hidden}
.art{position:absolute;width:91mm;height:61mm}
.slot .card{position:absolute;left:0;top:0;margin:0;box-shadow:none;page-break-after:auto}
.tb{position:absolute;border:.2mm solid #000}
.tn{position:absolute;left:20mm;right:20mm;top:3mm;font:2.6mm/1.3 sans-serif;color:#000;text-align:center}
@media screen{.sheet{margin:8mm auto;box-shadow:0 2mm 6mm rgba(0,0,0,.4)}}
'''
def doc(title, body):
    return head + '<style>' + css + '</style></head><body>' + body + '</body></html>'
open('sheet.html','w').write(doc('sheet', page(front) + page(back)))
open('alignment-test.html','w').write(doc('test', test_page()))
