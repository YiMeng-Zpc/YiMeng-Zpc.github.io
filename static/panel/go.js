/* 固定入口跳转逻辑。
 * endpoint 文件放在仓库根目录（不在 Hugo workflow 的 paths 里），
 * 所以面板更新它不会触发博客重新构建，改完立刻可读。
 * 三个读取源依次兜底：GitHub API（最新）→ raw → jsDelivr。
 * 目标地址做 host 白名单校验，避免仓库内容被改后把人带到别处。
 */
(function () {
  'use strict';

  var OWNER = 'YiMeng-Zpc';
  var REPO = 'YiMeng-Zpc.github.io';
  var BRANCH = 'main';
  var FILE = 'panel-endpoint.json';
  var AUTO_MS = 2600;

  var $ = function (id) { return document.getElementById(id); };
  var elState = $('st'), elUrl = $('url'), elTime = $('time'), elBar = $('bar');
  var btnGo = $('go'), btnCopy = $('copy'), btnCancel = $('cancel');
  var box = $('fallback'), input = $('manual');
  var target = '', timer = null, tick = null, cancelled = false, seq = 0;

  function setState(kind, text) {
    elState.className = 'state' + (kind ? ' ' + kind : '');
    elState.querySelector('span').textContent = text;
  }
  function setUrl(v) { elUrl.textContent = v || '—'; }
  function setTime(ms) {
    if (!ms) { elTime.textContent = '—'; return; }
    var d = new Date(ms);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    elTime.textContent = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  /* endpoint 里只有 ASCII（URL + 时间戳），直接 atob 就够，不用 UTF-8 那套绕法 */
  function b64(s) {
    try { return atob(String(s).replace(/\s+/g, '')); }
    catch (e) { return null; }
  }
  /* 只允许 Cloudflare 隧道域名和自有域名，别的都不跳 */
  function safe(u) {
    if (!u || typeof u !== 'string') return null;
    var m = u.match(/^https:\/\/([a-z0-9.-]+)(\/|$)/i);
    if (!m) return null;
    var h = m[1].toLowerCase();
    if (/(\.|^)trycloudflare\.com$/.test(h)) return u;
    if (/(\.|^)zhangpengchao\.com$/.test(h)) return u;
    if (/(\.|^)workers\.dev$/.test(h)) return u;
    if (/(\.|^)pages\.dev$/.test(h)) return u;
    return null;
  }
  function parse(text, fromApi) {
    var j = JSON.parse(text);
    if (fromApi && j && j.content) j = JSON.parse(b64(j.content) || 'null');
    if (!j || !j.u) return null;
    var u = safe(b64(j.u));
    if (!u) return null;
    return { url: u, t: Number(j.t) || 0, m: j.m || '' };
  }
  function sources() {
    var t = Date.now();
    return [
      { u: 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + FILE + '?ref=' + BRANCH + '&t=' + t, api: true },
      { u: 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + FILE + '?t=' + t, api: false },
      { u: 'https://cdn.jsdelivr.net/gh/' + OWNER + '/' + REPO + '@' + BRANCH + '/' + FILE + '?t=' + t, api: false }
    ];
  }
  function loadOne(s) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', s.u, true);
      x.timeout = 7000;
      if (s.api) x.setRequestHeader('Accept', 'application/vnd.github+json');
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) return reject(new Error('HTTP ' + x.status));
        try { var r = parse(x.responseText, s.api); return r ? resolve(r) : reject(new Error('格式不对')); }
        catch (e) { reject(e); }
      };
      x.onerror = function () { reject(new Error('网络不可达')); };
      x.ontimeout = function () { reject(new Error('超时')); };
      x.send();
    });
  }
  function load() {
    var list = sources(), i = 0, my = ++seq;
    function next() {
      if (my !== seq) return;
      if (i >= list.length) return fail('三个数据源都读不到');
      var s = list[i++];
      loadOne(s).then(function (r) { if (my === seq) ok(r); }, next);
    }
    next();
  }
  function ok(r) {
    target = r.url;
    setUrl(r.url);
    setTime(r.t);
    setState('ok', '在线 · 已就绪');
    btnGo.disabled = false; btnCopy.disabled = false; btnCancel.disabled = false;
    var age = Date.now() - r.t;
    if (r.t && age > 1000 * 60 * 60 * 24) setState('', '地址可能已过期');
    if (!cancelled) countdown();
  }
  function fail(msg) {
    setState('err', msg);
    setUrl('暂时拿不到地址');
    box.style.display = 'block';
    btnCancel.disabled = false;
  }
  function countdown() {
    var start = Date.now();
    clearInterval(tick);
    tick = setInterval(function () {
      var p = Math.min(1, (Date.now() - start) / AUTO_MS);
      elBar.style.width = (p * 100) + '%';
      if (p >= 1) { clearInterval(tick); go(); }
    }, 40);
  }
  function go() {
    if (!target) return;
    clearInterval(tick); clearTimeout(timer);
    window.location.replace(target);
  }
  function copy(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { btnCopy.textContent = '已复制 ✓'; },
        function () { btnCopy.textContent = '复制失败'; });
    } else {
      var a = document.createElement('textarea');
      a.value = txt; document.body.appendChild(a); a.select();
      try { document.execCommand('copy'); btnCopy.textContent = '已复制 ✓'; }
      catch (e) { btnCopy.textContent = '复制失败'; }
      document.body.removeChild(a);
    }
    setTimeout(function () { btnCopy.textContent = '复制地址'; }, 2000);
  }

  btnGo.addEventListener('click', go);
  btnCopy.addEventListener('click', function () { if (target) copy(target); });
  btnCancel.addEventListener('click', function () {
    cancelled = true; clearInterval(tick); clearTimeout(timer);
    elBar.style.width = '0'; btnCancel.disabled = true;
    setState('ok', '已取消自动跳转');
  });
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var u = safe(String(input.value || '').trim());
    if (!u) { input.value = ''; input.placeholder = '只接受 trycloudflare.com 或自有域名的 https 地址'; return; }
    window.location.replace(u);
  });

  /* 鼠标跟随高光 */
  var card = $('card');
  card.addEventListener('mousemove', function (e) {
    var r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  load();
  /* 页面开着不关时，每 60 秒重新取一次，隧道换地址也能跟上。
     用户点过「取消自动跳转」就只更新显示，不再强制跳转。 */
  setInterval(load, 60000);
})();
