/* ============================================
   主页运行计时器
   从 hugo.toml params.uptime.start_date 起算
   支持 'YYYY-MM-DD' 完整日期 或 'YYYY' 仅年份
   ============================================ */

(function () {
  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }

  // 解析 'YYYY-MM-DD' 或 'YYYY' → UTC 时间戳
  function parseSince(raw) {
    if (!raw) return NaN;
    var s = String(raw).trim();
    // 完整日期 YYYY-MM-DD
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      return Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
    }
    // 仅年份 YYYY
    var y = parseInt(s, 10);
    if (!isNaN(y) && y > 1900 && y < 3000) {
      return Date.UTC(y, 0, 1, 0, 0, 0);
    }
    return NaN;
  }

  function tick() {
    var el = document.getElementById('uptime-counter');
    if (!el) return;
    var since = el.getAttribute('data-since');
    var start = parseSince(since);
    if (!start || isNaN(start)) return;

    var now = Date.now();
    if (now < start) {
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