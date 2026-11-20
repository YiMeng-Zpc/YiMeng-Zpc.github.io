/* ============================================================================
 * 启动序列（Boot Sequence）
 * ----------------------------------------------------------------------------
 * 灵感来自用户分享的「面板打开过程」视频（DeepSeek 客户端开场）：
 *
 *   ① 暗底上疏朗的几道**长弧线**（不是满屏网格 —— 密网格会显得杂乱）
 *   ② 左上角品牌字 + 一行蓝色等宽小字
 *   ③ 居中中文大字（打字机）+ 下方英文小字副标题 + 中间一道细横线
 *   ④ 一圈**巨大的发光圆弧**，长时间旋转（占屏宽的一半左右）
 *   ⑤ 细进度条 + 滚动校验码
 *   ⑥ WELCOME TO 大字 + 带反白底框的副标签
 *
 * 用在 https://www.zhangpengchao.com/panel/ 这个固定入口页上：
 * 打开书签 → 先看一段启动序列 → 再跳进面板。
 * 全程零依赖：纯 canvas + DOM + WebAudio 合成音效。
 * ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;

  /* ---------------- 小工具 ---------------- */
  function el(tag, cls, html) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function reducedMotion() {
    return typeof global.matchMedia === 'function' &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function randToken(n) {
    var chars = '0123456789ABCDEF', out = '';
    for (var i = 0; i < n; i++) out += chars[(Math.random() * 16) | 0];
    return out;
  }

  /* ======================================================================
   * 音效（WebAudio 实时合成，不带任何外部音频文件）
   * ----------------------------------------------------------------------
   * 浏览器自动播放策略：没有用户手势时 AudioContext 是 suspended，
   * 所以默认**静音**，页面上给一个「♪ 音效」按钮让用户自己开。
   * ==================================================================== */
  function SoundKit() {
    var ctx = null;
    var master = null;
    var enabled = false;

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;          // 整体压低，别吓人
      master.connect(ctx.destination);
      return ctx;
    }

    function now() { return ctx.currentTime; }

    /* 单个正弦/三角音，带包络 */
    function tone(freq, dur, type, vol, delay) {
      if (!enabled) return;
      var c = ensure();
      if (!c) return;
      var t0 = now() + (delay || 0);
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol == null ? 0.5 : vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }

    /* 噪声脉冲（用于"咔哒"类音效） */
    function noise(dur, vol, hp) {
      if (!enabled) return;
      var c = ensure();
      if (!c) return;
      var t0 = now();
      var len = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      var src = c.createBufferSource();
      src.buffer = buf;
      var f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp || 1800;
      var g = c.createGain();
      g.gain.value = vol == null ? 0.35 : vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0);
    }

    return {
      /* 打字机的每一下轻响 */
      tick: function () { noise(0.035, 0.16, 2600); tone(1750, 0.03, 'square', 0.03); },
      /* 一步完成的上行提示音 */
      ok: function () {
        tone(660, 0.13, 'sine', 0.32);
        tone(990, 0.18, 'sine', 0.24, 0.075);
      },
      /* 圆弧转起来时的低频嗡鸣（起手） */
      spin: function () {
        tone(140, 0.55, 'sine', 0.18);
        tone(280, 0.4, 'triangle', 0.09, 0.05);
      },
      /* WELCOME 的和弦 */
      welcome: function () {
        tone(523.25, 0.5, 'sine', 0.3);
        tone(659.25, 0.5, 'sine', 0.26, 0.09);
        tone(783.99, 0.6, 'sine', 0.22, 0.18);
        tone(1046.5, 0.7, 'sine', 0.16, 0.27);
      },
      /* 跳转前的短促"出发"音 */
      launch: function () {
        tone(880, 0.1, 'triangle', 0.24);
        tone(1320, 0.16, 'sine', 0.18, 0.06);
      },
      enable: function () {
        var c = ensure();
        if (!c) return false;
        if (c.state === 'suspended') c.resume();
        enabled = true;
        return true;
      },
      disable: function () { enabled = false; },
      isEnabled: function () { return enabled; },
    };
  }

  /* ======================================================================
   * 背景：疏朗的长弧线
   * ----------------------------------------------------------------------
   * 视频里的背景不是密网格，而是**少数几条粗细不一的发光弧**，
   * 加上一些缓慢漂移的小光点。这里用贝塞尔弧 + 三层描边做辉光。
   * 数量刻意压得很低（5~7 条），避免杂乱。
   * ==================================================================== */
  function ArcField(canvas) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var t = 0, raf = 0, running = true;
    var arcs = [];
    var dots = [];
    var reduce = reducedMotion();

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = canvas.clientWidth || global.innerWidth;
      H = canvas.clientHeight || global.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      arcs.length = 0;
      dots.length = 0;
      var n = Math.max(4, Math.min(7, Math.round(W / 260)));
      for (var i = 0; i < n; i++) {
        arcs.push({
          cx: W * (0.12 + Math.random() * 0.76),
          cy: H * (0.1 + Math.random() * 0.8),
          r: Math.min(W, H) * (0.18 + Math.random() * 0.55),
          a0: Math.random() * Math.PI * 2,
          span: 0.5 + Math.random() * 1.5,      // 弧的张开角度（弧长）
          w: 0.7 + Math.random() * 1.9,          // 线宽
          sp: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.14),
          ph: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.32 ? 1 : 0,    // 1=偏紫，0=偏蓝
          al: 0.18 + Math.random() * 0.3,
        });
      }
      var dn = Math.max(14, Math.min(30, Math.round(W / 52)));
      for (var j = 0; j < dn; j++) {
        dots.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.5 + Math.random() * 1.1,
          vx: (Math.random() - 0.5) * 0.13,
          vy: (Math.random() - 0.5) * 0.13,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }

    function strokeArc(a, width, alpha, color) {
      var a0 = a.a0 + t * a.sp + a.ph;
      var a1 = a0 + a.span;
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, a.r, a0, a1);
      ctx.strokeStyle = color(alpha);
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function step() {
      t += 0.006;
      ctx.clearRect(0, 0, W, H);

      /* 光点缓慢漂移 */
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx; d.y += d.vy;
        if (d.x < -10) d.x = W + 10; else if (d.x > W + 10) d.x = -10;
        if (d.y < -10) d.y = H + 10; else if (d.y > H + 10) d.y = -10;
        var g = 0.5 + 0.5 * Math.sin(t * 2.6 + d.ph);
        ctx.beginPath();
        ctx.fillStyle = 'rgba(180, 220, 255, ' + (0.14 + g * 0.3).toFixed(3) + ')';
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 弧线：三层描边做辉光（外层很淡很粗 → 内层很亮很细） */
      for (var k = 0; k < arcs.length; k++) {
        var a = arcs[k];
        var breathe = 0.72 + 0.28 * Math.sin(t * 1.7 + a.ph);
        var base = a.al * breathe;
        var col = a.hue
          ? function (al) { return 'rgba(178, 158, 255, ' + al.toFixed(3) + ')'; }
          : function (al) { return 'rgba(126, 196, 255, ' + al.toFixed(3) + ')'; };
        strokeArc(a, a.w * 5.5, base * 0.14, col);
        strokeArc(a, a.w * 2.2, base * 0.34, col);
        strokeArc(a, a.w * 0.8, base, col);
      }
    }

    function loop() {
      if (!running) return;
      step();
      raf = global.requestAnimationFrame(loop);
    }

    function start() {
      resize();
      global.addEventListener('resize', resize, { passive: true });
      if (reduce) { step(); return; }
      loop();
    }
    function stop() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      global.removeEventListener('resize', resize);
    }
    return { start: start, stop: stop };
  }

  /* ======================================================================
   * 主流程
   * ==================================================================== */
  var active = null;
  var sound = null;

  function ensureSound() {
    if (!sound) sound = SoundKit();
    return sound;
  }

  /* 打字机：onStep 在每步**开始时**回调，用于同步副标题与计数 */
  function typewriter(node, text, speed, onStep, tick) {
    return new Promise(function (resolve) {
      if (reducedMotion()) {
        node.textContent = text;
        node.classList.add('done');
        if (onStep) onStep();
        resolve();
        return;
      }
      var i = 0;
      node.textContent = '';
      if (onStep) onStep();
      (function tickFn() {
        i++;
        node.textContent = text.slice(0, i);
        if (tick) tick();
        if (i >= text.length) {
          node.classList.add('done');
          setTimeout(resolve, 320);
          return;
        }
        setTimeout(tickFn, speed);
      })();
    });
  }

  function start(opt) {
    opt = opt || {};
    if (active) active.close();

    var steps = opt.steps && opt.steps.length ? opt.steps : ['正在初始化面板'];
    /* 每步配一条英文副标题（视频里中文大字下面就是一行小号英文） */
    var subs = opt.subs && opt.subs.length ? opt.subs : steps.map(function (s) { return s; });
    var title = opt.title || 'WELCOME TO';
    var tag = opt.tag || 'SECURE CONSOLE';
    var brand = opt.brand || '全栈监控面板';
    var subBrand = opt.subBrand || 'LOCAL MONITOR · HARNESS';
    var corner = opt.corner || 'PUBLIC ACCESS · <b>PROTECTED</b>';
    var fast = !!opt.fast;          // 调试用：跳过等待
    var R = fast ? 0.12 : 1;        // 时间缩放

    doc.body.classList.add('booting');

    var wrap = el('div', 'boot');
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');

    var canvas = el('canvas', 'boot-net');
    wrap.appendChild(canvas);

    /* 左上角品牌 */
    var brandBox = el('div', 'boot-brand');
    brandBox.appendChild(el('b', null, brand));
    brandBox.appendChild(el('span', null, subBrand));
    wrap.appendChild(brandBox);

    /* 中央舞台 */
    var stage = el('div', 'boot-stage');
    var line = el('div', 'boot-line');
    var sub = el('div', 'boot-sub');
    var rule = el('div', 'boot-rule');
    var ring = el('div', 'boot-ring');
    ring.appendChild(el('i', 'boot-ring-core'));
    var bar = el('div', 'boot-bar');
    var barFill = el('i');
    bar.appendChild(barFill);
    var hash = el('div', 'boot-hash');
    var welcome = el('div', 'boot-welcome');
    welcome.appendChild(el('b', null, title));
    welcome.appendChild(el('em', null, tag));
    stage.appendChild(ring);
    stage.appendChild(line);
    stage.appendChild(sub);
    stage.appendChild(rule);
    stage.appendChild(bar);
    stage.appendChild(hash);
    stage.appendChild(welcome);
    wrap.appendChild(stage);

    var cornerBox = el('div', 'boot-corner');
    cornerBox.innerHTML = corner;
    wrap.appendChild(cornerBox);

    /* 音效开关（浏览器自动播放策略：必须用户手势才能出声）
     * ★ 默认**静音**，页面上给一个「♪ 音效」按钮让用户自己开。
     *   尝试自动播放会被浏览器拦（AudioContext 变 suspended），
     *   硬来反而可能报错，所以老老实实让用户点一下。 */
    var sndBtn = el('button', 'boot-snd', '♪ 音效');
    sndBtn.type = 'button';
    sndBtn.title = '点击开启音效（浏览器要求用户手势才能播放）';
    wrap.appendChild(sndBtn);

    var skip = el('button', 'boot-skip', '跳过 SKIP');
    skip.type = 'button';
    wrap.appendChild(skip);

    doc.body.appendChild(wrap);
    doc.documentElement.style.overflow = 'hidden';

    var field = ArcField(canvas);
    field.start();

    var closed = false;
    var token = randToken(16);
    var soundOn = false;

    sndBtn.addEventListener('click', function () {
      var s = ensureSound();
      if (soundOn) {
        s.disable(); soundOn = false;
        sndBtn.classList.remove('on');
        sndBtn.textContent = '♪ 音效';
      } else {
        if (s.enable()) {
          soundOn = true;
          sndBtn.classList.add('on');
          sndBtn.textContent = '♪ 音效 开';
          s.ok();
        } else {
          sndBtn.textContent = '♪ 不可用';
        }
      }
    });

    function finish() {
      if (closed) return;
      closed = true;
      wrap.classList.add('done');
      field.stop();
      doc.removeEventListener('keydown', onKey);
      doc.body.classList.remove('boot-welcome-on');
      if (active && active.close) active.close = function () {};
      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        doc.documentElement.style.overflow = '';
        active = null;
      }, 780);
      if (opt.onDone) {
        setTimeout(function () {
          doc.body.classList.remove('booting');
          opt.onDone();
        }, 240);
      } else {
        doc.body.classList.remove('booting');
        doc.body.classList.add('boot-done');
      }
    }

    skip.addEventListener('click', finish);
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    }
    doc.addEventListener('keydown', onKey);

    active = { close: function () { doc.removeEventListener('keydown', onKey); finish(); } };

    /* ---------------- 播放序列 ---------------- */
    (async function run() {
      var s = ensureSound();

      /* 1) 校验码滚动 */
      var h = '';
      for (var i = 0; i < 4; i++) {
        h += randToken(4) + ' ';
        hash.textContent = h;
        await sleep(90 * R);
      }
      hash.textContent = token;

      /* 2) 圆弧起转（伴随低频嗡鸣） */
      s.spin();

      /* 3) 逐条状态文案 —— 慢一点，每条之间留足停顿 */
      for (var k = 0; k < steps.length; k++) {
        var cur = steps[k];
        var curSub = subs[k] || cur;
        await typewriter(line, cur, 78 * R, (function (idx) {
          return function () {
            sub.textContent = curSub;
            sub.classList.remove('on');
            void sub.offsetWidth;
            sub.classList.add('on');
          };
        })(k), function () { s.tick(); });
        barFill.style.width = Math.round(((k + 1) / steps.length) * 88) + '%';
        s.ok();
        await sleep(520 * R);
      }

      barFill.style.width = '100%';
      sub.textContent = 'HANDSHAKE COMPLETE · ' + token;

      /* 4) 圆弧再转一会儿（视频里这环节占了 5-6 秒） */
      await sleep(1500 * R);

      /* 5) WELCOME 段 */
      doc.body.classList.add('boot-welcome-on');
      welcome.classList.add('on');
      s.welcome();
      await sleep(2400 * R);

      finish();
    })();

    return active;
  }

  global.Boot = {
    start: start,
    close: function () { if (active) active.close(); },
    isRunning: function () { return !!active; },
    sound: ensureSound,
  };
})(window);
