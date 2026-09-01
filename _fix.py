#!/usr/bin/env python3
import os, subprocess, sys

# 1) 改 hugo.toml 标题 (UTF-8 byte-level editing)
with open('hugo.toml', 'rb') as f:
    raw = f.read()

# 用 UTF-8 字符串找
old1 = "title = '张鹏超的博客'".encode('utf-8')
new1 = "title = '张鹏超'".encode('utf-8')
count = raw.count(old1)
print(f"L3/L12 title 替换次数: {count}")
raw = raw.replace(old1, new1)

with open('hugo.toml', 'wb') as f:
    f.write(raw)
print("hugo.toml saved")

# 验证
with open('hugo.toml', 'rb') as f:
    raw = f.read()
import re
for m in re.finditer(b"title = '([^']+)'", raw):
    print(f"  found title: {m.group(1).decode('utf-8')}")