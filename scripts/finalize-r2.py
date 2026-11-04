#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
R2 凭据到位后的上线收尾脚本（幂等，可重复执行）。

依次完成：
  1. 把文章 front matter 里的 `https://__R2_BASE__` 占位符替换为真实 R2 域名
  2. 把 .workbuddy/tmp/picked/add-<slug>.txt 的补图 URL 追加到对应文章
     的 photos 列表末尾（中文版与英文版同步）
  3. 把新文章的 `draft: true` 改回 `draft: false`

前置条件：
  - .env 已写入 R2_PUBLIC_BASE 等凭据
  - 已执行 scripts/upload-to-r2.py --from-staging（图片确实在 R2 上）
  - data/photo_meta_r2.json 已生成

用法：
    python scripts/finalize-r2.py --check   # 只检查，不改动
    python scripts/finalize-r2.py           # 实际执行
"""

import argparse
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLACEHOLDER = "https://__R2_BASE__"
PICKED = os.path.join(ROOT, ".workbuddy", "tmp", "picked")
POSTS = os.path.join(ROOT, "content", "posts")
META_R2 = os.path.join(ROOT, "data", "photo_meta_r2.json")

# 新文章 slug（上线时去掉 draft）
NEW_POSTS = (
    "beijing-still-life-2026",
    "taikang-temple-and-museum",
    "beijing-jingshan-clouds-and-city",
    "beijing-shougang-bridge-sunset",
    "beijing-shichahai-lotus",
    "beijing-waterbirds",
)


def public_base() -> str:
    base = os.environ.get("R2_PUBLIC_BASE")
    if not base:
        env = os.path.join(ROOT, ".env")
        if os.path.isfile(env):
            for line in open(env, encoding="utf-8-sig"):
                m = re.match(r"\s*R2_PUBLIC_BASE\s*=\s*(.+)", line)
                if m:
                    base = m.group(1).strip().strip('"').strip("'")
                    break
    if not base:
        print("[ERR] 未找到 R2_PUBLIC_BASE（环境变量或 .env）", file=sys.stderr)
        raise SystemExit(1)
    return base.rstrip("/")


def add_lines_to_photos(text: str, urls: list) -> tuple:
    """在 front matter 的 photos 列表末尾插入 URL。返回 (新文本, 插入数)。"""
    lines = text.split("\n")
    # 定位 front matter
    if not lines or lines[0].strip() != "---":
        return text, 0
    try:
        end = lines.index("---", 1)
    except ValueError:
        return text, 0

    try:
        pstart = next(i for i in range(1, end) if lines[i].strip() == "photos:")
    except StopIteration:
        return text, 0

    pend = pstart + 1
    while pend < end and re.match(r"^\s+-\s+\S", lines[pend]):
        pend += 1

    existing = "\n".join(lines[pstart:pend])
    to_add = [f"  - {u}" for u in urls if u not in existing]
    if not to_add:
        return text, 0
    lines[pend:pend] = to_add
    return "\n".join(lines), len(to_add)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只检查，不改动文件")
    args = ap.parse_args()

    base = public_base()
    if not os.path.isfile(META_R2):
        print(f"[ERR] {META_R2} 不存在，请先执行 upload-to-r2.py --from-staging",
              file=sys.stderr)
        return 1
    print(f"[INFO] R2_PUBLIC_BASE = {base}")

    # 补图 URL 映射
    add_map = {}
    for p in sorted(glob.glob(os.path.join(PICKED, "add-*.txt"))):
        slug = os.path.basename(p)[4:-4]
        paths = [l.strip() for l in open(p, encoding="utf-8") if l.strip()
                 and not l.startswith("#")]
        # 起始编号 = 现有 photos 数 + 1
        zh = os.path.join(POSTS, slug + ".md")
        if not os.path.isfile(zh):
            print(f"[WARN] 找不到文章，跳过补图: {slug}")
            continue
        text = open(zh, encoding="utf-8").read()
        fm = text.split("---", 2)[1] if text.startswith("---") else ""
        start = len(re.findall(r"^\s*-\s*https?://", fm, re.M)) + 1
        add_map[slug] = [f"{base}/posts/{slug}/{n:02d}.webp"
                         for n in range(start, start + len(paths))]

    changed = []
    for path in sorted(glob.glob(os.path.join(POSTS, "*.md"))):
        raw = open(path, "rb").read()
        text = raw.decode("utf-8")
        orig = text
        slug = os.path.basename(path)[:-3]
        if slug.endswith(".en"):
            slug = slug[:-3]

        if PLACEHOLDER in text:
            text = text.replace(PLACEHOLDER, base)

        if slug in add_map:
            text, n = add_lines_to_photos(text, add_map[slug])
            if n:
                print(f"[ADD ] {os.path.basename(path):<38} +{n} 张补图")

        slug_full = os.path.basename(path)[:-3]
        if any(slug_full == s or slug_full == s + ".en" for s in NEW_POSTS):
            text = text.replace("draft: true", "draft: false", 1)

        if text != orig:
            # 统一 LF，UTF-8 无 BOM
            changed.append(os.path.basename(path))
            if not args.check:
                with open(path, "wb") as fh:
                    fh.write(text.encode("utf-8"))

    print(f"[INFO] {'将修改' if args.check else '已修改'} {len(changed)} 个文件: "
          f"{', '.join(changed[:8])}{' ...' if len(changed) > 8 else ''}")
    if args.check:
        print("[CHECK] 未写入任何文件")
        return 0

    # 自检
    left = []
    for path in glob.glob(os.path.join(POSTS, "*.md")):
        b = open(path, "rb").read()
        if PLACEHOLDER.encode() in b:
            left.append(os.path.basename(path))
        if b'\r\n' in b or b[:3] == b'\xef\xbb\xbf':
            print(f"[WARN] 行尾/BOM 异常: {os.path.basename(path)}")
    if left:
        print(f"[WARN] 仍有占位符: {left}")
    else:
        print("[OK] 所有占位符已替换")
    print("[NEXT] git add -A && git commit && git push")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
