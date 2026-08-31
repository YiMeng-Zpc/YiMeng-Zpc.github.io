/* ============================================
   ✦ 忆梦博客 · 动态 4K 风景图背景 ✦
   - 每次刷新从 fengjing.php 拉一张 4K+ 风景图
   - 加上星辰粒子
   ============================================ */

(function () {
  'use strict';

  // ---------- 风景图背景 ----------
  var FENGJING_API = 'https://tu.ltyuanfang.cn/api/fengjing.php';

  function setupFengjing() {
    // 创建背景 div（放在 body 最前面）
    var bg = document.createElement('div');
    bg.id = 'fengjing-bg';
    document.body.insertBefore(bg, document.body.firstChild);

    // 创建暗色蒙版
    var overlay = document.createElement('div');
    overlay.id = 'fengjing-overlay';
    document.body.insertBefore(overlay, bg.nextSibling);

    // 用 ?cb=<timestamp> 绕过 CDN 缓存 → 每次刷新拿到不同图
    var url = FENGJING_API + '?cb=' + Date.now();

    // 预加载图片，加载完才显示，避免闪烁
    var img = new Image();
    img.onload = function () {
      bg.style.backgroundImage = 'url("' + url + '")';
      // 等浏览器把 bg image paint 上去后再淡入
      requestAnimationFrame(function () {
        document.body.classList.add('fengjing-loaded');
      });
    };
    img.onerror = function () {
      // API 失败时保持纯色背景
      console.warn('Fengjing image failed to load, falling back to solid color.');
      document.body.classList.add('fengjing-loaded');
    };
    img.src = url;
  }

  // ---------- 星辰粒子 ----------
  function spawnStars() {
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    var COUNT = 28;
    var frag = document.createDocumentFragment();

    for (var i = 0; i < COUNT; i++) {
      var star = document.createElement('div');
      star.className = 'star';
      // 30% 概率生成暖橙大颗
      if (Math.random() < 0.30) star.className += ' star--amber';

      // 随机位置、速度、延迟
      var left = Math.random() * 100;
      var duration = 8 + Math.random() * 14;   // 8–22s
      var delay = Math.random() * 12;          // 0–12s
      var scale = 0.6 + Math.random() * 1.4;   // 大小变化

      star.style.left = left + 'vw';
      star.style.animationDuration = duration + 's';
      star.style.animationDelay = (-delay) + 's';
      star.style.transform = 'scale(' + scale + ')';

      frag.appendChild(star);
    }
    document.body.appendChild(frag);
  }

  // ---------- 启动 ----------
  function init() {
    setupFengjing();
    spawnStars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();