import numpy as np
from PIL import Image
from skimage import data
import cv2

rng = np.random.default_rng(8)
out = "images/"


def save(name, array):
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8)).save(out + name)


save("page.png", data.page())
save("text.png", data.text())
save("coins.png", data.coins())

h, w = 400, 400
yy, xx = np.mgrid[0:h, 0:w]
mask = np.zeros((h, w), bool)
for cx, cy, r in [(90, 110, 16), (260, 80, 13), (320, 300, 18), (140, 280, 15), (220, 190, 12)]:
    mask |= (xx - cx) ** 2 + (yy - cy) ** 2 < r * r
small = np.where(mask, rng.normal(160, 15, (h, w)), rng.normal(80, 10, (h, w)))
save("small_objects.png", small)

text = data.text().astype(float)
text = cv2.resize(text, (896, 344), interpolation=cv2.INTER_AREA)
gradient = np.linspace(0.25, 1.0, text.shape[1])[None, :]
uneven = text * gradient + rng.normal(0, 4, text.shape)
save("uneven_light.png", uneven)

camera = data.camera().astype(np.float32)
save("camera_blur.png", cv2.GaussianBlur(camera, (0, 0), 2.0))
save("camera_noisy.png", camera + rng.normal(0, 25, camera.shape))
astronaut = data.astronaut().astype(np.float32)
save("astronaut_blur.png", cv2.GaussianBlur(astronaut, (0, 0), 1.8))
moon = data.moon().astype(np.float32)
save("moon_blur.png", cv2.GaussianBlur(moon, (0, 0), 1.5))
