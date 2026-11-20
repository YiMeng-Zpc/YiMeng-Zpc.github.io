/* ============================================================
   boot.js — 进入加载启动层控制器
   行为：每个浏览器会话首次进入显示「点击进入」启动页，
   点击后播放音效 + 开机序列（logo → 终端打字 → 圆环 → WELCOME → 白闪）。
   任意时刻点击可跳过；prefers-reduced-motion 用户直接跳过。
   DOM 全部动态创建，无 JS 时站点完全不受影响。
   ============================================================ */
(function () {
  'use strict';

  var SK = 'uxBootDone';
  var AUDIO_URL = '/media/boot-intro.mp3';

  function skipReason() {
    try {
      if (sessionStorage.getItem(SK)) return 'done';
    } catch (e) { /* 隐私模式照常播放 */ }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduce';
    return null;
  }

  if (skipReason()) return;

  /* ---------- 构建启动层 ---------- */
  var layer = document.createElement('div');
  layer.id = 'boot-layer';
  layer.innerHTML =
    '<div class="boot-scanbeam"></div>' +
    '<div class="boot-vignette"></div>' +
    '<div class="boot-corner tl"></div><div class="boot-corner tr"></div>' +
    '<div class="boot-corner bl"></div><div class="boot-corner br"></div>' +
    '<div class="boot-hud top"><span>SYS.BOOT // v3.2.1</span><span><span class="boot-dot"></span>UPLINK STABLE</span></div>' +
    '<div class="boot-hud bottom"><span>GRID.SECTOR-07 // NEON.PIPELINE</span><span id="boot-clock"></span></div>' +
    '<div class="boot-standby">' +
      '<div class="boot-logo">' + siteTitle() + '</div>' +
      '<div class="boot-enter">进入</div>' +
      '<div class="boot-hint">建议开启声音 · 点击任意处开始</div>' +
    '</div>' +
    '<div class="boot-stage" hidden>' +
      '<div class="boot-main-logo">' + siteTitle() + '</div>' +
      '<div class="boot-term"></div>' +
      '<div class="boot-ring-wrap">' +
        '<svg viewBox="0 0 120 120" aria-hidden="true">' +
          '<circle class="boot-ring-track" cx="60" cy="60" r="54"/>' +
          '<circle class="boot-ring-ticks" cx="60" cy="60" r="58"/>' +
          '<circle class="boot-ring-bar" cx="60" cy="60" r="54"/>' +
        '</svg>' +
        '<div class="boot-ring-pct">0%</div>' +
      '</div>' +
      '<div class="boot-welcome">' +
        '<div class="boot-w1">WELCOME&nbsp;TO</div>' +
        '<div class="boot-w2">' + siteTitle() + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="boot-skip" hidden>点击跳过</div>';

  /* HUD 底部实时时钟 */
  var clockEl = layer.querySelector('#boot-clock');
  var clockTimer = null;
  function tickClock() {
    if (!clockEl || !clockEl.isConnected) return;
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    clockEl.textContent = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    clockTimer = setTimeout(tickClock, 1000);
  }

  var flash = document.createElement('div');
  flash.id = 'boot-flash';

  function siteTitle() {
    /* 首页 title 即站点标题；内页带竖线后缀，取竖线前段 */
    var t = (document.title || 'YiMeng').split('|')[0].trim();
    return t || 'YiMeng';
  }

  var started = false, finished = false, aborted = false;
  var audio = null;

  document.documentElement.classList.add('boot-lock');

  function cleanup() {
    document.documentElement.classList.remove('boot-lock');
    if (layer.parentNode) layer.parentNode.removeChild(layer);
    if (flash.parentNode) flash.parentNode.removeChild(flash);
    if (audio) { audio.pause(); audio.src = ''; }
    try { sessionStorage.setItem(SK, '1'); } catch (e) { }
  }

  function fireFlashThenReveal() {
    if (finished) return;
    finished = true;
    flash.classList.add('boot-firing');
    /* 白闪 42%~58% 为全白峰值（1.1s 动画 → 约 0.46s~0.64s），此刻切走 boot 层 */
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      document.documentElement.classList.remove('boot-lock');
    }, 520);
    setTimeout(function () {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
      if (audio) audio.pause();
    }, 1150);
    try { sessionStorage.setItem(SK, '1'); } catch (e) { }
  }

  /* ---------- 打字机 ---------- */
  function sleep(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  async function typeLine(term, text, cls, speed) {
    var line = document.createElement('div');
    line.className = 'boot-line' + (cls ? ' ' + cls : '');
    term.appendChild(line);
    for (var i = 0; i < text.length; i++) {
      if (aborted) return;
      line.textContent += text.charAt(i);
      await sleep(speed);
    }
  }

  /* ---------- 主序列 ---------- */
  async function runSequence() {
    var stage = layer.querySelector('.boot-stage');
    var standby = layer.querySelector('.boot-standby');
    var term = layer.querySelector('.boot-term');
    var ringWrap = layer.querySelector('.boot-ring-wrap');
    var ringBar = layer.querySelector('.boot-ring-bar');
    var pct = layer.querySelector('.boot-ring-pct');
    var welcome = layer.querySelector('.boot-welcome');

    standby.remove();
    stage.hidden = false;

    /* 光标常驻最后一行 */
    var cursor = document.createElement('span');
    cursor.className = 'boot-cursor';
    term.appendChild(cursor);

    var C = 2 * Math.PI * 54;
    ringBar.style.strokeDasharray = C;
    ringBar.style.strokeDashoffset = C;

    /* t≈0.9s 起打字（logo 入场动画 1s） */
    await sleep(900);
    if (aborted) return fireFlashThenReveal();

    var lines = [
      ['唤醒视觉内核 ...', '', 34],
      ['校准霓虹光谱 · 载入底片档案', '', 30],
      ['建立加密通道 · 同步相册', '', 30],
      ['[ OK ] 系统就绪', 'boot-ok', 40]
    ];
    for (var i = 0; i < lines.length; i++) {
      term.insertBefore(cursor, null);
      await typeLine(term, lines[i][0], lines[i][1], lines[i][2]);
      if (aborted) return fireFlashThenReveal();
      await sleep(180);
    }

    /* 圆环 2.0s 0→100 */
    ringWrap.classList.add('boot-show');
    var T0 = performance.now(), DUR = 2000;
    await new Promise(function (res) {
      (function tick(now) {
        if (aborted) return res();
        var p = Math.min(1, (performance.now() - T0) / DUR);
        var eased = 1 - Math.pow(1 - p, 3);
        ringBar.style.strokeDashoffset = C * (1 - eased);
        pct.textContent = Math.round(eased * 100) + '%';
        if (p < 1) requestAnimationFrame(tick); else res();
      })(T0);
    });
    if (aborted) return fireFlashThenReveal();

    /* WELCOME 覆盖显示 */
    await sleep(250);
    welcome.classList.add('boot-show');
    await sleep(1100);
    fireFlashThenReveal();
  }

  /* ---------- 交互 ---------- */
  layer.addEventListener('click', function () {
    if (finished) return;
    if (!started) {
      started = true;
      /* 音频需要用户手势，此刻播放 */
      try {
        audio = new Audio(AUDIO_URL);
        audio.volume = 0.55;
        var pp = audio.play();
        if (pp && pp.catch) pp.catch(function () { /* 自动播放被拒则静默 */ });
      } catch (e) { }
      layer.querySelector('.boot-skip').hidden = false;
      runSequence();
    } else {
      /* 播放中点击 = 跳过 */
      aborted = true;
      fireFlashThenReveal();
    }
  });

  document.body.appendChild(layer);
  document.body.appendChild(flash);
  tickClock(); /* layer 挂载后再启动时钟 */
})();
