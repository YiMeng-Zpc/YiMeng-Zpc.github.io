# -*- coding: utf-8 -*-
"""
重建文章配图：
  1. 按人工甄别的 picks 清单，从源目录取原图
  2. 压缩为主图(长边2000) + 缩略图(长边800)，供 srcset 使用
  3. 输出到 static/images/uploads/posts/<slug>/
"""
import os, sys, json, shutil
from PIL import Image

REPO = r"D:\AI工作空间\YiMeng\YiMeng-Zpc.github.io"
OUT_ROOT = os.path.join(REPO, "static", "images", "uploads", "posts")

# slug -> (源目录, [源文件序号列表, 1-based])
PICKS = {
    # 禾木村深雪期：从「禾木村/沙漠无人区/喀纳斯」混合目录中只取雪景区段
    "hemu-snow": (r"E:\图片\新疆\新疆禾木村、沙漠无人区、喀纳斯", [35, 89, 93, 104, 77, 85, 79, 121]),
    # 巴库：只取城市地标，排除猫
    "azerbaijan-baku": (r"E:\图片\阿塞拜疆", [21, 22, 23, 24, 18, 7, 9, 38]),
    # 日本：东京街头 + 京都鸟居/五重塔
    "japan-travel": (r"E:\图片\日本旅行\图片", [1, 2, 5, 12, 66, 85, 86, 87]),
    # 阿拉木图：排除手拿地图，保留市集/教堂
    "kazakhstan-almaty": (r"E:\图片\哈萨克斯坦\阿拉木图-哈萨克斯坦", [1, 2, 4, 10, 14, 15, 3, 6]),
    # 乌尔禾魔鬼城：只取雅丹土丘，排除公路/磕头机/骆驼
    "xinjiang-wind-city": (r"E:\图片\新疆\新疆世界魔鬼城", [9, 10, 15, 16, 19, 21, 22, 14]),
}

MAIN_MAX = 2000
THUMB_MAX = 800
MAIN_Q = 80
THUMB_Q = 72


def sorted_files(d):
    return sorted([f for f in os.listdir(d) if f.lower().endswith((".jpg", ".jpeg", ".png"))])


def make(slug, src, picks, dry=False):
    files = sorted_files(src)
    dst_dir = os.path.join(OUT_ROOT, slug)
    if not dry:
        os.makedirs(dst_dir, exist_ok=True)
    picked_names = []
    for i, n in enumerate(picks, 1):
        if n < 1 or n > len(files):
            print(f"  !! {slug} 序号 {n} 越界 (共{len(files)})")
            continue
        fn = files[n - 1]
        picked_names.append(fn)
        src_p = os.path.join(src, fn)
        try:
            im = Image.open(src_p).convert("RGB")
        except Exception as e:
            print(f"  !! {slug} #{n} {fn} 打开失败: {e}")
            continue
        # 主图
        m = im.copy()
        m.thumbnail((MAIN_MAX, MAIN_MAX), Image.LANCZOS)
        if not dry:
            m.save(os.path.join(dst_dir, f"{i:02d}.webp"), "WEBP", quality=MAIN_Q, method=6)
        # 缩略图
        t = im.copy()
        t.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
        if not dry:
            t.save(os.path.join(dst_dir, f"{i:02d}-sm.webp"), "WEBP", quality=THUMB_Q, method=6)
        print(f"  {slug} #{i:02d} <- #{n} {fn}  main={m.size} thumb={t.size}")
    return picked_names


if __name__ == "__main__":
    dry = "--dry" in sys.argv
    manifest = {}
    for slug, (src, picks) in PICKS.items():
        print(f"=== {slug} ===")
        manifest[slug] = make(slug, src, picks, dry)
    if not dry:
        with open(os.path.join(REPO, ".workbuddy", "tmp", "manifest.json"), "w", encoding="utf-8") as fp:
            json.dump(manifest, fp, ensure_ascii=False, indent=1)
        print("manifest saved")
