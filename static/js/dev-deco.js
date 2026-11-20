/* ============================================
   ✦ 忆梦博客 · 编程科技感装饰层 ✦
   配合 css/dev-deco.css：
   1. 代码雨 canvas 背景（垫在内容下、风景图上）
   2. 区块注释标题注入
   3. 页脚终端行注入
   触屏 / reduced-motion / 后台标签页自动停用或降帧
   ============================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !window.matchMedia('(pointer: fine)').matches ||
    window.matchMedia('(hover: none)').matches;

  /* ---------- 1. 代码雨 ---------- */
  function initRain() {
    if (reduce || touch) return;
    if (document.getElementById('dev-rain')) return;

    var cv = document.createElement('canvas');
    cv.id = 'dev-rain';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');

    var GLYPHS = '01<>/{}[]();=+*#%$&|!?~^:'.split('').concat(
      ['fn', '=>', '0x', 'if', 'js', 'go', 'py', 'ts', 'cd', '&&', 'ls', '::']
    );
    var COLORS = ['0, 229, 255', '0, 229, 255', '0, 229, 255', '245, 158, 11', '255, 61, 240'];
    var COL_W = 18;
    var cols = [];
    var W = 0, H = 0;

    function resetCol(c) {
      c.y = -Math.random() * 40;
      c.speed = 0.6 + Math.random() * 1.4;      /* 每帧下移的行数 */
      c.color = COLORS[(Math.random() * COLORS.length) | 0];
      c.glyphTick = 0;
    }

    function resize() {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
      var n = Math.ceil(W / COL_W);
      cols = [];
      for (var i = 0; i < n; i++) {
        var c = {};
        resetCol(c);
        c.y = Math.random() * (H / 16);          /* 初始错落分布 */
        cols.push(c);
      }
      /* 清空画布 */
      ctx.clearRect(0, 0, W, H);
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    var acc = 0, last = 0;
    var FPS = 24;

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      var dt = now - last;
      if (dt < 1000 / FPS - 4) return;           /* 限帧 */
      last = now;
      if (document.hidden) return;

      /* 用 destination-out 逐帧擦淡，形成拖尾 */
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '12px Consolas, monospace';

      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        c.y += c.speed;
        c.glyphTick++;

        var gy = c.y * 14;
        if (gy > H + 20) { resetCol(c); continue; }
        if (c.glyphTick % 2 !== 0) continue;     /* 部分帧跳过重绘，更碎 */

        var x = i * COL_W + 3;
        var g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        var head = Math.random() < 0.12;
        ctx.fillStyle = head
          ? 'rgba(255, 255, 255, 0.9)'
          : 'rgba(' + c.color + ', ' + (0.22 + Math.random() * 0.3).toFixed(2) + ')';
        ctx.fillText(g, x, gy);
      }
    }

    var rafId = 0;
    resize();
    rafId = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) last = performance.now();
    });
  }

  /* ---------- 2. 区块注释标题 ---------- */
  function decorateSections() {
    if (reduce) return;
    var grid = document.querySelector('.home-posts-grid');
    if (!grid) return;
    if (grid.previousElementSibling &&
        grid.previousElementSibling.classList.contains('dev-section')) return;
    var s = document.createElement('div');
    s.className = 'dev-section';
    s.setAttribute('aria-hidden', 'true');
    var count = grid.querySelectorAll('.post-card').length;
    s.innerHTML =
      '<span class="dev-comment"><b>/*</b> index.render({ posts: <b>' + count +
      '</b> }) — 最近的文章 <b>*/</b></span>' +
      '<span class="dev-line"></span>';
    grid.parentNode.insertBefore(s, grid);
  }

  /* ---------- 3. 页脚终端行 ---------- */
  function decorateFooter() {
    var footer = document.getElementById('footer');
    if (!footer || document.getElementById('dev-term')) return;
    var t = document.createElement('div');
    t.id = 'dev-term';
    t.setAttribute('aria-hidden', 'true');
    t.innerHTML =
      '<div><span class="dev-prompt">visitor@zhangpengchao.com</span>' +
      '<span class="dev-path">:~/blog</span><span class="dev-dollar">$ </span>' +
      '<span class="dev-cmd">cat /etc/motto && uptime --summary</span></div>' +
      '<div><span class="dev-output">走过的路都不会骗人 · 自 2021-08-03 持续编译中</span>' +
      '<span class="dev-eof">// EOF</span><span class="dev-cursor"></span></div>';
    footer.appendChild(t);
  }

  function initAll() {
    try { decorateSections(); decorateFooter(); } catch (e) { /* 装饰失败不影响主站 */ }
  }

  /* pjax 换页后重新注入区块标题 */
  window.addEventListener('pjax:complete', initAll);
  window.addEventListener('pjax:success', initAll);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
      initRain();
    });
  } else {
    initAll();
    initRain();
  }
})();
