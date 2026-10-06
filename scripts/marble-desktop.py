"""Generate a landscape companion texture with veins sized for desktop screens."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
width, height = 2560, 1440
y, x = np.mgrid[0:height, 0:width].astype(float)
rng = np.random.default_rng(19)
cloud = np.zeros((height, width))
for size, weight in [(8, 1), (24, .4), (64, .16)]:
    noise = Image.fromarray(rng.integers(0, 255, (size, round(size * width / height)), dtype=np.uint8))
    cloud += (np.asarray(noise.resize((width, height), Image.Resampling.BICUBIC)) / 255 - .5) * weight
base = np.clip(247 + cloud * 10, 235, 253)
veins = np.zeros_like(base)
for offset, strength in [(-300, 78), (70, 88), (490, 70), (900, 66), (1290, 80)]:
    curve = offset + .30 * x + 35 * np.sin(x / 160 + offset) + 17 * np.sin(x / 65 + offset * .1) + cloud * 34
    distance = np.abs(y - curve)
    veins += strength * np.exp(-(distance / 1.2) ** 2) + 16 * np.exp(-(distance / 4) ** 2) + 5 * np.exp(-(distance / 16) ** 2)
    branch = offset + 140 + .09 * x + 19 * np.sin(x / 110) + cloud * 25
    veins += 26 * np.exp(-((y - branch) / 1.0) ** 2) * np.clip(1 - np.abs(x - 1200) / 750, 0, 1)
shade = np.clip(base - veins, 60, 255)
rgb = np.stack([shade, np.clip(shade + .6, 0, 255), np.clip(shade + 1.3, 0, 255)], axis=-1).astype(np.uint8)
Image.fromarray(rgb).filter(ImageFilter.GaussianBlur(.25)).save(root / 'assets/marble-desktop.jpg', quality=90, optimize=True)
print('Generated assets/marble-desktop.jpg (2560 × 1440)')
