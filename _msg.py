#!/usr/bin/env python3
import os, subprocess
content = """fix: 头像重裁切 (只留头部,避开手机+手+手串+T恤)

用户反馈: '头像裁切的不太合适,我给你发一下我裁切的替换一下吧'
用户发了新图 b38e70e5 (1080x1080 vivo X Fold 镜面自拍)。

旧头像 (2ce418e2 时裁的 540x540) 缺点:
- 脸在下半部分, 上方留白多
- 用户觉得不自然

新裁切 (static/avatar/default.jpg + .webp):
- 原图 1080x1080
- crop_box (280, 140, 800, 640) = 520x500
- resize 到 512x512 (LANCZOS)
- 只留 头部 + 颈部
- 完全避开 vivo X Fold 手机、手、手串、T恤
- 头发洒落, 木门背景做衬托
- 表情自然

files: static/avatar/default.jpg (31KB)
       static/avatar/default.webp (12KB)
"""

# Write UTF-8 without BOM
with open('_msg_utf8.txt', 'wb') as f:
    f.write(content.encode('utf-8'))
print(f"wrote {len(content.encode('utf-8'))} bytes UTF-8")
r = subprocess.run(['git', 'commit', '--amend', '-F', '_msg_utf8.txt'], capture_output=True, text=True)
print(r.stdout)
print(r.stderr)