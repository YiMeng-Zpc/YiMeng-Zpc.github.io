"""直接把用户发的原图作为头像 (不需要裁切)"""
from PIL import Image
import os

src = r"C:\Users\忆梦\.openclaw-ai\media\inbound\b38e70e5-9f32-4000-ae3f-7ba6d3ba3eab.jpg"
img = Image.open(src)
w, h = img.size
print(f"原图: {w}x{h}")

# 用户明确: 不需要避开手机, 直接用原图
# 但原图不是正方形 (1080x1080 这次是正方形), 直接 resize 到 512x512
out = img.resize((512, 512), Image.LANCZOS)

jpg_path = r"C:\Users\忆梦\Documents\GitHub\YiMeng-Zpc.github.io\static\avatar\default.jpg"
out.save(jpg_path, "JPEG", quality=90, optimize=True)
print(f"jpg: {os.path.getsize(jpg_path)} bytes")

webp_path = r"C:\Users\忆梦\Documents\GitHub\YiMeng-Zpc.github.io\static\avatar\default.webp"
out.save(webp_path, "WEBP", quality=85)
print(f"webp: {os.path.getsize(webp_path)} bytes")

# 检查用副本
check_path = r"C:\Users\忆梦\.openclaw-ai\workspace\avatar_check.jpg"
out.save(check_path, "JPEG", quality=90)
print(f"check: {check_path}")