#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
为 NAS 目录生成带索引的联系表（contact sheet），供人工/视觉模型逐张甄别。

每格左上角标一个全局序号，配套生成 _index.json 记录 序号 → 完整相对路径，
避免在图上塞长文件名看不清。

用法：
    python scripts/nas-contact-sheets.py --src "新疆/新疆伊犁" --tag ili
    python scripts/nas-contact-sheets.py --src "国家植物园" --tag plants --cols 6 --rows 5
    python scripts/nas-contact-sheets.py --src "天津" --tag tj --exclude "小墨"

产物（默认写到 .workbuddy/tmp/sheets/<tag>/）：
    sheet_001.jpg ...
    _index.json   { "sheets": {"sheet_001.jpg": [{"n":1,"file":"...","path":"..."}]} }
"""

import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("[ERR] 需要 Pillow: python -m pip install Pillow -i https://pypi.org/simple",
          file=sys.stderr)
    raise SystemExit(1)

NAS_ROOT = "//192.168.8.1/YiMeng云盘/图片"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BASE = os.path.join(ROOT, ".workbuddy", "tmp", "sheets")

IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic")


def collect(src_dir: str, exclude: list) -> list:
    """递归收集图片，返回 (绝对路径, 相对 NAS 根的相对路径)。"""
    out = []
    for dirpath, dirnames, names in os.walk(src_dir):
        dirnames[:] = [d for d in dirnames if not any(e in d for e in exclude)]
        for n in sorted(names):
            if n.lower().endswith(IMG_EXT) and not any(e in n for e in exclude):
                out.append(os.path.join(dirpath, n))
    return sorted(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="NAS 相对目录，如 国家植物园")
    ap.add_argument("--root", help="根目录，默认为 NAS 图片根；也可指向仓库内的图片目录")
    ap.add_argument("--tag", required=True, help="产物标签")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--rows", type=int, default=5)
    ap.add_argument("--thumb", type=int, default=250, help="单格边长")
    ap.add_argument("--exclude", nargs="*", default=[], help="排除的路径片段")
    ap.add_argument("--with-variants", action="store_true",
                    help="连 -sm/-t 缩略图一起收（默认只收主图）")
    ap.add_argument("--out", help="输出目录，默认 .workbuddy/tmp/sheets/<tag>")
    args = ap.parse_args()

    base_root = args.root or NAS_ROOT
    src_dir = os.path.join(base_root, args.src.replace("/", os.sep))
    if not os.path.isdir(src_dir):
        print(f"[ERR] 目录不存在: {src_dir}", file=sys.stderr)
        return 1

    files = collect(src_dir, args.exclude)
    if not args.with_variants:
        files = [f for f in files
                 if not f.lower().endswith("-sm.webp") and not f.lower().endswith("-t.webp")]
    if not files:
        print(f"[ERR] 目录内没有图片: {args.src}")
        return 1

    out_dir = args.out or os.path.join(OUT_BASE, args.tag)
    os.makedirs(out_dir, exist_ok=True)

    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
    except OSError:
        font = ImageFont.load_default()

    per = args.cols * args.rows
    th = args.thumb
    index = {"source": args.src, "root": base_root, "total": len(files), "sheets": {}}

    for pg in range(0, len(files), per):
        chunk = files[pg:pg + per]
        rows = (len(chunk) + args.cols - 1) // args.cols
        sheet = Image.new("RGB", (th * args.cols, (th + 26) * rows), (18, 18, 18))
        d = ImageDraw.Draw(sheet)
        entries = []
        for i, path in enumerate(chunk):
            num = pg + i + 1
            try:
                im = Image.open(path).convert("RGB")
                im.thumbnail((th - 6, th - 6))
                x = (i % args.cols) * th + (th - im.width) // 2
                y = (i // args.cols) * (th + 26) + (th - im.height) // 2
                sheet.paste(im, (x, y))
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] 无法解码 {path}: {exc}", file=sys.stderr)
            # 左上角大号序号
            d.rectangle([(i % args.cols) * th, (i // args.cols) * (th + 26),
                         (i % args.cols) * th + 46, (i // args.cols) * (th + 26) + 34],
                        fill=(0, 0, 0))
            d.text(((i % args.cols) * th + 8, (i // args.cols) * (th + 26) + 4),
                   f"#{num}", fill=(255, 215, 0), font=font)
            entries.append({
                "n": num,
                "file": os.path.basename(path),
                "path": os.path.relpath(path, base_root).replace(os.sep, "/"),
            })
        name = f"sheet_{pg // per + 1:03d}.jpg"
        sheet.save(os.path.join(out_dir, name), quality=82)
        index["sheets"][name] = entries
        print(f"[OK] {name}  #{pg + 1}-#{pg + len(chunk)}")

    with open(os.path.join(out_dir, "_index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=1)
    print(f"[INFO] 共 {len(files)} 张，输出到 {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
