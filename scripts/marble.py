"""Generate the original, bundled marble texture. No remote image dependency."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
width, height = 720, 1440
y, x = np.mgrid[0:height, 0:width].astype(float)
rng = np.random.default_rng(19)
cloud = np.zeros((height, width))
for size, weight in [(8, 1), (24, .4), (64, .16)]:
    noise = Image.fromarray(rng.integers(0, 255, (size*2, size), dtype=np.uint8))
    cloud += (np.asarray(noise.resize((width, height), Image.Resampling.BICUBIC))/255-.5)*weight
base = np.clip(247 + cloud*10, 235, 253)
veins = np.zeros_like(base)
for offset, strength in [(70, 100), (490, 78), (900, 66), (1290, 95)]:
    curve = offset + .58*x + 35*np.sin(x/87+offset) + 21*np.sin(x/33+offset*.1) + cloud*34
    d = np.abs(y-curve)
    veins += strength*np.exp(-(d/1.5)**2) + 24*np.exp(-(d/7)**2) + 9*np.exp(-(d/24)**2)
    branch = offset+140+.15*x+19*np.sin(x/61)+cloud*25
    veins += 30*np.exp(-((y-branch)/1.2)**2)*np.clip(1-np.abs(x-340)/260,0,1)
shade = np.clip(base-veins, 60, 255)
rgb = np.stack([shade, np.clip(shade+.6,0,255), np.clip(shade+1.3,0,255)],axis=-1).astype(np.uint8)
image = Image.fromarray(rgb).filter(ImageFilter.GaussianBlur(.35))
image.save(root/'assets/marble.jpg', quality=88, optimize=True)
print('Generated assets/marble.jpg')
