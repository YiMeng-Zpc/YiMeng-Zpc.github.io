/* ============================================
   YiMeng Blog - Homepage 3D Earth
   - Per-pixel true-sphere rendering:
       each pixel maps to lon/lat independently, so
       continents keep correct shapes and no seam line
   - Great-circle flight routes between continents:
       moving signal dots with light trails and
       z-depth occlusion (airline-route feel)
   - Tilted satellite orbit with a trailing flyer
   ============================================ */

(function () {
  'use strict';

  function initEarth() {
    var canvas = document.getElementById('earth-canvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var W = 0, H = 0, cx = 0, cy = 0, ballR = 0;

    // ---------- globals ----------
    var rotationRad = 0;
    var ROT_SPEED = 0.22;      // rad/s
    var dashOffset = 0;
    var time = 0, last = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W;
      canvas.height = H;
      cx = W / 2;
      cy = H / 2;
      ballR = Math.min(W, H) / 2 * 0.82;   // big globe (0.82 of half-size)
      buildOffscreen();
    }

    // ---------- offscreen sphere buffer (per-pixel mapping) ----------
    var off = null, octx = null, outImg = null, outPix = null, OLEN = 0;

    function buildOffscreen() {
      OLEN = Math.max(2, Math.round(ballR * 2));
      off = document.createElement('canvas');
      off.width = OLEN;
      off.height = OLEN;
      octx = off.getContext('2d');
      outImg = octx.createImageData(OLEN, OLEN);
      outPix = outImg.data;
    }

    // ---------- texture ----------
    var img = new Image();
    img.src = '/img/earth-equirect.webp';
    var texOK = false, texData = null, texW = 0, texH = 0;
    img.onload = function () {
      texW = img.naturalWidth;
      texH = img.naturalHeight;
      var tc = document.createElement('canvas');
      tc.width = texW;
      tc.height = texH;
      var tctx = tc.getContext('2d');
      tctx.drawImage(img, 0, 0);
      texData = tctx.getImageData(0, 0, texW, texH).data;
      texOK = true;
    };

    // render sphere into offscreen buffer (true per-pixel lon/lat mapping)
    function renderSphere(rot) {
      if (!texOK) {
        octx.clearRect(0, 0, OLEN, OLEN);
        octx.fillStyle = '#0c4a6e';
        octx.beginPath();
        octx.arc(OLEN / 2, OLEN / 2, OLEN / 2, 0, Math.PI * 2);
        octx.fill();
        return;
      }
      var R = OLEN / 2, R2 = R * R, iw = texW, ih = texH, td = texData;
      var TWO_PI = Math.PI * 2;
      for (var py = 0; py < OLEN; py++) {
        var dy = py - R, dy2 = dy * dy;
        for (var px = 0; px < OLEN; px++) {
          var oi = (py * OLEN + px) * 4;
          var dx = px - R;
          var d2 = dx * dx + dy2;
          if (d2 > R2) {
            outPix[oi + 3] = 0;
            continue;
          }
          var z3 = Math.sqrt(R2 - d2);
          var lon = Math.atan2(dx, z3) + rot;
          var lat = -Math.asin(dy / R);
          var u = (lon + Math.PI) / TWO_PI;
          u -= Math.floor(u);
          var v = 0.5 - lat / Math.PI;      // v=0 north pole
          var tx = Math.floor(u * iw);
          if (tx >= iw) tx = iw - 1;
          var ty = Math.floor(v * ih);
          if (ty >= ih) ty = ih - 1;
          var ti = (ty * iw + tx) * 4;
          outPix[oi]     = td[ti];
          outPix[oi + 1] = td[ti + 1];
          outPix[oi + 2] = td[ti + 2];
          outPix[oi + 3] = 255;
        }
      }
      octx.putImageData(outImg, 0, 0);
    }

    // ---------- geo helpers ----------
    var D2R = Math.PI / 180;

    function ll2vec(latDeg, lonDeg) {
      var la = latDeg * D2R, lo = lonDeg * D2R;
      var cl = Math.cos(la);
      return [cl * Math.cos(lo), Math.sin(la), cl * Math.sin(lo)];
    }

    function rotY(v, a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    }

    function slerp(a, b, t) {
      var dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
      var theta = Math.acos(dot);
      if (theta < 1e-6) return a.slice();
      var st = Math.sin(theta);
      var s0 = Math.sin((1 - t) * theta) / st;
      var s1 = Math.sin(t * theta) / st;
      return [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
    }

    function proj(v) {
      return [cx + v[0] * ballR, cy - v[1] * ballR, v[2]];
    }

    // ---------- cities & flight routes ----------
    var cities = [
      ll2vec(39.9, 116.4),    // 0 Beijing
      ll2vec(31.2, 121.5),    // 1 Shanghai
      ll2vec(35.7, 139.7),    // 2 Tokyo
      ll2vec(25.2, 55.3),     // 3 Dubai
      ll2vec(48.9, 2.35),     // 4 Paris
      ll2vec(51.5, -0.13),    // 5 London
      ll2vec(40.7, -74.0),    // 6 New York
      ll2vec(34.1, -118.2),   // 7 Los Angeles
      ll2vec(-33.9, 151.2),   // 8 Sydney
      ll2vec(30.0, 31.2),     // 9 Cairo
      ll2vec(-23.5, -46.6),   // 10 Sao Paulo
      ll2vec(55.8, 37.6)      // 11 Moscow
    ];

    var routes = [
      { a: 0, b: 4,  color: '#00f0ff', speed: 0.045, phase: 0.00 },
      { a: 2, b: 6,  color: '#ff2bd6', speed: 0.038, phase: 0.31 },
      { a: 3, b: 5,  color: '#f59e0b', speed: 0.052, phase: 0.62 },
      { a: 1, b: 8,  color: '#34d399', speed: 0.046, phase: 0.47 },
      { a: 6, b: 7,  color: '#9d4edd', speed: 0.060, phase: 0.15 },
      { a: 4, b: 10, color: '#00f0ff', speed: 0.042, phase: 0.78 },
      { a: 0, b: 9,  color: '#9d4edd', speed: 0.050, phase: 0.24 },
      { a: 11, b: 5, color: '#f59e0b', speed: 0.048, phase: 0.88 }
    ];

    function drawRoute(route, rot) {
      var a = cities[route.a], b = cities[route.b];
      var N = 64, pts = [];
      // 大圆弧爬升航线：从城市出发爬升离球面 → 跨越大洋 → 降落
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var p = slerp(a, b, t);
        // 高度曲线：正弦拱形，最高处离球面 0.22R
        var hgt = Math.sin(Math.PI * t) * 0.22;
        // 沿球面法线方向抬升（球面点本身是单位向量，直接乘 (1+hgt)）
        var lift = 1 + hgt;
        var lp = [p[0] * lift, p[1] * lift, p[2] * lift];
        pts.push(proj(rotY(lp, rot)));
      }

      // path (front-facing segments only)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = route.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      var drawing = false;
      for (var j = 0; j <= N; j++) {
        if (pts[j][2] >= 0) {
          if (!drawing) { ctx.moveTo(pts[j][0], pts[j][1]); drawing = true; }
          else ctx.lineTo(pts[j][0], pts[j][1]);
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // moving signal dot + trail (on the lifted arc)
      var prog = (time * route.speed + route.phase) % 1;
      var pp = slerp(a, b, prog);
      var hgt2 = Math.sin(Math.PI * prog) * 0.22;
      var lp2 = [pp[0] * (1 + hgt2), pp[1] * (1 + hgt2), pp[2] * (1 + hgt2)];
      var rv = rotY(lp2, rot);
      if (rv[2] < 0) return;
      var sp = proj(rv);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (var k = 9; k >= 1; k--) {
        var tt = Math.max(0, prog - 0.022 * k);
        var tq = slerp(a, b, tt);
        var th = Math.sin(Math.PI * tt) * 0.22;
        var tl = [tq[0] * (1 + th), tq[1] * (1 + th), tq[2] * (1 + th)];
        var tv = rotY(tl, rot);
        if (tv[2] < 0) continue;
        var tp = proj(tv);
        ctx.strokeStyle = route.color;
        ctx.globalAlpha = 0.03 + (1 - k / 9) * 0.55;
        ctx.lineWidth = 1 + (1 - k / 9) * 2.4;
        ctx.beginPath();
        ctx.moveTo(tp[0], tp[1]);
        ctx.lineTo(sp[0], sp[1]);
        ctx.stroke();
      }
      // glow
      var g = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 12);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, route.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], 12, 0, Math.PI * 2);
      ctx.fill();
      // core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---------- tilted orbit + flyer ----------
    var tilt = 26 * D2R;
    var orbitAngle = 0;
    var ORB_SPEED = 0.5;

    function drawOrbit(dt) {
      orbitAngle += ORB_SPEED * dt;
      var Ro = ballR * 1.22;
      var N = 96, began = false;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(0,240,255,0.45)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([6, 9]);
      ctx.lineDashOffset = -dashOffset * 1.6;
      ctx.beginPath();
      for (var i = 0; i < N; i++) {
        var ang = i / N * Math.PI * 2;
        var x = Ro * Math.cos(ang);
        var y = Ro * Math.sin(ang);
        var z = y * Math.sin(tilt);
        if (z < 0) { began = false; continue; }
        var sy = y * Math.cos(tilt);
        if (!began) { ctx.moveTo(cx + x, cy - sy); began = true; }
        else ctx.lineTo(cx + x, cy - sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // flyer with trail
      var fx = Ro * Math.cos(orbitAngle);
      var fy = Ro * Math.sin(orbitAngle);
      var fz = fy * Math.sin(tilt);
      if (fz < 0) return;
      var fsy = fy * Math.cos(tilt);
      var fpx = cx + fx, fpy = cy - fsy;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (var k = 10; k >= 1; k--) {
        var aa = orbitAngle - k * 0.04;
        var tx2 = Ro * Math.cos(aa), ty2 = Ro * Math.sin(aa);
        var tz2 = ty2 * Math.sin(tilt);
        if (tz2 < 0) continue;
        var tsy2 = ty2 * Math.cos(tilt);
        ctx.strokeStyle = '#7df9ff';
        ctx.globalAlpha = 0.02 + (1 - k / 10) * 0.45;
        ctx.lineWidth = 1 + (1 - k / 10) * 2.2;
        ctx.beginPath();
        ctx.moveTo(cx + tx2, cy - tsy2);
        ctx.lineTo(fpx, fpy);
        ctx.stroke();
      }
      var g = ctx.createRadialGradient(fpx, fpy, 0, fpx, fpy, 10);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, '#7df9ff');
      g.addColorStop(1, 'rgba(0,240,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fpx, fpy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---------- glow & shading ----------
    function drawGlow() {
      var g = ctx.createRadialGradient(cx, cy, ballR * 0.9, cx, cy, ballR * 1.5);
      g.addColorStop(0, 'rgba(56,189,248,0.30)');
      g.addColorStop(0.5, 'rgba(56,189,248,0.10)');
      g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, ballR * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawShade() {
      var s = ctx.createRadialGradient(
        cx - ballR * 0.35, cy - ballR * 0.35, ballR * 0.1,
        cx, cy, ballR * 1.05
      );
      s.addColorStop(0, 'rgba(255,255,255,0.18)');
      s.addColorStop(0.4, 'rgba(255,255,255,0.02)');
      s.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = s;
      ctx.beginPath();
      ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------- city anchor points (glowing) ----------
    function drawCities(rot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < cities.length; i++) {
        var v = rotY(cities[i], rot);
        if (v[2] < 0) continue;
        var p = proj(v);
        // halo ring
        ctx.strokeStyle = 'rgba(125,249,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
        ctx.stroke();
        // core dot
        ctx.fillStyle = 'rgba(125,249,255,0.95)';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ---------- main loop ----------
    function frame(ts) {
      if (!last) last = ts;
      var dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      time += dt;
      rotationRad += ROT_SPEED * dt;
      dashOffset += dt * 16;

      ctx.clearRect(0, 0, W, H);

      drawGlow();
      renderSphere(rotationRad);
      ctx.drawImage(off, cx - ballR, cy - ballR, ballR * 2, ballR * 2);
      drawShade();

      drawOrbit(dt);
      drawCities(rotationRad);
      for (var i = 0; i < routes.length; i++) {
        drawRoute(routes[i], rotationRad);
      }

      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEarth);
  } else {
    initEarth();
  }
})();