/* ============================================
   文章图库 masonry 布局
   ------------------------------------------------------------
   问题：纯 CSS Grid 排版时，同一行的行高由最高的那张图决定，
   导致竖版图旁边出现大片空白，横版/竖版比例混排时观感割裂。

   方案：JS 计算每张图的实际渲染高度，按「绝对定位 + top 偏移」的方式
   做真正的瀑布流：
     - banner（超宽）独占一行，宽度 100%
     - wide/square 两列并排
     - tall 竖版按自身高度参与列分配，列高自动平衡
   同时用 CSS grid 作为降级方案（JS 未执行时仍能正常显示）。

   依赖：模板输出的 data-w / data-h（图片真实像素宽高）。
   适配 PJAX：监听 pjax:complete 后重新计算。
   ============================================ */
(function () {
  'use strict';

  var GAP = 10;      // 与 CSS gap 一致
  var MIN_COL = 240; // 单列最小宽度（决定列数）
  var MAX_COL = 6;

  function layout(gallery) {
    var grid = gallery.querySelector('.article-gallery-photos');
    if (!grid) return;

    var items = Array.prototype.slice.call(grid.querySelectorAll('.article-gallery-img'));
    if (!items.length) return;

    var containerWidth = grid.clientWidth;
    if (!containerWidth) return;

    // 列数：按容器宽度自适应，偶数优先（跨 2 列的横版图需对齐到偶数列）
    var cols = Math.round(containerWidth / MIN_COL);
    cols = Math.max(2, Math.min(MAX_COL, cols));
    if (cols % 2 !== 0) cols += 1;
    var colWidth = (containerWidth - GAP * (cols - 1)) / cols;

    var colHeights = new Array(cols).fill(0);

    items.forEach(function (item) {
      var w = parseInt(item.dataset.w || '0', 10);
      var h = parseInt(item.dataset.h || '0', 10);
      if (!w || !h) {
        // 没有尺寸信息，退回 grid 流式布局
        item.style.position = '';
        item.style.width = '';
        item.style.left = '';
        item.style.top = '';
        item.classList.remove('gal-masonry');
        item.classList.add('gal-fallback');
        return;
      }

      var isBanner = item.classList.contains('gal-banner');
      var isTall = item.classList.contains('gal-tall');

      // banner 独占整行；竖版占 1 列；其余横版占 2 列
      var spanCols = isBanner ? cols : (isTall ? 1 : 2);
      if (spanCols > cols) spanCols = cols;

      // 候选起点：跨 2 列的只能落在偶数列，保证左右严丝合缝
      var candidates = [];
      for (var c = 0; c + spanCols <= cols; c++) {
        if (spanCols === 1 || c % 2 === 0) candidates.push(c);
      }
      if (!candidates.length) candidates.push(0);

      // 评分：取所跨列的最大高度（决定图的 top），选最小者 —— 即找最"平齐"的位置
      var best = null;
      var bestTop = 0;
      var bestScore = Infinity;
      for (var i = 0; i < candidates.length; i++) {
        var cc = candidates[i];
        var top = 0;
        for (var k = 0; k < spanCols; k++) {
          if (colHeights[cc + k] > top) top = colHeights[cc + k];
        }
        if (top < bestScore) { bestScore = top; best = cc; bestTop = top; }
      }
      var startCol = best;

      var itemWidth = isBanner
        ? containerWidth
        : colWidth * spanCols + GAP * (spanCols - 1);
      var itemHeight = Math.round(itemWidth * h / w);
      var top2 = bestTop;

      // 占据的列高度统一抬到本图底部
      for (var k2 = 0; k2 < spanCols; k2++) {
        colHeights[startCol + k2] = top2 + itemHeight + GAP;
      }

      item.style.position = 'absolute';
      item.style.left = (isBanner ? 0 : startCol * (colWidth + GAP)) + 'px';
      item.style.top = top2 + 'px';
      item.style.width = itemWidth + 'px';
      item.style.maxWidth = 'none';
      item.classList.remove('gal-fallback');
      item.classList.add('gal-masonry');
    });

    // 容器高度 = 最高列
    var maxH = 0;
    colHeights.forEach(function (v) { if (v > maxH) maxH = v; });
    grid.style.position = 'relative';
    grid.style.height = Math.max(0, maxH - GAP) + 'px';
    grid.style.display = 'block';
  }

  function layoutAll() {
    var galleries = document.querySelectorAll('.article-gallery');
    for (var i = 0; i < galleries.length; i++) {
      layout(galleries[i]);
    }
  }

  // 图片加载完成后真实尺寸才确定，需重排一次
  function onLoad(e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.closest('.article-gallery')) {
      window.requestAnimationFrame(layoutAll);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', layoutAll);
  } else {
    layoutAll();
  }

  window.addEventListener('load', layoutAll);
  document.addEventListener('pjax:complete', layoutAll);
  document.addEventListener('error', onLoad, true);

  // 窗口尺寸变化后重排
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutAll, 200);
  });
})();
