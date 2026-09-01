/* ============================================
   主页运行计时器
   从 hugo.toml params.footer.since 起算
   ============================================ */

(function () {
  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }

  function tick() {
    var el = document.getElementById('uptime-counter');
    if (!el) return;
    var since = parseInt(el.getAttribute('data-since'), 10);
    if (!since || isNaN(since)) return;

    // 用年份构造 1 月 1 日作为起点，UTC 时间稳定
    var start = Date.UTC(since, 0, 1, 0, 0, 0);
    var now = Date.now();
    if (now < start) {
      // 还没到起始年份，全 0
      el.querySelector('.uptime-d b').textContent = '00';
      el.querySelector('.uptime-h b').textContent = '00';
      el.querySelector('.uptime-m b').textContent = '00';
      el.querySelector('.uptime-s b').textContent = '00';
      return;
    }

    var diff = Math.floor((now - start) / 1000); // 秒
    var d = Math.floor(diff / 86400);
    var h = Math.floor((diff % 86400) / 3600);
    var m = Math.floor((diff % 3600) / 60);
    var s = diff % 60;

    el.querySelector('.uptime-d b').textContent = pad(d, 2);
    el.querySelector('.uptime-h b').textContent = pad(h, 2);
    el.querySelector('.uptime-m b').textContent = pad(m, 2);
    el.querySelector('.uptime-s b').textContent = pad(s, 2);
  }

  function init() {
    tick();
    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();