#!/usr/bin/env bash
# =============================================================================
# 图片归档同步：博客压缩图 → NAS 只读归档目录
#
# 设计要点（安全）：
#   1. 单向 push —— 只有电脑 → NAS，NAS 永不主动接收外部写入
#   2. 扩展名白名单 —— 只有图片类型能落地，脚本/可执行文件一律拒绝
#   3. 幂等 —— 重复执行不产生冗余传输（rsync 增量）
#   4. 不删除 NAS 上其他内容 —— 去掉 --delete，NAS 归档区只增不减
#
# 用法：
#   ./archive-to-nas.sh                    # 同步压缩图（默认）
#   ./archive-to-nas.sh --originals        # 同步原图（体积大，见下）
#   NAS_SHARE=//192.168.8.1/blog-archive ./archive-to-nas.sh
# =============================================================================
set -euo pipefail

# ---------- 可配置项 ----------
NAS_HOST="${NAS_HOST:-192.168.8.1}"
NAS_SHARE="${NAS_SHARE:-blog-archive}"
NAS_SUBDIR="${NAS_SUBDIR:-blog-webp}"
NAS_USER="${NAS_USER:-backup}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${REPO_ROOT}/static/images/uploads/posts"

# 原图归档（E 盘素材库）—— 体积大，建议只在本地网络下定期跑
ORIGINALS_SRC="${ORIGINALS_SRC:-/e/图片}"

# ---------- 参数解析 ----------
MODE="webp"
for arg in "$@"; do
  case "$arg" in
    --originals) MODE="originals" ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$MODE" == "originals" ]]; then
  SRC_DIR="$ORIGINALS_SRC"
  NAS_SUBDIR="${NAS_SUBDIR:-blog-originals}"
  echo ">> 模式：原图归档（源: $SRC_DIR）"
else
  echo ">> 模式：压缩图归档（源: $SRC_DIR）"
fi

# ---------- 前置检查 ----------
if [[ ! -d "$SRC_DIR" ]]; then
  echo "✗ 源目录不存在: $SRC_DIR" >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "✗ 未找到 rsync。Windows 可改用 robocopy（见 README 说明）。" >&2
  exit 1
fi

DEST="//${NAS_HOST}/${NAS_SHARE}/${NAS_SUBDIR}/"

echo ">> 目标: ${DEST}"

# ---------- 执行同步 ----------
# --include='*/'            : 保留目录结构
# --include='*.webp' 等     : 扩展名白名单 —— 安全关键，拒绝非图片落地
# --exclude='*'             : 其余一律排除
# 刻意不使用 --delete       : 避免误删 NAS 上的其他归档内容
rsync -avz \
  --include='*/' \
  --include='*.webp' \
  --include='*.jpg' \
  --include='*.jpeg' \
  --include='*.png' \
  --exclude='*' \
  "$SRC_DIR/" \
  "${NAS_USER}@${DEST}"

echo "✓ 同步完成"
echo
echo "后续可在 NAS 上执行以下命令确认归档内容（预期：均为图片）："
echo "  ssh ${NAS_USER}@${NAS_HOST} 'find ${NAS_SUBDIR} -type f ! -iname \"*.webp\" ! -iname \"*.jpg\" ! -iname \"*.jpeg\" ! -iname \"*.png\" | head'"
