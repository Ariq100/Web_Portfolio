"""
Makes the web copy of the home-screen photo.

  python3 tools/prepare_home_photo.py        (needs Pillow and numpy)

Reads public/images/home_me.png (a transparent-background PNG) and writes
public/images/home_me_web.webp:

1. Crops to the person and scales the longest side to MAX_SIDE.
2. Cleans the cut-out edge. The source's soft edge still carries colour from the
   original background (a yellow-green rim that reads as a ghost outline on a dark
   page). The semi-transparent rim, plus EDGE_BAND px inside it, gets its colour
   re-sampled from just inside the person, and the edge is pulled in by SHRINK px with
   a FEATHER px blur. Interior detail is untouched.

The original file is never modified.
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = "public/images/home_me.png"
DST = "public/images/home_me_web.webp"
MAX_SIDE = 1600
EDGE_BAND = 3   # px inside the soft edge whose colour is also replaced
SHRINK = 2      # px the edge is pulled inward
FEATHER = 1.2   # px blur on the final edge


def erode(mask: Image.Image, px: int) -> Image.Image:
    # Repeated 3×3 min filters approximate a round erosion without huge kernels.
    for _ in range(px):
        mask = mask.filter(ImageFilter.MinFilter(3))
    return mask


im = Image.open(SRC).convert("RGBA")
im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 0 else 0).getbbox())
im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)

rgb = np.asarray(im, dtype=np.float32)[..., :3]
alpha = im.getchannel("A")

# Colour from the clean interior, spread outward into the edge band.
core = erode(alpha.point(lambda a: 255 if a > 250 else 0), EDGE_BAND)
core_f = np.asarray(core, dtype=np.float32) / 255
spread_rgb = np.zeros_like(rgb)
spread_w = np.zeros(core_f.shape, dtype=np.float32)
for radius in (3, 6, 12, 24):
    w = np.asarray(Image.fromarray((core_f * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255
    c = np.stack([
        np.asarray(Image.fromarray((rgb[..., i] * core_f).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)
        for i in range(3)
    ], -1)
    # Take the tightest blur that reaches each pixel, so colour stays local.
    take = (spread_w < 0.02) & (w > 0.02)
    spread_rgb[take] = c[take] / w[take, None]
    spread_w[take] = w[take]

band = (core_f < 0.5) & (spread_w > 0.02)
out_rgb = rgb.copy()
out_rgb[band] = spread_rgb[band]

new_alpha = erode(alpha, SHRINK).filter(ImageFilter.GaussianBlur(FEATHER))
out = Image.fromarray(np.dstack([out_rgb.clip(0, 255), np.asarray(new_alpha, dtype=np.float32)]).astype(np.uint8))
out.save(DST, "WEBP", quality=92, method=6, exact=True)
print(DST, out.size, "edge pixels recoloured:", int(band.sum()))
