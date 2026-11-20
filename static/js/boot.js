/* ============================================================
   boot.js — 进入加载启动层控制器
   行为：每个浏览器会话首次进入显示「点击进入」启动页，
   点击后播放音效 + 开机序列（logo → 代码风终端打字 → 圆环 → WELCOME → 白闪）。
   编程氛围：代码雨 / HUD 假读数 / hex 数据流 / logo glitch。
   播放中点击不跳过（防误触），仅「跳过 · Esc」按钮或 Esc 键可跳过。
   DOM 全部动态创建，无 JS 时站点完全不受影响。
   ============================================================ */
(function () {
  'use strict';

  var SK = 'uxBootDone';
  var AUDIO_URL = '/media/boot-intro.mp3';
  var SHATTER_URL = '/media/boot-shatter.mp3';

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
    '<canvas class="boot-rain" aria-hidden="true"></canvas>' +
    '<div class="boot-scanbeam"></div>' +
    '<div class="boot-vignette"></div>' +
    '<div class="boot-corner tl"></div><div class="boot-corner tr"></div>' +
    '<div class="boot-corner bl"></div><div class="boot-corner br"></div>' +
    '<div class="boot-hud top"><span>SYS.BOOT // v3.2.1</span><span id="boot-metrics"></span><span><span class="boot-dot"></span>UPLINK STABLE</span></div>' +
    '<div class="boot-hud bottom"><span>GRID.SECTOR-07 // NEON.PIPELINE</span><span id="boot-clock"></span></div>' +
    '<div class="boot-standby">' +
      '<div class="boot-logo">' + siteTitle() + '</div>' +
      '<div class="boot-enter">进入</div>' +
      '<div class="boot-hint">建议开启声音 · 点击任意处开始</div>' +
    '</div>' +
    '<div class="boot-stage" hidden>' +
      '<div class="boot-main-logo">' + siteTitle() + '</div>' +
      '<div class="boot-term"></div>' +
      '<div class="boot-hex" aria-hidden="true"></div>' +
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
    '<div class="boot-skip" hidden>跳过 · Esc</div>';

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
  var startedAt = 0;
  var actx = null, noiseBuf = null, lastKey = 0;

  /* ---------- 打字音效：Web Audio 合成机械键盘哒声 + 结果确认音 ---------- */
  function initTypingSfx() {
    if (actx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      var len = Math.floor(actx.sampleRate * 0.02);
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    } catch (e) { actx = null; }
  }

  function keyClick() {
    if (!actx || !noiseBuf) return;
    var now = performance.now();
    if (now - lastKey < 55) return; /* 打字 18ms/字太快，节流到 ~18 次/秒防机枪音 */
    lastKey = now;
    try {
      var src = actx.createBufferSource();
      src.buffer = noiseBuf;
      var bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600 + Math.random() * 2600;
      bp.Q.value = 2.5;
      var g = actx.createGain();
      var t = actx.currentTime;
      g.gain.setValueAtTime(0.16 + Math.random() * 0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(bp); bp.connect(g); g.connect(actx.destination);
      src.start(t);
    } catch (e) { }
  }

  function resBlip() {
    if (!actx) return;
    try {
      var o = actx.createOscillator(), g = actx.createGain();
      var t = actx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(920, t);
      o.frequency.exponentialRampToValueAtTime(620, t + 0.07);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + 0.1);
    } catch (e) { }
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 跳过：仅右下角按钮或 Esc 键，避免误触/双击打断序列 */
  function skipNow() {
    if (started && !finished) {
      aborted = true;
      fireFlashThenReveal();
    }
  }

  document.documentElement.classList.add('boot-lock');

  function cleanup() {
    document.documentElement.classList.remove('boot-lock');
    if (layer.parentNode) layer.parentNode.removeChild(layer);
    if (flash.parentNode) flash.parentNode.removeChild(flash);
    if (audio) { audio.pause(); audio.src = ''; }
    document.removeEventListener('keydown', onKey);
    try { sessionStorage.setItem(SK, '1'); } catch (e) { }
  }

  function fireFlashThenReveal() {
    if (finished) return;
    finished = true;
    document.removeEventListener('keydown', onKey);
    stopFx();
    if (actx) { try { actx.close(); } catch (e) { } actx = null; noiseBuf = null; }
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

  /* 命令打完短暂停顿后，瞬时追加绿色执行结果 */
  async function typeLine(term, text, cls, speed, res) {
    var line = document.createElement('div');
    line.className = 'boot-line' + (cls ? ' ' + cls : '');
    term.appendChild(line);
    for (var i = 0; i < text.length; i++) {
      if (aborted) return;
      line.textContent += text.charAt(i);
      keyClick();
      await sleep(speed);
    }
    if (res) {
      await sleep(140);
      if (aborted) return;
      var r = document.createElement('span');
      r.className = 'boot-res';
      r.textContent = '  ' + res;
      line.appendChild(r);
      resBlip();
    }
  }

  /* ---------- 访客诊断数据：服务端连通 / IP 地理 / 设备 / UTC ---------- */
  function gatherDiag() {
    var diag = { rtt: null, ipRes: null };

    /* 服务端连通：请求本站 favicon 计时 */
    var t0 = performance.now();
    try {
      fetch('/favicon.ico?diag=' + Date.now(), { cache: 'no-store' })
        .then(function () { diag.rtt = Math.max(1, Math.round(performance.now() - t0)); })
        .catch(function () { diag.rtt = -1; });
    } catch (e) { diag.rtt = -1; }

    /* IP + 地理坐标：ipwho.is（https+CORS 免费无 Key），超时兜底 */
    var ipTimer = null;
    diag.ipPromise = new Promise(function (resolve) {
      ipTimer = setTimeout(function () { resolve(null); }, 2200);
      fetch('https://ipwho.is/', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ip) return;
          clearTimeout(ipTimer);
          diag.ip = d.ip; diag.city = d.city || ''; diag.cc = d.country_code || '';
          diag.coord = (d.latitude != null ? d.latitude.toFixed(2) : '--') + ',' + (d.longitude != null ? d.longitude.toFixed(2) : '--');
          resolve(d);
        })
        .catch(function () { /* 保留超时兜底 */ });
    });

    return diag;
  }

  function deviceInfo() {
    var ua = navigator.userAgent;
    var os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
      : /Linux/.test(ua) ? 'Linux' : 'UnknownOS';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera'
      : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return '→ ' + os + ' · ' + br + ' · ' + screen.width + '×' + screen.height;
  }

  /* ---------- 「进入」：配音 + 待机内容直接模糊消失 ---------- */
  function shatterEnter() {
    /* 配音（下沉 whoosh） */
    try {
      var sfx = new Audio(SHATTER_URL);
      sfx.volume = 0.75;
      var pp = sfx.play();
      if (pp && pp.catch) pp.catch(function () { });
    } catch (e) { }

    var standby = layer.querySelector('.boot-standby');
    if (!standby) return;
    standby.classList.add('boot-away');
    window.setTimeout(function () { if (standby.parentNode) standby.parentNode.removeChild(standby); }, 700);
  }

  /* ---------- 编程氛围：代码雨 / 假读数 / hex 流 / glitch ---------- */
  var rainRaf = 0, metricsTimer = 0, hexTimer = 0, glitchTimer = 0;

  function initRain() {
    var cv = layer.querySelector('.boot-rain');
    if (!cv || reduceMotion) return;
    var ctx = cv.getContext('2d');
    var GLYPHS = '01<>/{}[]();=+*#%$&|!?~^:'.split('').concat(
      ['fn', '=>', '0x', 'if', 'js', 'go', 'py', 'ts', 'cd', '&&', 'ls', '::', '$_', 'git']);
    var COLORS = ['0, 229, 255', '0, 229, 255', '82, 255, 156', '245, 158, 11', '255, 61, 240'];
    var COL_W = 18, W = 0, H = 0, cols = [];

    function resetCol(c) {
      c.y = -Math.random() * 40;
      c.speed = 0.7 + Math.random() * 1.5;
      c.color = COLORS[(Math.random() * COLORS.length) | 0];
      c.tick = 0;
    }
    function resize() {
      W = cv.width = layer.clientWidth;
      H = cv.height = layer.clientHeight;
      cols = [];
      for (var i = 0; i < Math.ceil(W / COL_W); i++) {
        var c = {};
        resetCol(c);
        c.y = Math.random() * (H / 16);
        cols.push(c);
      }
      ctx.clearRect(0, 0, W, H);
    }
    resize();
    window.addEventListener('resize', resize);

    var last = 0;
    (function frame(now) {
      rainRaf = requestAnimationFrame(frame);
      if (now - last < 38 || document.hidden) return;  /* ~26fps */
      last = now;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '12px Consolas, monospace';
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        c.y += c.speed;
        c.tick++;
        var gy = c.y * 14;
        if (gy > H + 20) { resetCol(c); continue; }
        if (c.tick % 2) continue;
        ctx.fillStyle = Math.random() < 0.12
          ? 'rgba(255,255,255,0.9)'
          : 'rgba(' + c.color + ',' + (0.25 + Math.random() * 0.35).toFixed(2) + ')';
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * COL_W + 3, gy);
      }
    })(0);
  }

  function startMetrics() {
    var el = layer.querySelector('#boot-metrics');
    if (!el) return;
    function tick() {
      el.textContent = 'MEM ' + (52 + ((Math.random() * 18) | 0)) + '%' +
        ' · CPU ' + (28 + ((Math.random() * 30) | 0)) + '%' +
        ' · PID ' + (1000 + ((Math.random() * 8000) | 0));
      metricsTimer = setTimeout(tick, 800);
    }
    tick();
  }

  function startHexStream() {
    var el = layer.querySelector('.boot-hex');
    if (!el) return;
    function tick() {
      var out = [];
      for (var i = 0; i < 24; i++) {
        out.push(((Math.random() * 256) | 0).toString(16).padStart(2, '0').toUpperCase());
      }
      el.textContent = '0x' + ((Math.random() * 0xffff) | 0).toString(16).padStart(4, '0').toUpperCase() +
        '  ' + out.join(' ');
      hexTimer = setTimeout(tick, 110);
    }
    tick();
  }

  function startGlitch() {
    var logos = [
      layer.querySelector('.boot-standby .boot-logo'),
      layer.querySelector('.boot-main-logo')
    ].filter(Boolean);
    function tick() {
      var el = logos[(Math.random() * logos.length) | 0];
      if (el && el.isConnected) {
        el.classList.add('boot-glitch');
        setTimeout(function () { el.classList.remove('boot-glitch'); }, 320);
      }
      glitchTimer = setTimeout(tick, 1800 + Math.random() * 2200);
    }
    tick();
  }

  function stopFx() {
    if (rainRaf) cancelAnimationFrame(rainRaf);
    clearTimeout(metricsTimer); clearTimeout(hexTimer); clearTimeout(glitchTimer);
  }

  /* ---------- 主序列 ---------- */
  async function runSequence(diag) {
    var stage = layer.querySelector('.boot-stage');
    var term = layer.querySelector('.boot-term');
    var ringWrap = layer.querySelector('.boot-ring-wrap');
    var ringBar = layer.querySelector('.boot-ring-bar');
    var pct = layer.querySelector('.boot-ring-pct');
    var welcome = layer.querySelector('.boot-welcome');

    stage.hidden = false;

    /* 光标常驻最后一行 */
    var cursor = document.createElement('span');
    cursor.className = 'boot-cursor';
    term.appendChild(cursor);

    var C = 2 * Math.PI * 54;
    ringBar.style.strokeDasharray = C;
    ringBar.style.strokeDashoffset = C;

    /* t≈0.9s 起打字；等待 IP 查询最多 1.2s（通常几百毫秒就返回） */
    await sleep(900);
    var ipData = await Promise.race([diag.ipPromise, sleep(900).then(function () { return null; })]);
    if (aborted) return fireFlashThenReveal();

    var ipRes = ipData && ipData.ip
      ? '→ IP ' + ipData.ip + ' · ' + (ipData.city || '') + ' ' + (ipData.country_code || '') +
        ' (' + (ipData.latitude != null ? ipData.latitude.toFixed(1) : '--') + ',' +
        (ipData.longitude != null ? ipData.longitude.toFixed(1) : '--') + ')'
      : '→ IP 已加密 · GEO N/A';
    var utcRes = '→ ' + new Date().toISOString().slice(0, 19) + 'Z';
    var rttRes = diag.rtt != null
      ? (diag.rtt >= 0 ? '→ 200 OK · ' + diag.rtt + 'ms' : '→ LINK DOWN · 重试中')
      : '→ 200 OK · SYNC…';

    var lines = [
      ['$ ping zhangpengchao.com', 'boot-cmd', 18, rttRes],
      ['$ curl -s ipwho.is', 'boot-cmd', 18, ipRes],
      ['$ whoami --device', 'boot-cmd', 18, deviceInfo()],
      ['$ date -u', 'boot-cmd', 18, utcRes]
    ];
    for (var i = 0; i < lines.length; i++) {
      term.insertBefore(cursor, null);
      await typeLine(term, lines[i][0], lines[i][1], lines[i][2], lines[i][3]);
      if (aborted) return fireFlashThenReveal();
      await sleep(90);
    }

    /* 圆环 2.6s 0→100（总时长向 8.7s 音效靠拢，避免音效被掐断） */
    ringWrap.classList.add('boot-show');
    var T0 = performance.now(), DUR = 2600;
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

    /* WELCOME 显示：淡出终端/圆环/hex（代码雨保持流动，无背景遮罩框） */
    await sleep(300);
    stage.classList.add('boot-clear');
    welcome.classList.add('boot-show');
    await sleep(1500);
    fireFlashThenReveal();
  }

  /* ---------- 交互 ---------- */
  function onKey(e) {
    if (e.key === 'Escape') skipNow();
  }
  document.addEventListener('keydown', onKey);

  layer.addEventListener('click', function () {
    if (finished) return;
    if (!started) {
      started = true;
      startedAt = Date.now();
      /* 音频需要用户手势，此刻播放 */
      try {
        audio = new Audio(AUDIO_URL);
        audio.volume = 0.72;
        var pp = audio.play();
        if (pp && pp.catch) pp.catch(function () { /* 自动播放被拒则静默 */ });
      } catch (e) { }
      initTypingSfx(); /* 用户手势内创建 AudioContext，打字音效可用 */
      layer.querySelector('.boot-skip').hidden = false;
      shatterEnter();
      var diag = gatherDiag();
      runSequence(diag);
    }
    /* 播放中点击页面不再跳过 —— 防止双击/误触打断序列；
       跳过只走右下角「跳过 · Esc」按钮或 Esc 键 */
  });

  /* 跳过按钮（阻止冒泡，避免触发待机启动逻辑） */
  layer.querySelector('.boot-skip').addEventListener('click', function (e) {
    e.stopPropagation();
    skipNow();
  });

  document.body.appendChild(layer);
  document.body.appendChild(flash);
  tickClock(); /* layer 挂载后再启动时钟 */
  initRain(); startMetrics(); startHexStream(); startGlitch();
})();
