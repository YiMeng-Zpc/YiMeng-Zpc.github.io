/* ============================================
   ✦ 忆梦博客 · UX 增强逻辑 ✦
   配合 css/ux-enhance.css。
   - 事件委托到 document，pjax 换页后无需重绑
   - mousemove 用 rAF 节流
   - 触屏 / reduced-motion 自动跳过重效果
   ============================================ */
(function () {
  'use strict';

  var fine = window.matchMedia('(pointer: fine)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !fine || window.matchMedia('(hover: none)').matches;

  // JS 就绪标记：允许 CSS 启用入场隐藏（避免无 JS 时内容不可见）
  document.body.classList.add('ux-ready');

  /* ---------- 1. 标题流动光谱：给目标标题加 class ---------- */
  function paintTitles() {
    // 文章卡片标题
    document.querySelectorAll('.home-posts-grid .post-card h3').forEach(function (el) {
      el.classList.add('ux-spectrum');
    });
    // 文章页主标题（主题结构：h1.post-title / .article-title / #main h1）
    document.querySelectorAll('#main h1, #main h2.post-title, .article-title').forEach(function (el) {
      // 只给文章正文标题上色，跳过站点名（在 header 里，不在 #main）
      el.classList.add('ux-spectrum');
    });
    // 站点标题
    document.querySelectorAll('header h1').forEach(function (el) {
      el.classList.add('ux-spectrum');
    });
  }

  /* ---------- 2. 卡片悬停显观：注入"阅读全文" ---------- */
  function decorateCards() {
    document.querySelectorAll('.home-posts-grid .post-card-link').forEach(function (a) {
      if (a.querySelector('.ux-readmore')) return;
      var r = document.createElement('span');
      r.className = 'ux-readmore';
      r.textContent = '阅读全文 →';
      a.appendChild(r);
    });
    // 日历 / 分类图标的提示气泡
    document.querySelectorAll('.home-posts-grid .post-card .meta i').forEach(function (i) {
      if (i.classList.contains('fa-calendar')) i.setAttribute('data-ux-tip', '发布日期');
      else if (i.classList.contains('fa-folder-open')) i.setAttribute('data-ux-tip', '文章分类');
    });
  }

  /* ---------- 8. 卡片依次入场 stagger ---------- */
  var cardObserver = null;
  function observeCards() {
    var cards = document.querySelectorAll('.home-posts-grid .post-card:not(.in-view)');
    if (!('IntersectionObserver' in window)) { cardObserver = null; return; }
    if (cardObserver) cardObserver.disconnect();
    cardObserver = new IntersectionObserver(function (entries) {
      var idx = 0;
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          // 同批入场的卡片依次延迟（用 animation-delay，配合 CSS 一次性动画）
          e.target.style.animationDelay = (idx * 0.07).toFixed(2) + 's';
          e.target.classList.add('in-view');
          cardObserver.unobserve(e.target);
          idx++;
        }
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });
    cards.forEach(function (c) { cardObserver.observe(c); });
  }

  /* ---------- 3. 指针氛围光 + 2. 卡片倾斜/聚光（rAF 节流） ---------- */
  var aurora = null;
  if (fine && !touch && !reduce) {
    aurora = document.createElement('div');
    aurora.id = 'ux-aurora';
    aurora.setAttribute('aria-hidden', 'true');
    document.body.appendChild(aurora);
  }

  var pending = null;
  var rafId = 0;

  function flushPointer() {
    rafId = 0;
    var s = pending;
    if (!s) return;
    if (aurora) {
      aurora.style.opacity = '1';
      aurora.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0)';
    }
    if (s.card) {
      s.card.style.setProperty('--ux-tx', s.tx + 'deg');
      s.card.style.setProperty('--ux-ty', s.ty + 'deg');
      s.card.style.setProperty('--ux-mx', s.mx + '%');
      s.card.style.setProperty('--ux-my', s.my + '%');
    }
  }

  document.addEventListener('mousemove', function (e) {
    if (!fine || touch || reduce) return;
    var info = { x: e.clientX, y: e.clientY, card: null };
    var card = e.target && e.target.closest
      ? e.target.closest('.home-posts-grid .post-card') : null;
    if (card) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      info.card = card;
      info.tx = ((0.5 - py) * 7).toFixed(2);   // 上下倾斜
      info.ty = ((px - 0.5) * 9).toFixed(2);   // 左右倾斜
      info.mx = (px * 100).toFixed(1);
      info.my = (py * 100).toFixed(1);
    }
    pending = info;
    if (!rafId) rafId = requestAnimationFrame(flushPointer);
  }, { passive: true });

  // 鼠标离开卡片：回正倾斜
  document.addEventListener('mouseout', function (e) {
    if (!fine || touch || reduce) return;
    var card = e.target && e.target.closest
      ? e.target.closest('.home-posts-grid .post-card') : null;
    if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) {
      card.style.setProperty('--ux-tx', '0deg');
      card.style.setProperty('--ux-ty', '0deg');
    }
  }, { passive: true });

  /* ---------- 4. 点击涟漪（事件委托） ---------- */
  document.addEventListener('click', function (e) {
    if (reduce || touch) return;
    var t = e.target && e.target.closest ? e.target.closest('a, button, .post-card') : null;
    if (!t) return;
    var size = Math.min(Math.max(t.offsetWidth, t.offsetHeight) * 1.5, 320);
    var r = document.createElement('span');
    r.className = 'ux-ripple';
    r.style.width = size + 'px';
    r.style.height = size + 'px';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    window.setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 650);
  }, { passive: true });

  /* ---------- 7. 页面转场 + pjax 换页后重新初始化 ---------- */
  function initAll() {
    paintTitles();
    decorateCards();
    observeCards();
  }

  window.addEventListener('pjax:send', function () {
    document.body.classList.add('ux-leaving');
  });
  window.addEventListener('pjax:complete', function () {
    document.body.classList.remove('ux-leaving');
    document.body.classList.add('ux-entering');
    initAll();
    window.setTimeout(function () { document.body.classList.remove('ux-entering'); }, 500);
  });
  window.addEventListener('pjax:success', function () { initAll(); });

  // 首次加载（脚本 defer，DOM 已就绪）
  initAll();
})();
