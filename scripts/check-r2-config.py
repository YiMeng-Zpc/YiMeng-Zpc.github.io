#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
R2 上线前自检：确认 .env 五个凭据填好了、格式对、待上传产物齐、黑名单还在。

用法：
    python scripts/check-r2-config.py            # 只做本地静态检查
    python scripts/check-r2-config.py --live    # 额外探测 R2 公开域名是否可达

本脚本不会上传任何文件，也不会把凭据打印出来。
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, ".env")
STAGING = os.path.join(ROOT, ".workbuddy", "tmp", "staging")
BLACKLIST = os.environ.get(
    "NAS_BLACKLIST",
    os.path.join(os.path.dirname(ROOT), ".workbuddy", "tmp", "sensitive-files.txt"),
)

KEYS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET", "R2_PUBLIC_BASE")

PLACEHOLDER_WORDS = ("你的", "上面", "xxxx", "xxxxx", "__R2_BASE__")


def read_env() -> dict:
    cfg = {}
    if os.path.isfile(ENV):
        with open(ENV, encoding="utf-8-sig") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    # 环境变量优先（方便 CI / 临时覆盖）
    for k in KEYS:
        if os.environ.get(k):
            cfg[k] = os.environ[k].strip()
    return cfg


def looks_placeholder(v: str) -> bool:
    return any(w in v for w in PLACEHOLDER_WORDS)


def check_creds(cfg: dict) -> list:
    errs = []
    for k in KEYS:
        v = cfg.get(k, "")
        if not v:
            errs.append(f"缺少 {k}")
        elif looks_placeholder(v):
            errs.append(f"{k} 还是模板占位值，未填真实值")

    acc = cfg.get("R2_ACCOUNT_ID", "")
    if acc and not re.fullmatch(r"[0-9a-fA-F]{32}", acc):
        errs.append("R2_ACCOUNT_ID 应为 32 位十六进制字符（控制台右侧栏可复制）")

    base = cfg.get("R2_PUBLIC_BASE", "")
    if base:
        if not base.startswith("https://"):
            errs.append("R2_PUBLIC_BASE 必须以 https:// 开头")
        if base.rstrip("/") != base:
            errs.append("R2_PUBLIC_BASE 末尾不要带 /（脚本会自己处理）")
        if "r2.dev" not in base and "zhangpengchao.com" not in base:
            errs.append("R2_PUBLIC_BASE 看起来不像 r2.dev 或自定义图片域名，请核对")

    for k in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        v = cfg.get(k, "")
        if v and len(v) < 16 and not looks_placeholder(v):
            errs.append(f"{k} 长度偏短，可能没复制完整")
    return errs


def probe(base: str) -> bool:
    """探测公开域名。403/404 都算域名可达，只有连接失败算不通。"""
    url = base.rstrip("/") + "/"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(url, method="GET",
                                 headers={"User-Agent": "blog-r2-config-check"})
    try:
        with opener.open(req, timeout=12) as resp:
            print(f"[OK] 公开域名可达，HTTP {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[OK] 公开域名可达，HTTP {e.code}（桶根目录无对象时属正常）")
        return True
    except Exception as e:
        print(f"[WARN] 公开域名暂不可达：{type(e).__name__}: {e}")
        print("       可能是刚开启 Public access 尚未生效，或本机网络/代理干扰；"
              "不影响静态检查结论。")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="额外探测 R2 公开域名")
    args = ap.parse_args()

    print("==== R2 上线前自检 ====")
    ok = True

    cfg = read_env()
    creds_from_env = all(cfg.get(k) and not looks_placeholder(cfg[k]) for k in KEYS)

    if not os.path.isfile(ENV):
        if creds_from_env:
            print("[OK] 凭据由环境变量提供（未使用 .env）")
        else:
            print(f"[TODO] 还没有 .env：{ENV}")
            print("       复制 .env.example 为 .env，填入 5 个值即可")
            ok = False
    else:
        print(f"[OK] .env 已存在（{os.path.getsize(ENV)} 字节）")

    errs = check_creds(cfg)
    if errs:
        ok = False
        for e in errs:
            print(f"[TODO] {e}")
    else:
        print("[OK] 5 个凭据齐全、格式正确")
        print(f"       Bucket = {cfg['R2_BUCKET']}")
        print(f"       Public base = {cfg['R2_PUBLIC_BASE'].rstrip('/')}")

    # 待上传产物
    plan_path = os.path.join(STAGING, "_plan.json")
    meta_path = os.path.join(STAGING, "photo_meta_r2.json")
    if os.path.isfile(plan_path) and os.path.isfile(meta_path):
        plan = json.load(open(plan_path, encoding="utf-8"))
        meta = json.load(open(meta_path, encoding="utf-8"))
        print(f"[OK] 暂存产物就绪：{len(plan['items'])} 个文件 / "
              f"{len(meta)} 张主图")
    else:
        ok = False
        print("[TODO] 暂存产物缺失，先跑 python scripts/stage-r2-photos.py")

    # 黑名单（fail-closed 的前提）
    if os.path.isfile(BLACKLIST):
        n = sum(1 for l in open(BLACKLIST, encoding="utf-8")
                if l.strip() and not l.startswith("#"))
        print(f"[OK] 证件照黑名单在位：{n} 条")
    else:
        ok = False
        print(f"[TODO] 黑名单缺失，上传脚本会直接中止：{BLACKLIST}")

    if args.live and cfg.get("R2_PUBLIC_BASE") and not looks_placeholder(
            cfg["R2_PUBLIC_BASE"]):
        probe(cfg["R2_PUBLIC_BASE"])

    print()
    if ok:
        print("==== 检查通过，可以上线 ====")
        print("  python scripts/upload-to-r2.py --from-staging")
        print("  python scripts/finalize-r2.py --check")
        print("  python scripts/finalize-r2.py")
        print("  git add -A && git commit && git push")
        return 0
    print("==== 还有上面标 [TODO] 的项要补齐 ====")
    print("取值步骤见 docs/R2-IMAGE-HOST.md「配置步骤」")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
