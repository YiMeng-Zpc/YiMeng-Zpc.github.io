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

    // M8: 尊重用户偏好
    // - 「减少动效 (prefers-reduced-motion)」是系统级无障碍偏好，明确要求少动画 → 隐藏重特效
    // - 触屏 (pointer: coarse) 不再当作轻量模式：渲染缓冲已优化到 512px + 隔帧重算，
    //   手机端与桌面端共享同一渲染管线，视觉一致
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      canvas.style.display = 'none';
      return;
    }

    var ctx = canvas.getContext('2d');
    // 用真实 dpr（不超过 3），让手机端 3xDPR 屏幕显示原生像素密度，不再模糊
    var dpr = Math.min(window.devicePixelRatio || 1, 3);

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

    // M18-r2: 渲染缓冲上限 512px
    // 手机端 180css×3dpr=540 物理像素，桌面 240css×2dpr=480 物理像素
    // 512px offscreen 足够覆盖显示物理像素，1:1 绘制无放大模糊
    // 配合「隔帧重算」节流（每帧重算 256²≈6.5万像素，每像素 6 次三角函数，约 3-5ms），
    // 整体帧时间 <16ms
    var OLEN_MAX = 512;

    function buildOffscreen() {
      OLEN = Math.max(2, Math.min(Math.round(ballR * 2), OLEN_MAX));
      off = document.createElement('canvas');
      off.width = OLEN;
      off.height = OLEN;
      octx = off.getContext('2d');
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'medium';
      outImg = octx.createImageData(OLEN, OLEN);
      outPix = outImg.data;
    }

    // ---------- texture ----------
    var img = new Image();
    img.src = '/img/earth-equirect-seamless.webp';
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

    // render sphere into offscreen buffer (per-pixel lon/lat + Lambert lighting)
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
      // light direction: from upper-left-front, normalized
      var lx = -0.5, ly = -0.5, lz = 0.707;
      var llen = Math.sqrt(lx*lx + ly*ly + lz*lz);
      lx /= llen; ly /= llen; lz /= llen;
      var ambient = 0.42;   // ambient light floor
      var diffuseK = 0.58;  // diffuse intensity
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
          var vv = 0.5 - lat / Math.PI;
          var tx = Math.floor(u * iw);
          if (tx >= iw) tx = iw - 1;
          if (tx < 0) tx = 0;
          var ty = Math.floor(vv * ih);
          if (ty >= ih) ty = ih - 1;
          if (ty < 0) ty = 0;
          var ti = (ty * iw + tx) * 4;
          // sphere normal (normalized)
          var nx = dx / R, ny = dy / R, nz = z3 / R;
          // Lambert diffuse
          var dot = nx*lx + ny*ly + nz*lz;
          if (dot < 0) dot = 0;
          var light = ambient + diffuseK * dot;
          // rim light for edge glow (atmosphere)
          var rim = Math.pow(1 - nz, 4) * 0.06;
          light += rim;
          if (light > 1) light = 1;
          outPix[oi]     = Math.min(255, (td[ti]     * light) | 0);
          outPix[oi + 1] = Math.min(255, (td[ti + 1] * light) | 0);
          outPix[oi + 2] = Math.min(255, (td[ti + 2] * light) | 0);
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
      // 经度映射：lon=0 → +Z 方向（与 renderSphere 的 atan2(dx, z3) 一致）
      // 之前用 cos(lon) 在 X，sin(lon) 在 Z，导致城市标记偏西 90°（落海）。
      return [cl * Math.sin(lo), Math.sin(la), cl * Math.cos(lo)];
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
    // 全球 42 个真实大城市（首都/经济中心），经纬度精确（4K 贴图下可使用真实坐标无需偏移）
    var CITY_DEFS = [
      { name: 'Beijing',    lat: 39.9, lon: 116.4 },   // 北京
      { name: 'Shanghai',   lat: 31.2, lon: 121.5 },   // 上海
      { name: 'Tokyo',      lat: 35.7, lon: 139.7 },   // 东京
      { name: 'Seoul',      lat: 37.6, lon: 127.0 },   // 首尔
      { name: 'Hong Kong',  lat: 22.64, lon: 113.94 },  // 香港（向西北偏 0.36° 落到广东内陆，避开 4K 贴图海面像素）
      { name: 'Singapore',  lat: 1.63, lon: 103.59 },  // 新加坡（向东北偏 0.32° 落在马来半岛内陆）
      { name: 'Bangkok',    lat: 13.7, lon: 100.5 },   // 曼谷
      { name: 'Jakarta',    lat: -6.2, lon: 106.8 },   // 雅加达
      { name: 'Mumbai',     lat: 19.1, lon: 72.9 },    // 孟买
      { name: 'Karachi',    lat: 24.9, lon: 67.0 },    // 卡拉奇
      { name: 'Dubai',      lat: 24.7, lon: 55.5 },    // 迪拜（向内陆偏 0.5° 落在沙漠）
      { name: 'Riyadh',     lat: 24.7, lon: 46.7 },    // 利雅得
      { name: 'Tehran',     lat: 35.7, lon: 51.4 },    // 德黑兰
      { name: 'Moscow',     lat: 55.8, lon: 37.6 },    // 莫斯科
      { name: 'Istanbul',   lat: 40.29, lon: 29.16 },  // 伊斯坦布尔（向南偏 0.41° 落在安那托利亚内陆）
      { name: 'Cairo',      lat: 30.0, lon: 31.2 },    // 开罗
      { name: 'Paris',      lat: 48.9, lon: 2.35 },    // 巴黎
      { name: 'London',     lat: 51.5, lon: -0.13 },   // 伦敦
      { name: 'Berlin',     lat: 52.5, lon: 13.4 },    // 柏林
      { name: 'Frankfurt',  lat: 50.1, lon: 8.7 },     // 法兰克福
      { name: 'Rome',       lat: 41.9, lon: 12.5 },    // 罗马
      { name: 'Madrid',     lat: 40.4, lon: -3.7 },    // 马德里
      { name: 'Barcelona',  lat: 41.8, lon: 2.15 },    // 巴塞罗那（向比利牛斯山方向偏 0.4° 避开地中海沿岸）
      { name: 'Reykjavík',  lat: 64.20, lon: -21.60 },  // 雷克雅未克（向东偏 0.3° 落到冰岛内陆，避开西海岸）
      { name: 'New York',   lat: 40.7, lon: -74.0 },   // 纽约
      { name: 'Toronto',    lat: 43.7, lon: -79.4 },   // 多伦多
      { name: 'Chicago',    lat: 41.9, lon: -87.6 },   // 芝加哥
      { name: 'Los Angeles',lat: 34.1, lon: -118.2 },  // 洛杉矶
      { name: 'Vancouver',  lat: 49.35, lon: -122.95 }, // 温哥华（向东北偏 ~0.2° 落到北温哥华内陆，避开海湾）
      { name: 'Mexico City',lat: 19.4, lon: -99.1 },   // 墨西哥城
      { name: 'Sao Paulo',  lat: -23.5, lon: -46.6 },  // 圣保罗
      { name: 'Buenos Aires',lat: -34.6, lon: -58.4 }, // 布宜诺斯艾利斯
      { name: 'Lima',       lat: -12.0, lon: -76.23 }, // 利马（向内陆偏 0.32° 落在安第斯山麓，避开太平洋海面像素）
      { name: 'Bogotá',     lat: 4.7, lon: -74.1 },    // 波哥大
      { name: 'Santiago',   lat: -33.4, lon: -70.7 },  // 圣地亚哥
      { name: 'Cape Town',  lat: -33.70, lon: 18.65 },  // 开普敦（向东偏 0.25° 落到内陆山麓）
      { name: 'Nairobi',    lat: -1.3, lon: 36.8 },    // 内罗毕
      { name: 'Lagos',      lat: 6.70, lon: 3.40 },     // 拉各斯（向北偏 0.2° 落到内陆，避开 Lagos 岛礁）
      { name: 'Sydney',     lat: -33.7, lon: 150.4 },  // 悉尼（向内陆偏 ~0.8° 落在蓝山区域）
      { name: 'Melbourne',  lat: -37.8, lon: 144.9 },  // 墨尔本
      { name: 'Auckland',   lat: -36.85, lon: 174.76 }, // 奥克兰（4K 贴图下新西兰可见，精确真实坐标）
      { name: 'Johannesburg', lat: -26.2, lon: 28.0 }   // 约翰内斯堡
    ];

    var cities = [];
    for (var ci = 0; ci < CITY_DEFS.length; ci++) {
      cities.push(ll2vec(CITY_DEFS[ci].lat, CITY_DEFS[ci].lon));
    }
    var C = cities.length;   // 42 个城市

    var ROUTE_COLORS = ['#00f0ff', '#ff2bd6', '#9d4edd', '#f59e0b', '#34d399', '#ff6b6b'];

    // 大圆弧角距离（弧度）
    function arcLen(a, b) {
      var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      if (d > 1) d = 1; else if (d < -1) d = -1;
      return Math.acos(d);
    }

    // 随机生成一条长途航线（≥60° 大圆弧），颜色/速度/相位/拱高全随机
    function makeRandomRoute() {
      var MIN_ARC = Math.PI / 3;   // 60° —— 避免同城或同城郊区小圈圈
      for (var tries = 0; tries < 40; tries++) {
        var a = Math.floor(Math.random() * C);
        var b = Math.floor(Math.random() * C);
        if (a === b) continue;
        // 同时避开已存在的端点重复（同一个城市同时出现在太多条航线上视觉杂乱）
        var dup = 0;
        for (var r = 0; r < routes.length; r++) {
          if (routes[r].a === a || routes[r].b === a ||
              routes[r].a === b || routes[r].b === b) dup++;
        }
        if (dup > 2) continue;   // 任一端点关联航线 ≤ 2 条
        if (arcLen(cities[a], cities[b]) >= MIN_ARC) {
          return {
            a: a, b: b,
            color: ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)],
            speed: 0.030 + Math.random() * 0.040,    // 0.030 ~ 0.070
            phase: Math.random(),
            lift: 0.13 + Math.random() * 0.18        // 0.13 ~ 0.31
          };
        }
      }
      return null;
    }

    // 航线池：每次页面加载随机生成（不再固定主干航线）
    // M18-r2 移除「触屏轻量」航线数量降级 —— 隔帧重算后手机端也能跑满 18 条，
    // 视觉与桌面端一致（用户反馈 '手机端效果要和电脑一样'）
    var routes = [];
    var MAX_ROUTES = 18;
    var INITIAL_ROUTES = 12;

    for (var sp = 0; sp < INITIAL_ROUTES; sp++) {
      var r0 = makeRandomRoute();
      if (r0) routes.push(r0);
    }

    // 定期添加随机新航线
    function spawnRandomRoute() {
      if (routes.length >= MAX_ROUTES) {
        routes.shift();   // 移除最旧的一条
      }
      var r = makeRandomRoute();
      if (r) routes.push(r);
    }

    // 4-9 秒添加一条
    var nextRouteAt = 3 + Math.random() * 4;
    function updateRoutePool(dt) {
      nextRouteAt -= dt;
      if (nextRouteAt <= 0) {
        spawnRandomRoute();
        nextRouteAt = 4 + Math.random() * 5;
      }
    }

    function drawRoute(route, rot) {
      var a = cities[route.a], b = cities[route.b];
      var N = 64, pts = [];
      // 大圆弧爬升航线：从城市出发爬升离球面 → 跨越大洋 → 降落
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var p = slerp(a, b, t);
        // 高度曲线：正弦拱形，最高处离球面 route.lift * R
        var hgt = Math.sin(Math.PI * t) * route.lift;
        // 沿球面法线方向抬升（球面点本身是单位向量，直接乘 (1+hgt)）
        var lift = 1 + hgt;
        var lp = [p[0] * lift, p[1] * lift, p[2] * lift];
        pts.push(proj(rotY(lp, -rot)));
      }

      // path (front-facing segments only)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = route.color;
      ctx.globalAlpha = 0.62;
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
      var hgt2 = Math.sin(Math.PI * prog) * route.lift;
      var lp2 = [pp[0] * (1 + hgt2), pp[1] * (1 + hgt2), pp[2] * (1 + hgt2)];
      var rv = rotY(lp2, -rot);
      if (rv[2] < 0) return;
      var sp = proj(rv);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (var k = 9; k >= 1; k--) {
        var tt = Math.max(0, prog - 0.022 * k);
        var tq = slerp(a, b, tt);
        var th = Math.sin(Math.PI * tt) * route.lift;
        var tl = [tq[0] * (1 + th), tq[1] * (1 + th), tq[2] * (1 + th)];
        var tv = rotY(tl, -rot);
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
    // 球体上光：高光（左上）+ 暗角（右下）—— 突出立体感
    function drawShade() {
      var s = ctx.createRadialGradient(
        cx - ballR * 0.35, cy - ballR * 0.35, ballR * 0.1,
        cx, cy, ballR * 1.05
      );
      s.addColorStop(0, 'rgba(255,255,255,0.05)');     // 上左高光（强度 0.18 -> 0.05，避免球面"发雾"）
      s.addColorStop(0.4, 'rgba(255,255,255,0.01)');
      s.addColorStop(1, 'rgba(0,0,0,0.22)');   // 右下暗角（0.32 -> 0.22，避免压暗南部陆地）
      ctx.fillStyle = s;
      ctx.beginPath();
      ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------- city anchor points (glowing) ----------
    // 三层环：外晕圈（半径 5，淡青）+ 中环（半径 2.8，实色）+ 亮芯（半径 1.6，白色）
    // 加强后即使在 240px 球体上也清晰可见
    function drawCities(rot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < cities.length; i++) {
        var v = rotY(cities[i], -rot);
        if (v[2] < 0) continue;
        var p = proj(v);
        // outer halo ring
        ctx.strokeStyle = 'rgba(125,249,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
        ctx.stroke();
        // mid ring (实色，可见度更高)
        ctx.strokeStyle = 'rgba(125,249,255,0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.8, 0, Math.PI * 2);
        ctx.stroke();
        // bright core dot
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ---------- main loop ----------
    var frameCount = 0;
    function frame(ts) {
      if (!last) last = ts;
      var dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      time += dt;
      rotationRad += ROT_SPEED * dt;
      dashOffset += dt * 16;
      frameCount++;

      ctx.clearRect(0, 0, W, H);

      // M18-r2 隔帧重算：球体每两帧重算一次（旋转角变化 ~0.22*0.033=0.007rad 几乎不可察）
      // 航线/城市/轨道每帧都画（它们没有 6 个三角函数的重计算）
      if (frameCount % 2 === 1 || !texOK) {
        renderSphere(rotationRad);
      }
      ctx.drawImage(off, cx - ballR, cy - ballR, ballR * 2, ballR * 2);
      drawShade();

      drawOrbit(dt);
      drawCities(rotationRad);
      updateRoutePool(dt);
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