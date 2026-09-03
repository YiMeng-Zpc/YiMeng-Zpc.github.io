/* ============================================
   ✦ 忆梦博客 · 主页 3D 旋转地球 ✦
   - 逐列纹理映射：消除 180° 经线接缝白线
   - 粒子发射系统：带发光拖尾，向外飞散
   - 卫星倾斜轨道：z 深度判断，绕到背面自动遮挡
   ============================================ */

(function () {
  'use strict';

  function initEarth() {
    var canvas = document.getElementById('earth-canvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 球体参数（相对 canvas 周长）
    var SIZE = 0.5;      // 球半径占画布一半比例
    var TILT = 30;       // 轨道倾斜角（度）

    var img = new Image();
    img.src = '/img/earth-equirect.webp';

    // 粒子系统
    var particles = [];
    var emitters = [];
    var MAX_PARTICLES = 60;

    // 卫星轨道
    var satAngle = 0;
    var SAT_SPEED = 0.9;   // 弧度/秒

    var W = 0, H = 0;       // canvas 物理像素
    var cx = 0, cy = 0, R = 0, ballR = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.round(rect.width * dpr);
      H = Math.round(rect.height * dpr);
      canvas.width = W;
      canvas.height = H;
      cx = W / 2;
      cy = H / 2;
      R = Math.min(W, H) / 2;        // 画布可用半径
      ballR = R * SIZE;              // 地球像素半径
    }
    resize();
    window.addEventListener('resize', resize);

    // 发射点（球面固定 3D 方向，球心原点，z 正指向观察者）
    // 用经纬度表示：lon（经度，绕 y 轴）、lat（纬度）
    function makeEmitters() {
      emitters = [
        { lon: -40, lat: 15,  color: '#00f0ff', acc: 0 },   // 青蓝
        { lon: 135,  lat: 30,  color: '#9d4edd', acc: 1.2 }, // 紫
        { lon: 250,  lat: -25, color: '#ff2bd6', acc: 2.4 }, // 粉
        { lon: 30,   lat: -40, color: '#00f0ff', acc: 3.6 }  // 青蓝
      ];
    }
    makeEmitters();

    // 3D 球面方向 -> 屏幕坐标（正交投影）
    // 球体自转：经度随时间滚动（纹理旋转）
    function spherePoint(lonDeg, latDeg, rot, radius) {
      var lon = (lonDeg + rot) * Math.PI / 180;
      var lat = latDeg * Math.PI / 180;
      // 3D 单位向量
      var x = Math.cos(lat) * Math.cos(lon);
      var y = Math.sin(lat);
      var z = Math.cos(lat) * Math.sin(lon);   // 正 z 指向观察者
      return { x: x, y: y, z: z, sx: cx + x * radius, sy: cy - y * radius };
    }

    // 发射一粒（从球面径向向外 + 随机扩散）
    function spawnParticle(emitter, rot) {
      if (particles.length >= MAX_PARTICLES) return;
      var p3 = spherePoint(emitter.lon, emitter.lat, rot, 1);
      // 3D 位置从球面开始
      var spread = (Math.random() - 0.5) * 40;  // 切向随机散布（度）
      var rlat = emitter.lat + (Math.random() - 0.5) * 30;
      var rlon = emitter.lon + (Math.random() - 0.5) * 40;
      var dir = spherePoint(rlon, rlat, rot, 1);

      // 径向向外速度（单位向量近似 dir）+ 随机扩散
      var speed = ballR * (1.4 + Math.random() * 1.6);   // 像素/秒
      var vx = dir.x + (Math.random() - 0.5) * 0.5;
      var vy = dir.y + (Math.random() - 0.5) * 0.5;
      var vz = dir.z + 0.3 + Math.random() * 0.6;        // 偏向观察者（向前喷）

      particles.push({
        x: p3.x * ballR,
        y: p3.y * ballR,
        z: p3.z * ballR,
        vx: vx * speed,
        vy: vy * speed,
        vz: vz * speed,
        life: 1.0,                        // 1 -> 0
        decay: 0.5 + Math.random() * 0.7, // 每秒衰减
        size: 1.5 + Math.random() * 2.5,
        color: emitter.color,
        history: []                        // 拖尾轨迹
      });
    }

    // 更新粒子
    function updateParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.life -= p.decay * dt;
        // 记录拖尾
        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > 4) p.history.shift();
        if (p.life <= 0 || p.z > ballR * 1.6) {
          particles.splice(i, 1);
        }
      }
    }

    // 发射器周期性喷发
    var emitAccum = 0;
    function emit(dt) {
      emitAccum += dt;
      var interval = 0.12;   // 每 0.12s 喷一轮
      if (emitAccum >= interval) {
        emitAccum = 0;
        for (var i = 0; i < emitters.length; i++) {
          // 每轮每个发射点喷 1 粒（随机 skip 制造不规则感）
          if (Math.random() < 0.8) spawnParticle(emitters[i], rotation);
        }
      }
    }

    // 绘制球体（逐列纹理映射，消除接缝）
    function drawSphere(rot) {
      if (!img.complete || img.naturalWidth === 0) {
        // 图片未加载：画纯色球
        ctx.fillStyle = '#0c4a6e';
        ctx.beginPath();
        ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var rotFrac = ((rot % 360) + 360) % 360 / 360;  // 0..1

      // 逐列绘制：屏幕列 dx 对应经度，取纹理列
      var step = 1;  // 每列 1px（物理像素），可调大提升性能
      for (var dx = -Math.ceil(ballR); dx <= Math.ceil(ballR); dx += step) {
        var xAbs = Math.abs(dx);
        if (xAbs > ballR) continue;
        var h = Math.sqrt(ballR * ballR - xAbs * xAbs);  // 该列半高

        // 经度：屏幕 x 映射到球面经度，asin(dx/R) ∈ [-90°, 90°]
        var lonRad = Math.asin(dx / ballR);   // 左半边为负经度
        var lonFrac = (lonRad / (Math.PI * 2)) - rotFrac;
        lonFrac = ((lonFrac % 1) + 1) % 1;
        var texX = Math.floor(lonFrac * iw);

        // 从贴图取 1 列（width=1），拉伸到球面对应高度
        ctx.drawImage(
          img,
          texX, 0, step, ih,          // 源：纹理第 texX 列
          cx + dx, cy - h, step, h * 2  // 目标：屏幕列
        );
      }
    }

    // 绘制粒子（带拖尾，z>0 在球前才可见，粒子均在观察者侧）
    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        // 粒子始终向前喷（z>0），无需背面遮挡，但拖尾要有发光感
        var alpha = Math.max(0, p.life);
        var sx = cx + p.x;
        var sy = cy - p.y;

        // 拖尾
        if (p.history.length > 1) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (var k = 1; k < p.history.length; k++) {
            var h0 = p.history[k - 1];
            var h1 = p.history[k];
            var t = k / p.history.length;
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = alpha * t * 0.5;
            ctx.lineWidth = p.size * t;
            ctx.beginPath();
            ctx.moveTo(cx + h0.x, cy - h0.y);
            ctx.lineTo(cx + h1.x, cy - h1.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 粒子光点
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 3);
        g.addColorStop(0, p.color);
        g.addColorStop(0.4, p.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        // 白色高光芯
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 球体光影（径向高光 + 底部暗影，增强立体感）
    function drawShading() {
      var g = ctx.createRadialGradient(
        cx - ballR * 0.35, cy - ballR * 0.35, ballR * 0.1,
        cx, cy, ballR * 1.1
      );
      g.addColorStop(0, 'rgba(255,255,255,0.20)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 大气辉光
    function drawGlow() {
      var g = ctx.createRadialGradient(cx, cy, ballR, cx, cy, ballR * 1.35);
      g.addColorStop(0, 'rgba(56,189,248,0.30)');
      g.addColorStop(0.6, 'rgba(56,189,248,0.10)');
      g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, ballR * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // 卫星倾斜轨道 + 前后遮挡
    function drawSatellite(dt) {
      satAngle += SAT_SPEED * dt;
      var tilt = TILT * Math.PI / 180;
      var Ro = ballR * 1.45;   // 轨道半径

      // 3D 轨道（绕 x 轴倾斜 tilt）
      var ox = Ro * Math.cos(satAngle);
      var oy = Ro * Math.sin(satAngle) * Math.cos(tilt);
      var oz = Ro * Math.sin(satAngle) * Math.sin(tilt);

      var sx = cx + ox;
      var sy = cy - oy;

      // 轨道椭圆：完整画（地球后侧轨道用较暗虚线，前侧亮）
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, Ro, Ro * Math.cos(tilt), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 卫星本体（z 判断前后遮挡）
      if (oz >= 0) {
        // 前侧：正常亮度
        ctx.save();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // 后侧：被地球遮挡，隐藏（或画微弱投影）
        // 此处不绘制，实现遮挡
      }
    }

    var rotation = 0;
    var ROT_SPEED = 20;   // 度/秒
    var lastTime = 0;

    function frame(t) {
      if (!lastTime) lastTime = t;
      var dt = Math.min((t - lastTime) / 1000, 0.05);  // 限制 dt 防跳帧
      lastTime = t;

      rotation += ROT_SPEED * dt;

      // 清空
      ctx.clearRect(0, 0, W, H);

      // 1. 大气辉光（最底）
      drawGlow();

      // 2. 地球球体
      drawSphere(rotation);
      drawShading();

      // 3. 卫星轨道（含前后遮挡）
      drawSatellite(dt);

      // 4. 粒子发射（最前层）
      emit(dt);
      updateParticles(dt);
      drawParticles();

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEarth);
  } else {
    initEarth();
  }
})();