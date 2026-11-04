#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
上传照片到 Cloudflare R2 自建图床，并维护图片尺寸元数据。

为什么需要 R2：
  jsDelivr 对单个仓库有 50MB 硬上限，超限整包失效（现有图也会一起挂）。
  站点当前已占 39.65MB，剩余仅 ~10MB（≈25 张）。NAS 上有 1055 张照片，
  全量发布需要约 410MB，只能换图床。R2 免费版 10GB 存储 + 免流量费。

凭据（环境变量，或写进 .env 由本脚本读取）：
  R2_ACCOUNT_ID        Cloudflare 账户 ID（右侧边栏可见）
  R2_ACCESS_KEY_ID     R2 API Token 的 Access Key ID
  R2_SECRET_ACCESS_KEY R2 API Token 的 Secret Access Key
  R2_BUCKET            桶名，如 blog-photos
  R2_PUBLIC_BASE       桶的公开访问地址，如 https://pub-xxxx.r2.dev

安全约束：
  1. 必须读取证件照黑名单，命中即跳过；黑名单缺失时直接中止（fail-closed）。
  2. 只读取 NAS / 仓库，不修改、不删除 NAS 上任何文件。
  3. 上传前先过黑名单，再逐张写尺寸元数据。

用法：
  # 从 NAS 按人工甄别清单上传新图
  python scripts/upload-to-r2.py --nas --slug beijing-shi-cha-hai --files-list tmp/picked.txt

  # 把仓库里已有的 99 张迁到 R2（并改写文章 front matter 里的 URL）
  python scripts/upload-to-r2.py --migrate

  # 上传 stage-r2-photos.py 预压缩好的图片（推荐，凭据到位后一条命令搞定）
  python scripts/upload-to-r2.py --from-staging

  # 只看会传哪些
  python scripts/upload-to-r2.py --nas --slug x --files-list tmp/p.txt --dry-run
"""

import argparse
import json
import os
import sys

try:
    import boto3
except ImportError:
    print("[ERR] 需要 boto3: python -m pip install boto3 -i https://pypi.org/simple",
          file=sys.stderr)
    raise SystemExit(1)

try:
    from PIL import Image
except ImportError:
    print("[ERR] 需要 Pillow: python -m pip install Pillow -i https://pypi.org/simple",
          file=sys.stderr)
    raise SystemExit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAS_ROOT = "//192.168.8.1/YiMeng云盘/图片"
REPO_IMG_ROOT = os.path.join(ROOT, "static", "images", "uploads", "posts")
META_R2 = os.path.join(ROOT, "data", "photo_meta_r2.json")
STAGING = os.path.join(ROOT, ".workbuddy", "tmp", "staging")
BLACKLIST = os.environ.get(
    "NAS_BLACKLIST",
    os.path.join(os.path.dirname(ROOT), ".workbuddy", "tmp", "sensitive-files.txt"),
)

VARIANTS = (("", 2000, 80), ("-sm", 800, 80), ("-t", 240, 70))


def classify(ratio: float) -> str:
    if ratio >= 2.0:
        return "banner"
    if ratio >= 1.25:
        return "wide"
    if ratio >= 0.95:
        return "square"
    return "tall"


def load_env_file() -> None:
    """从仓库根目录 .env 读取缺失的环境变量（不覆盖已存在的）。"""
    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def require_creds() -> dict:
    load_env_file()
    missing = [k for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
                           "R2_BUCKET", "R2_PUBLIC_BASE") if not os.environ.get(k)]
    if missing:
        print("[ERR] 缺少 R2 凭据环境变量:\n"
              f"       {', '.join(missing)}\n"
              "       在仓库根目录建 .env 写入以下内容：\n"
              "         R2_ACCOUNT_ID=...\n"
              "         R2_ACCESS_KEY_ID=...\n"
              "         R2_SECRET_ACCESS_KEY=...\n"
              "         R2_BUCKET=blog-photos\n"
              "         R2_PUBLIC_BASE=https://pub-xxxx.r2.dev", file=sys.stderr)
        raise SystemExit(1)
    return {k: os.environ[k] for k in
            ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
             "R2_BUCKET", "R2_PUBLIC_BASE")}


def make_client(cfg: dict):
    return boto3.client(
        "s3",
        endpoint_url=f"https://{cfg['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=cfg["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=cfg["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def load_blacklist() -> set:
    """读取证件照黑名单；缺失时直接中止（fail-closed）。"""
    if not os.path.exists(BLACKLIST):
        print(f"[ERR] 证件照黑名单不存在: {BLACKLIST}\n"
              f"       请先完成 NAS 照片敏感信息筛查（sensitive-files.txt）再上传。",
              file=sys.stderr)
        raise SystemExit(1)
    out = set()
    with open(BLACKLIST, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
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


def encode_variants(src: str):
    """生成 (suffix, bytes, width, height) 三档 WebP。"""
    out = []
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        long_edge = max(w, h)
        for sfx, target, q in VARIANTS:
            if long_edge <= target:
                variant = im.copy()
            else:
                ratio = target / long_edge
                variant = im.resize((max(1, round(w * ratio)), max(1, round(h * ratio))),
                                    Image.LANCZOS)
            import io
            buf = io.BytesIO()
            variant.save(buf, "WEBP", quality=q, method=6)
            out.append((sfx, buf.getvalue(), variant.size[0], variant.size[1]))
    return out


def upload(client, bucket: str, key: str, data: bytes) -> None:
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="image/webp",
        CacheControl="public, max-age=31536000, immutable",
    )


def load_meta() -> dict:
    if os.path.isfile(META_R2):
        with open(META_R2, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def save_meta(meta: dict) -> None:
    os.makedirs(os.path.dirname(META_R2), exist_ok=True)
    with open(META_R2, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1, sort_keys=True)


def read_list(path: str) -> list:
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


def do_nas(args, cfg, client, meta, blacklist) -> int:
    picked = read_list(args.files_list)
    print(f"[INFO] 清单 {args.files_list}：{len(picked)} 个文件")
    missing = [p for p in picked if not os.path.isfile(p)]
    if missing:
        for m in missing:
            print(f"[MISS] 不存在: {m}")
        raise SystemExit("[ERR] 清单中有文件不存在，已中止")

    bucket = cfg["R2_BUCKET"]
    base = cfg["R2_PUBLIC_BASE"].rstrip("/")
    skipped, done = [], 0
    for src in picked:
        if is_blacklisted(src, blacklist):
            skipped.append(src)
            print(f"[SKIP] 命中证件照黑名单: {src}")
            continue
        if not args.dry_run:
            variants = encode_variants(src)
            for sfx, data, _w, _h in variants:
                key = f"posts/{args.slug}/{done + 1:02d}{sfx}.webp"
                upload(client, bucket, key, data)
        else:
            with Image.open(src) as im:
                variants = [("", b"", im.width, im.height)]
        main_w, main_h = variants[0][2], variants[0][3]
        ratio = round(main_w / main_h, 4)
        key = f"{args.slug}/{done + 1:02d}.webp"
        meta[key] = {
            "w": main_w, "h": main_h, "r": ratio,
            "cls": classify(ratio), "sm": True, "t": True,
            "url": f"{base}/posts/{args.slug}/{done + 1:02d}.webp",
        }
        print(f"[OK] {done + 1:02d}  {main_w}x{main_h}  {classify(ratio):6s} "
              f"<- {os.path.basename(src)}")
        done += 1

    if skipped:
        print(f"[SKIP] 共跳过 {len(skipped)} 张证件照")
    print(f"[INFO] 处理 {done} 张")
    return 0


def do_migrate(args, cfg, client, meta, blacklist) -> int:
    """把仓库里已有的图片原样迁到 R2（不重新压缩），并改写 front matter URL。"""
    bucket = cfg["R2_BUCKET"]
    base = cfg["R2_PUBLIC_BASE"].rstrip("/")
    total = 0
    for slug in sorted(os.listdir(REPO_IMG_ROOT)):
        slug_dir = os.path.join(REPO_IMG_ROOT, slug)
        if not os.path.isdir(slug_dir):
            continue
        if args.slug and slug != args.slug:
            continue
        for name in sorted(os.listdir(slug_dir)):
            if not name.endswith(".webp"):
                continue
            src = os.path.join(slug_dir, name)
            with open(src, "rb") as fh:
                data = fh.read()
            key = f"posts/{slug}/{name}"
            if not args.dry_run:
                upload(client, bucket, key, data)
            if not name.endswith("-sm.webp") and not name.endswith("-t.webp"):
                with Image.open(src) as im:
                    w, h = im.width, im.height
                ratio = round(w / h, 4)
                meta[f"{slug}/{name}"] = {
                    "w": w, "h": h, "r": ratio, "cls": classify(ratio),
                    "sm": True, "t": True,
                    "url": f"{base}/posts/{slug}/{name}",
                }
            total += 1
        print(f"[OK] {slug} 已迁移")
    print(f"[INFO] 共迁移 {total} 个文件")
    return 0


def do_staging(args, cfg, client, meta) -> int:
    """上传 stage-r2-photos.py 预压缩好的图片，并落地元数据。"""
    plan_path = os.path.join(STAGING, "_plan.json")
    meta_src = os.path.join(STAGING, "photo_meta_r2.json")
    if not (os.path.isfile(plan_path) and os.path.isfile(meta_src)):
        print(f"[ERR] 暂存产物不存在，请先执行 scripts/stage-r2-photos.py\n"
              f"       期望: {plan_path}", file=sys.stderr)
        return 1

    with open(plan_path, encoding="utf-8") as fh:
        plan = json.load(fh)
    with open(meta_src, encoding="utf-8") as fh:
        staged_meta = json.load(fh)

    base = cfg["R2_PUBLIC_BASE"].rstrip("/")
    bucket = cfg["R2_BUCKET"]
    for item in plan["items"]:
        if not os.path.isfile(item["local"]):
            print(f"[MISS] 暂存文件不存在: {item['local']}")
            raise SystemExit("[ERR] 暂存文件缺失，已中止")
        if not args.dry_run:
            with open(item["local"], "rb") as fh:
                upload(client, bucket, item["key"], fh.read())
        print(f"[OK] {item['key']}")

    for key, info in staged_meta.items():
        info["url"] = f"{base}/posts/{key}"
        meta[key] = info

    print(f"[INFO] 上传 {len(plan['items'])} 个文件，元数据 {len(staged_meta)} 条")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nas", action="store_true", help="从 NAS 上传新图")
    ap.add_argument("--migrate", action="store_true", help="迁移仓库里已有的图片到 R2")
    ap.add_argument("--from-staging", action="store_true",
                    help="上传 stage-r2-photos.py 预压缩好的图片（推荐）")
    ap.add_argument("--slug", help="文章 slug")
    ap.add_argument("--files-list", help="人工甄别后的显式清单")
    ap.add_argument("--dry-run", action="store_true", help="不实际上传")
    args = ap.parse_args()

    modes = sum(bool(x) for x in (args.nas, args.migrate, args.from_staging))
    if modes != 1:
        print("[ERR] --nas / --migrate / --from-staging 三选一")
        return 1
    if args.nas and not (args.slug and args.files_list):
        print("[ERR] --nas 需要同时提供 --slug 与 --files-list")
        return 1

    cfg = require_creds()
    blacklist = load_blacklist()
    client = make_client(cfg)
    meta = load_meta()

    if args.nas:
        do_nas(args, cfg, client, meta, blacklist)
    elif args.from_staging:
        if do_staging(args, cfg, client, meta) != 0:
            return 1
    else:
        do_migrate(args, cfg, client, meta, blacklist)

    if not args.dry_run:
        save_meta(meta)
        buckets = {}
        for item in meta.values():
            buckets[item["cls"]] = buckets.get(item["cls"], 0) + 1
        print(f"[OK] 写入 {META_R2}：{len(meta)} 条  分布={buckets}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
