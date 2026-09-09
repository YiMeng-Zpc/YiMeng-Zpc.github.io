/* ============================================
   瓦力机器人滚动指示器 v2 — 3D 转身版
   - 右侧固定轨道，瓦力机器人随滚动位置移动
   - 向下滚动：机器人朝下移动，身后留下碾压痕迹
   - 反方向滚动：三阶段时序
       1) 停止移动（freeze 120ms）
       2) 3D 转身（rotateY 180° 翻面，露出无眼的黄色后壳 + 小跳 + 扬尘）
       3) 转身后朝新方向移动
   - 行进中机器人朝行进方向倾斜（3D lean），像真的在开
   ============================================ */
(function () {
  'use strict';

  // 尊重减少动效偏好
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // 移动端不显示（太窄了没空间）
  if (window.matchMedia('(max-width: 768px)').matches) {
    return;
  }

  function initWalleScroll() {
    var track = document.getElementById('walle-track');
    if (!track) return;

    var robot = document.getElementById('walle-robot');
    var trailContainer = document.getElementById('walle-trail');
    if (!robot || !trailContainer) return;

    var maxScroll = 1;
    var trackHeight = 0;
    var currentY = 0;        // 机器人当前 Y 位置（相对 track）
    var targetY = 0;         // 目标 Y 位置
    var lastScrollTop = 0;   // 上一次的 scrollTop
    var direction = 0;       // 初始未定；之后 1=向下, -1=向上
    var turning = false;     // 转身进行中：暂停移动
    var turnTimer = null;

    // 轨迹点：记录机器人经过的位置，用于绘制碾压痕迹
    var trailPoints = [];
    var maxTrailPoints = 50;

    function recalc() {
      var scrollHeight = document.documentElement.scrollHeight;
      var clientHeight = document.documentElement.clientHeight;
      maxScroll = Math.max(1, scrollHeight - clientHeight);
      trackHeight = Math.max(1, track.clientHeight - 40);
    }

    function getScrollPercent() {
      var st = window.pageYOffset || document.documentElement.scrollTop;
      return Math.max(0, Math.min(1, st / maxScroll));
    }

    function updateTarget() {
      targetY = getScrollPercent() * trackHeight;

      var st = window.pageYOffset || document.documentElement.scrollTop;
      var delta = st - lastScrollTop;
      lastScrollTop = st;

      if (Math.abs(delta) > 2) {
        var newDir = delta > 0 ? 1 : -1;
        if (newDir !== direction && !turning) {
          // 方向变了 → 三阶段转身
          direction = newDir;
          applyFacing();
          startTurn();
        }
      }
    }

    /* 持久化朝向：
       - direction = 1（向下滚）→ 背面朝外（walle-facing-down）
       - direction = -1（向上滚）→ 正面朝外（移除 walle-facing-down）
       翻转后 class 保留，机器人保持新朝向，不再自动转回 */
    function applyFacing() {
      robot.classList.toggle('walle-facing-down', direction === 1);
    }

    /* ---------- 3D 转身（三阶段） ---------- */
    function startTurn() {
      turning = true;

      // 阶段1：先停一下（惯性感知），同时刹车扬尘
      robot.classList.add('walle-brake');
      spawnDust();
      clearTimeout(turnTimer);
      turnTimer = setTimeout(function () {
        // 阶段2：3D 翻面 + 小跳 + 扬尘
        // 注意：朝向切换已由 applyFacing 通过 .walle-facing-down 持久完成，
        // 这里只触发一次性的小跳动画（walle-hopping）
        robot.classList.remove('walle-brake');
        robot.classList.add('walle-hopping');
        spawnDust();
        // 阶段3：转身完成后解锁移动（朝向 class 保持，不撤销）
        setTimeout(function () {
          robot.classList.remove('walle-hopping');
          turning = false;
        }, 520);
      }, 130);
    }

    function spawnDust() {
      // 转身扬尘：2~3 个尘土点，用 trail canvas 上层的小 div
      for (var i = 0; i < 3; i++) {
        (function (idx) {
          var d = document.createElement('div');
          d.className = 'walle-dust';
          d.style.setProperty('--dx', (Math.random() * 18 - 9) + 'px');
          d.style.animationDelay = (idx * 40) + 'ms';
          robot.appendChild(d);
          setTimeout(function () {
            if (d.parentNode) d.parentNode.removeChild(d);
          }, 700 + idx * 40);
        })(i);
      }
    }

    /* ---------- 主动画循环 ---------- */
    function animate() {
      if (!turning) {
        // 平滑插值：机器人从 currentY 向 targetY 靠近
        var diff = targetY - currentY;
        if (Math.abs(diff) > 0.5) {
          currentY += diff * 0.16;
        } else {
          currentY = targetY;
        }
      }
      // 转身中保持原位（不更新 currentY），但 transform 仍要刷新

      // 行进倾斜：向行进方向倾斜 8°（3D 感），停下时回正
      // 位移写入独立的 translate Property（CSS 属性 `translate`），与 hop/转身动画互不冲突
      var moving = Math.abs(targetY - currentY) > 2 && !turning;
      var lean = moving ? (direction === 1 ? 8 : -8) : 0;

      robot.style.translate = '0px ' + currentY.toFixed(1) + 'px';
      robot.style.transform = lean ? 'rotateZ(' + lean + 'deg)' : '';

      // 在路径上添加碾压痕迹
      if (moving && Math.abs(targetY - currentY) > 1) {
        addTrailPoint(currentY + 20); // 机器人底部位置
      }

      renderTrail();
      requestAnimationFrame(animate);
    }

    function addTrailPoint(y) {
      trailPoints.push({ y: y, time: Date.now() });
      if (trailPoints.length > maxTrailPoints) {
        trailPoints.shift();
      }
    }

    function renderTrail() {
      var now = Date.now();
      trailPoints = trailPoints.filter(function (p) {
        return now - p.time < 3000;
      });

      var canvas = trailContainer;
      if (canvas.tagName !== 'CANVAS') return;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;

      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < trailPoints.length; i++) {
        var p = trailPoints[i];
        var age = (now - p.time) / 3000;
        var alpha = (1 - age) * 0.35;
        var size = (1 - age) * 3 + 1;

        // 履带印：两条平行短横线
        ctx.fillStyle = 'rgba(245, 158, 11, ' + alpha + ')';
        ctx.fillRect(w / 2 - 7, p.y, 4, size);
        ctx.fillRect(w / 2 + 3, p.y, 4, size);

        // 中间点（碾压碎屑）
        if (i % 3 === 0) {
          ctx.fillStyle = 'rgba(56, 189, 248, ' + (alpha * 0.6) + ')';
          ctx.fillRect(w / 2 - 1, p.y - 1, 2, 2);
        }
      }
    }

    function setupCanvas() {
      var canvas = trailContainer;
      if (canvas.tagName !== 'CANVAS') return;
      canvas.width = 48;
      canvas.height = track.clientHeight;
    }

    // 初始化
    recalc();
    setupCanvas();
    lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    updateTarget();
    currentY = targetY;
    robot.style.translate = '0px ' + currentY.toFixed(1) + 'px';

    // 监听滚动（throttle 到 rAF）
    var scrollPending = false;
    window.addEventListener('scroll', function () {
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(function () {
          updateTarget();
          scrollPending = false;
        });
      }
    }, { passive: true });

    // 窗口 resize 重新计算
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        recalc();
        setupCanvas();
        updateTarget();
      }, 200);
    });

    animate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalleScroll);
  } else {
    initWalleScroll();
  }
})();
