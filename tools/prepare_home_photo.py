"""
Makes the web copy of the home-screen photo.

  python3 tools/prepare_home_photo.py        (needs Pillow)

Reads public/images/home_me.png (a transparent-background PNG) and writes
public/images/home_me_web.webp:

1. Crops to the person and scales the longest side to MAX_SIDE.
2. Tones down the cut-out fringe. Semi-transparent pixels still carry colour from
   the original background (a bright halo around hair and shoulders on a dark page),
   so they are darkened in proportion to how transparent they are. Hair detail is
   left alone: nothing is blurred, smeared or re-coloured.

The original file is never modified.
"""
from PIL import Image

SRC = "public/images/home_me.png"
DST = "public/images/home_me_web.webp"
MAX_SIDE = 1600
FRINGE = 0.3  # brightness kept by a fully transparent fringe pixel

im = Image.open(SRC).convert("RGBA")
im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 0 else 0).getbbox())
im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)

r, g, b, a = im.split()
# Fully opaque pixels keep their colour; the more transparent a pixel is, the more its
# leftover background colour is darkened away.
px = im.load()
w, h = im.size
for y in range(h):
    for x in range(w):
        cr, cg, cb, ca = px[x, y]
        if ca == 255 or ca == 0:
            continue
        k = FRINGE + (1 - FRINGE) * (ca / 255)
        px[x, y] = (int(cr * k), int(cg * k), int(cb * k), ca)

im.save(DST, "WEBP", quality=92, method=6, exact=True)
print(DST, im.size)
