#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
离线视觉验证脚本：构建 → 把 CDN 地址改写为本地路径 → 起服务 → 截图。

用法：
    python scripts/verify-layout.py            # 全部默认页面
    python scripts/verify-layout.py home gal   # 只跑指定项

说明：
    线上图片托管在 jsDelivr CDN，本地离线环境无法访问，
    因此构建后把 CDN 前缀替换成本地 /images/ 前缀（public/ 里图片在 images/ 下），
    这样无头 Chrome 就能加载真实图片来验证排版。
    public/ 是构建产物，每次都会重新生成，不影响仓库。
"""

import glob
import os
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
SHOTS = os.path.join(ROOT, ".workbuddy", "tmp", "shots")
HUGO = r"D:\Tools\hugo.exe"
PORT = 8899
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

CDN_PREFIX = "https://cdn.jsdelivr.net/gh/YiMeng-Zpc/YiMeng-Zpc.github.io@main/static/"

PAGES = [
    # key, path, 视口宽, 视口高
    ("home", "/", 1440, 1500),
    ("gal", "/posts/hemu-snow/", 1440, 2200),
    ("gal2", "/posts/japan-travel/", 1440, 2000),
    ("mobile", "/", 420, 1400),
]


def build() -> None:
    print("[1/4] hugo build ...")
    r = subprocess.run([HUGO, "--gc", "--minify"], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit("构建失败")
    print("      构建完成")


def rewrite() -> None:
    print("[2/4] 改写 CDN 地址为本地路径 ...")
    n = 0
    for f in glob.glob(os.path.join(PUBLIC, "**", "*.html"), recursive=True):
        s = open(f, encoding="utf-8").read()
        if CDN_PREFIX not in s:
            continue
        # CDN_PREFIX 已含 "...@main/static/"，余下部分是 "images/uploads/..."，
        # 因此替换成 "/"；若先替换 "/static/images/uploads" 会误伤完整 URL。
        s = s.replace(CDN_PREFIX, "/")
        open(f, "w", encoding="utf-8").write(s)
        n += 1
    print(f"      改写 {n} 个文件")


def serve() -> subprocess.Popen:
    print(f"[3/4] 启动本地服务 :{PORT} ...")
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                         cwd=PUBLIC, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(30):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=2).read()
            print("      服务就绪")
            return p
        except Exception:
            time.sleep(0.5)
    raise SystemExit("服务启动失败")


def shot(key: str, path: str, w: int, h: int) -> None:
    os.makedirs(SHOTS, exist_ok=True)
    out = os.path.join(SHOTS, f"{key}.png")
    prof = os.path.join(ROOT, ".workbuddy", "tmp", f"cprof_{key}")
    subprocess.run(["cmd", "/c", "rmdir", "/s", "/q", prof], capture_output=True)
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        f"--user-data-dir={prof}", "--hide-scrollbars",
        f"--window-size={w},{h}", "--virtual-time-budget=12000",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={out}",
        f"http://127.0.0.1:{PORT}{path}",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        err = r.stderr[-300:]
    except subprocess.TimeoutExpired:
        err = "TIMEOUT"
    ok = os.path.exists(out) and os.path.getsize(out) > 1000
    print(f"      {'OK  ' if ok else 'FAIL'} {key} -> {out} "
          f"({os.path.getsize(out) if os.path.exists(out) else 0} bytes)")
    if not ok:
        print("      ", err)


def main() -> int:
    only = set(sys.argv[1:])
    build()
    rewrite()
    srv = serve()
    try:
        print("[4/4] 截图 ...")
        for key, path, w, h in PAGES:
            if only and key not in only:
                continue
            shot(key, path, w, h)
    finally:
        srv.terminate()
    print(f"\n截图目录: {SHOTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
