#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
NAS 图片上传脚本：从 `//192.168.8.1/YiMeng云盘/图片` 挑选照片，
压缩后写入仓库 `static/images/uploads/posts/<slug>/`，供文章配图使用。

安全约束（重要）：
  1. **必须**读取 sensitive-files.txt（证件照黑名单），命中的文件一律跳过，
     且黑名单里的文件**永远不会被上传**。
     黑名单缺失时**直接中止**（fail-closed），除非显式加 --allow-no-blacklist。
  2. 只读取 NAS，不修改/删除 NAS 上任何文件。
  3. 压缩参数与现有 99 张主图保持一致（长边 2000px / WebP / quality 80），
     同时生成 -sm.webp(800px) 与 -t.webp(240px) 两级缩略图。
  4. `--files` 模式按显式清单上传（推荐）：先用拼版人工甄别挑好文件，
     再逐个上传，避免按文件名顺序盲选导致配图与文章内容不符。

用法：
    # 按目录顺序取前 8 张（需先完成证件照筛查）
    python scripts/upload-nas-photos.py --slug xinjiang-ili --src "新疆/新疆伊犁" --count 8
    # 按人工甄别后的显式清单上传（推荐）
    python scripts/upload-nas-photos.py --slug hemu-snow --files-list tmp/picked.txt
    # 只看会传哪些，不实际写入
    python scripts/upload-nas-photos.py --dry-run --slug hemu-snow --src "新疆/新疆禾木村、沙漠无人区、喀纳斯" --count 8
"""

import argparse
import json
import os
import sys

from PIL import Image

NAS_ROOT = "//192.168.8.1/YiMeng云盘/图片"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ROOT = os.path.join(REPO_ROOT, "static", "images", "uploads", "posts")
BLACKLIST = os.environ.get(
    "NAS_BLACKLIST",
    os.path.join(os.path.dirname(REPO_ROOT), ".workbuddy", "tmp", "sensitive-files.txt"),
)

IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")


def load_blacklist(allow_missing: bool = False) -> set:
    """读取证件照黑名单。

    默认 fail-closed：黑名单文件不存在时直接中止，避免在未完成敏感信息
    筛查的情况下把证件照推上公网。确需临时跳过时必须显式传 --allow-no-blacklist。
    """
    if not os.path.exists(BLACKLIST):
        msg = (f"[ERR] 证件照黑名单不存在: {BLACKLIST}\n"
               f"       请先完成 NAS 照片的敏感信息筛查并生成该文件。\n"
               f"       如确需临时跳过，请显式加 --allow-no-blacklist（风险自负）。")
        if not allow_missing:
            raise SystemExit(msg)
        print("[WARN] " + msg.replace("\n", "\n       "), file=sys.stderr)
        return set()
    out = set()
    with open(BLACKLIST, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # 统一成大写不敏感的完整路径
            out.add(os.path.normpath(line).lower())
    print(f"[OK] 已加载黑名单 {len(out)} 条")
    return out


def is_blacklisted(path: str, blacklist: set) -> bool:
    p = os.path.normpath(path).lower()
    if p in blacklist:
        return True
    # 兼容前缀匹配（黑名单可能用 UNC 或相对路径记录）
    for b in blacklist:
        if p.endswith(b) or b.endswith(p):
            return True
    return False


def list_images(src_rel: str):
    src_dir = os.path.join(NAS_ROOT, src_rel)
    if not os.path.isdir(src_dir):
        raise SystemExit(f"[ERR] 源目录不存在: {src_dir}")
    files = []
    for dirpath, _, names in os.walk(src_dir):
        for n in sorted(names):
            if n.lower().endswith(IMG_EXT):
                files.append(os.path.join(dirpath, n))
    return sorted(files)


def make_variants(src: str, out_dir: str, stem: str):
    """生成 2000px 主图 + 800px(-sm) + 240px(-t) 三档 WebP。"""
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        long_edge = max(w, h)

        def resize(target_long):
            if long_edge <= target_long:
                return im.copy()
            ratio = target_long / long_edge
            return im.resize((max(1, round(w * ratio)), max(1, round(h * ratio))),
                             Image.LANCZOS)

        os.makedirs(out_dir, exist_ok=True)
        main = resize(2000)
        main.save(os.path.join(out_dir, f"{stem}.webp"), "WEBP", quality=80, method=6)
        sm = resize(800)
        sm.save(os.path.join(out_dir, f"{stem}-sm.webp"), "WEBP", quality=80, method=6)
        t = resize(240)
        t.save(os.path.join(out_dir, f"{stem}-t.webp"), "WEBP", quality=70, method=6)
        return main.size


def resolve_files_list(path: str) -> list:
    """读取人工甄别后的显式清单。

    每行一个文件，支持三种写法：
      1. 相对 NAS 图片根目录的路径，如 `新疆/新疆伊犁/IMG_0001.jpg`
      2. 相对当前源目录的文件名，如 `IMG_0001.jpg`
      3. 绝对路径 / UNC 路径
    空行与 `#` 开头的注释行会被忽略。
    """
    out = []
    with open(path, encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip().strip('"').strip("'")
            if not line or line.startswith("#"):
                continue
            cand = line.replace("\\", "/")
            if cand.startswith("//"):
                full = cand
            elif os.path.isabs(cand):
                full = cand
            else:
                full = os.path.join(NAS_ROOT, cand.replace("/", os.sep))
            out.append(os.path.normpath(full))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True, help="文章 slug，如 xinjiang-ili")
    ap.add_argument("--src", help="NAS 上的相对目录，如 新疆/新疆伊犁")
    ap.add_argument("--files-list", help="人工甄别后的显式清单（每行一个文件）")
    ap.add_argument("--count", type=int, default=8, help="上传张数（--src 模式）")
    ap.add_argument("--start", type=int, default=1, help="起始序号（跳过已排前面的）")
    ap.add_argument("--allow-no-blacklist", action="store_true",
                    help="黑名单缺失时仍继续（默认直接中止，不建议使用）")
    ap.add_argument("--dry-run", action="store_true", help="只列出会上传哪些，不实际写入")
    args = ap.parse_args()

    if bool(args.src) == bool(args.files_list):
        print("[ERR] --src 与 --files-list 二选一")
        return 1

    blacklist = load_blacklist(args.allow_no_blacklist)

    if args.files_list:
        picked_raw = resolve_files_list(args.files_list)
        print(f"[INFO] 显式清单 {args.files_list}：{len(picked_raw)} 个文件")
        missing = [p for p in picked_raw if not os.path.isfile(p)]
        if missing:
            for m in missing:
                print(f"[MISS] 清单中文件不存在: {m}")
            raise SystemExit("[ERR] 清单中有文件不存在，已中止")
    else:
        files = list_images(args.src)
        if not files:
            print(f"[ERR] 源目录内没有图片: {args.src}")
            return 1
        print(f"[INFO] 源目录 {args.src}：共 {len(files)} 张，"
              f"取第 {args.start} 张起共 {args.count} 张（跳过黑名单后仍补足）")
        # 先过滤黑名单再切片，保证最终张数 = count
        files = [f for f in files if not is_blacklisted(f, blacklist)]
        picked_raw = files[args.start - 1: args.start - 1 + args.count]

    out_dir = os.path.join(OUT_ROOT, args.slug)
    picked, skipped = [], []
    for src in picked_raw:
        if is_blacklisted(src, blacklist):
            skipped.append(src)
            continue
        picked.append(src)

    if skipped:
        print(f"[SKIP] 命中证件照黑名单，已跳过 {len(skipped)} 张：")
        for s in skipped:
            print(f"        {s}")

    if not picked:
        print("[ERR] 过滤后没有可上传的图片")
        return 1

    print(f"[SEL] 选中 {len(picked)} 张：")
    for i, p in enumerate(picked, start=args.start):
        print(f"      {i:02d} {p}")

    if args.dry_run:
        print("[DRY-RUN] 未写入任何文件")
        return 0

    manifest = []
    for i, src in enumerate(picked, start=args.start):
        stem = f"{i:02d}"
        size = make_variants(src, out_dir, stem)
        manifest.append({"file": f"{stem}.webp", "src": src, "w": size[0], "h": size[1]})
        print(f"[OK] {stem}.webp  {size[0]}x{size[1]}  <- {os.path.basename(src)}")

    mf = os.path.join(out_dir, "_manifest.json")
    with open(mf, "w", encoding="utf-8") as fh:
        json.dump({"blacklist": BLACKLIST, "blacklist_entries": len(blacklist),
                   "items": manifest}, fh, ensure_ascii=False, indent=1)
    print(f"[INFO] 清单: {mf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
