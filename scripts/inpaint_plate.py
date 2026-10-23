"""Interim plate: classic inpainting of Nox and text out of panel 2 (until generated plates exist)."""
import cv2
import numpy as np
img = cv2.imread('spike-out/plates/panel2-1024.png')
alpha = cv2.imread('spike-out/plates/panel2-mask.png', cv2.IMREAD_UNCHANGED)[:, :, 3]
hole = (alpha == 0).astype(np.uint8) * 255
# Inpaint at half resolution for broader, smoother fills, then upsample and merge.
small = cv2.resize(img, (512, 512), interpolation=cv2.INTER_AREA)
small_hole = cv2.resize(hole, (512, 512), interpolation=cv2.INTER_NEAREST)
filled = cv2.inpaint(small, small_hole, 18, cv2.INPAINT_TELEA)
filled = cv2.GaussianBlur(filled, (0, 0), 6)
up = cv2.resize(filled, (1024, 1024), interpolation=cv2.INTER_CUBIC)
# Grow before feathering so the original never shows through inside the hole.
grown = cv2.dilate(hole, np.ones((25, 25), np.uint8))
soft = cv2.GaussianBlur(grown, (0, 0), 8).astype(np.float32)[..., None] / 255.0
out = (img * (1 - soft) + up * soft).astype(np.uint8)
cv2.imwrite('spike-out/plates/plate-inpaint.png', out)
print('saved')
