#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成 data/photo_meta.json —— 记录每篇文章配图的真实宽高，供模板做「按比例排版」。

背景：
  站点图片托管在 static/images/uploads/posts/<slug>/NN.webp，
  Hugo 的 resources.Get 只认 assets/ 目录，static/ 下的图片拿不到尺寸，
  所以在构建前用 PIL 量一次，落成 JSON 供模板读取。

输出结构：
  {
    "<slug>/<NN>.webp": { "w": 2000, "h": 837, "r": 2.39, "cls": "banner", "sm": true },
    ...
  }

cls 分类规则（模板据此决定跨列数与排版方式）：
  banner  r >= 2.0   超宽横幅，独占整行
  wide    r >= 1.25  标准横向
  square  r >= 0.95  接近方形
  tall    r <  0.95  竖版

sm 标记：该主图是否存在 -sm.webp（800px）变体。图片迁到 R2 后不再存在于仓库，
   模板不能靠 fileExists 判断，改用这个标记。
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_ROOT = os.path.join(ROOT, "static", "images", "uploads", "posts")
OUT = os.path.join(ROOT, "data", "photo_meta.json")

VARIANT_SUFFIXES = ("-sm.webp", "-t.webp")


def classify(ratio: float) -> str:
    if ratio >= 2.0:
        return "banner"
    if ratio >= 1.25:
        return "wide"
    if ratio >= 0.95:
        return "square"
    return "tall"


def main() -> int:
    if not os.path.isdir(IMG_ROOT):
        print(f"[ERR] 图片目录不存在: {IMG_ROOT}", file=sys.stderr)
        return 1

    try:
        from PIL import Image
    except ImportError:
        print("[ERR] 需要 Pillow: pip install Pillow", file=sys.stderr)
        return 1

    meta = {}
    for slug in sorted(os.listdir(IMG_ROOT)):
        slug_dir = os.path.join(IMG_ROOT, slug)
        if not os.path.isdir(slug_dir):
            continue
        for name in sorted(os.listdir(slug_dir)):
            if not name.endswith(".webp"):
                continue
            # 缩略图变体不单独建条目（-sm / -t）
            if any(name.endswith(sfx) for sfx in VARIANT_SUFFIXES):
                continue
            path = os.path.join(slug_dir, name)
            try:
                with Image.open(path) as im:
                    w, h = im.width, im.height
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] 读取失败 {slug}/{name}: {exc}", file=sys.stderr)
                continue
            ratio = round(w / h, 4)
            meta[f"{slug}/{name}"] = {
                "w": w,
                "h": h,
                "r": ratio,
                "cls": classify(ratio),
                "sm": os.path.isfile(os.path.join(slug_dir, name[:-5] + "-sm.webp")),
                "t": os.path.isfile(os.path.join(slug_dir, name[:-5] + "-t.webp")),
            }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1, sort_keys=True)

    buckets = {}
    for item in meta.values():
        buckets[item["cls"]] = buckets.get(item["cls"], 0) + 1
    print(f"[OK] 写入 {OUT}：{len(meta)} 张  分布={buckets}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
