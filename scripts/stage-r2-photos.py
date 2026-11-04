#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把 .workbuddy/tmp/picked/ 下的选图清单预压缩为三档 WebP，生成 R2 上传计划。

用途：R2 凭据尚未配置时，先把耗时的图片压缩与尺寸量取做完并落地暂存。
等 .env 配好后，用 `python scripts/upload-to-r2.py --from-staging` 一键上传。

映射规则：
  gear.txt            -> beijing-still-life-2026，编号从 01 起
  sep2025.txt         -> taikang-temple-and-museum，编号从 01 起
  add-<slug>.txt      -> 已有文章 <slug>，编号从「现有 photos 数 + 1」起

产物（全部在 .workbuddy/tmp/staging/，已被 .gitignore 忽略）：
  <slug>/NN.webp / NN-sm.webp / NN-t.webp
  _plan.json         上传计划（slug、起始编号、R2 key、原图路径、宽高、分档）
  photo_meta_r2.json 待写入 data/ 的元数据草稿（URL 待 R2 就绪后补）
"""

import glob
import json
import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    print("[ERR] 需要 Pillow: python -m pip install Pillow -i https://pypi.org/simple",
          file=sys.stderr)
    raise SystemExit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAS_ROOT = "//192.168.8.1/YiMeng云盘/图片"
PICKED = os.path.join(ROOT, ".workbuddy", "tmp", "picked")
STAGING = os.path.join(ROOT, ".workbuddy", "tmp", "staging")
BLACKLIST = os.environ.get(
    "NAS_BLACKLIST",
    os.path.join(os.path.dirname(ROOT), ".workbuddy", "tmp", "sensitive-files.txt"),
)

# 新文章：清单文件名 -> (slug, 起始编号)
NEW_ARTICLES = {
    "gear.txt": ("beijing-still-life-2026", 1),
    "sep2025.txt": ("taikang-temple-and-museum", 1),
}

VARIANTS = (("", 2000, 80), ("-sm", 800, 80), ("-t", 240, 70))


def classify(ratio: float) -> str:
    if ratio >= 2.0:
        return "banner"
    if ratio >= 1.25:
        return "wide"
    if ratio >= 0.95:
        return "square"
    return "tall"


def load_blacklist() -> set:
    if not os.path.exists(BLACKLIST):
        print(f"[ERR] 证件照黑名单不存在: {BLACKLIST}\n"
              f"       请先完成敏感信息筛查（sensitive-files.txt）再处理图片。",
              file=sys.stderr)
        raise SystemExit(1)
    out = set()
    with open(BLACKLIST, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#"):
                out.add(os.path.normpath(line).lower())
    print(f"[OK] 已加载黑名单 {len(out)} 条")
    return out


def is_blacklisted(path: str, blacklist: set) -> bool:
    p = os.path.normpath(path).lower()
    if p in blacklist:
        return True
    for b in blacklist:
        if p.endswith(b) or b.endswith(p):
            return True
    return False


def existing_photo_count(slug: str) -> int:
    path = os.path.join(ROOT, "content", "posts", slug + ".md")
    if not os.path.isfile(path):
        return 0
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    fm = text.split("---", 2)[1] if text.startswith("---") else ""
    return len(re.findall(r"^\s*-\s*https?://", fm, re.M))


def collect_lists() -> list:
    """返回 [(slug, start, [NAS 绝对路径...]), ...]"""
    jobs = []
    for name, (slug, start) in NEW_ARTICLES.items():
        p = os.path.join(PICKED, name)
        if not os.path.isfile(p):
            print(f"[WARN] 清单不存在，跳过: {name}")
            continue
        paths = read_list(p)
        jobs.append((slug, start, paths))

    for p in sorted(glob.glob(os.path.join(PICKED, "add-*.txt"))):
        name = os.path.basename(p)
        slug = name[4:-4]
        start = existing_photo_count(slug) + 1
        if start == 1:
            print(f"[WARN] 找不到已有文章或已有 photos，跳过: {slug}")
            continue
        jobs.append((slug, start, read_list(p)))
    return jobs


def read_list(path: str) -> list:
    out = []
    with open(path, encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip().strip('"').strip("'")
            if not line or line.startswith("#"):
                continue
            cand = line.replace("\\", "/")
            full = cand if (cand.startswith("//") or os.path.isabs(cand)) \
                else os.path.join(NAS_ROOT, cand.replace("/", os.sep))
            out.append(os.path.normpath(full))
    return out


def encode_variants(src: str, out_dir: str, stem: str):
    """生成三档 WebP，返回主图 (w, h)。"""
    import io
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        long_edge = max(w, h)
        os.makedirs(out_dir, exist_ok=True)
        for sfx, target, q in VARIANTS:
            if long_edge <= target:
                variant = im.copy()
            else:
                ratio = target / long_edge
                variant = im.resize(
                    (max(1, round(w * ratio)), max(1, round(h * ratio))),
                    Image.LANCZOS,
                )
            buf = io.BytesIO()
            variant.save(buf, "WEBP", quality=q, method=6)
            with open(os.path.join(out_dir, f"{stem}{sfx}.webp"), "wb") as fh:
                fh.write(buf.getvalue())
    return w, h


def main() -> int:
    blacklist = load_blacklist()
    jobs = collect_lists()
    if not jobs:
        print("[ERR] 没有可处理的选图清单")
        return 1

    os.makedirs(STAGING, exist_ok=True)
    plan, meta, skipped = [], {}, 0

    for slug, start, paths in jobs:
        out_dir = os.path.join(STAGING, slug)
        n = start
        for src in paths:
            if is_blacklisted(src, blacklist):
                print(f"[SKIP] 命中证件照黑名单: {src}")
                skipped += 1
                continue
            if not os.path.isfile(src):
                print(f"[MISS] 文件不存在: {src}")
                raise SystemExit("[ERR] 清单中有文件不存在，已中止")
            stem = f"{n:02d}"
            w, h = encode_variants(src, out_dir, stem)
            ratio = round(w / h, 4)
            for sfx, _t, _q in VARIANTS:
                plan.append({
                    "slug": slug,
                    "file": f"{stem}{sfx}.webp",
                    "key": f"posts/{slug}/{stem}{sfx}.webp",
                    "local": os.path.join(out_dir, f"{stem}{sfx}.webp"),
                })
            meta[f"{slug}/{stem}.webp"] = {
                "w": w, "h": h, "r": ratio,
                "cls": classify(ratio), "sm": True, "t": True,
                "src": src.replace(os.sep, "/"),
            }
            n += 1
        print(f"[OK] {slug:<32} {n - start:>2} 张  编号 {start:02d}~{n - 1:02d}")

    with open(os.path.join(STAGING, "_plan.json"), "w", encoding="utf-8") as fh:
        json.dump({"variant_count": len(plan), "blacklist_skipped": skipped,
                   "items": plan}, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(STAGING, "photo_meta_r2.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1, sort_keys=True)

    total_bytes = sum(os.path.getsize(p["local"]) for p in plan)
    print(f"\n[INFO] 主图 {len(meta)} 张，三档共 {len(plan)} 个文件，"
          f"暂存体积 {total_bytes / 1048576:.2f} MB")
    print(f"[INFO] 上传计划: {os.path.join(STAGING, '_plan.json')}")
    print(f"[INFO] 元数据草稿: {os.path.join(STAGING, 'photo_meta_r2.json')}")
    print("[NEXT] 配好 .env 后执行: python scripts/upload-to-r2.py --from-staging")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
