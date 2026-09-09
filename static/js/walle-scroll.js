/* ============================================
   瓦力机器人滚动指示器
   - 右侧固定轨道，瓦力机器人随滚动位置移动
   - 向下滚动：机器人朝下移动，身后留下碾压痕迹
   - 向上滚动：机器人迅速转身（180° 翻转），然后向上移动，重复碾压回去
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

    var scrollHeight = 0;
    var clientHeight = 0;
    var maxScroll = 1;
    var trackHeight = 0;
    var currentY = 0;       // 机器人当前 Y 位置（相对 track）
    var targetY = 0;         // 目标 Y 位置
    var lastScrollTop = 0;   // 上一次的 scrollTop
    var direction = 1;       // 1=向下, -1=向上
    var rafId = null;

    // 轨迹点：记录机器人经过的位置，用于绘制碾压痕迹
    var trailPoints = [];
    var maxTrailPoints = 50;

    function recalc() {
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = document.documentElement.clientHeight;
      maxScroll = Math.max(1, scrollHeight - clientHeight);
      trackHeight = track.clientHeight - 40; // 减去机器人高度（约40px）让它能到顶部
    }

    function getScrollPercent() {
      var st = window.pageYOffset || document.documentElement.scrollTop;
      return Math.max(0, Math.min(1, st / maxScroll));
    }

    function updateTarget() {
      var p = getScrollPercent();
      targetY = p * trackHeight;

      var st = window.pageYOffset || document.documentElement.scrollTop;
      var delta = st - lastScrollTop;
      lastScrollTop = st;

      if (Math.abs(delta) > 2) {
        var newDir = delta > 0 ? 1 : -1;
        if (newDir !== direction) {
          // 方向变了 → 机器人转身
          direction = newDir;
          robot.classList.add('walle-turn');
          setTimeout(function () {
            robot.classList.remove('walle-turn');
          }, 350);
        }
      }
    }

    function animate() {
      // 平滑插值：机器人从 currentY 向 targetY 靠近
      var diff = targetY - currentY;
      if (Math.abs(diff) > 0.5) {
        currentY += diff * 0.18; // 缓动系数
      } else {
        currentY = targetY;
      }

      robot.style.transform = 'translateY(' + currentY.toFixed(1) + 'px)';

      // 在路径上添加碾压痕迹
      if (Math.abs(diff) > 1) {
        addTrailPoint(currentY + 20); // 机器人底部位置
      }

      // 更新轨迹渲染
      renderTrail();

      rafId = requestAnimationFrame(animate);
    }

    function addTrailPoint(y) {
      var time = Date.now();
      trailPoints.push({ y: y, time: time });
      if (trailPoints.length > maxTrailPoints) {
        trailPoints.shift();
      }
    }

    function renderTrail() {
      // 用 DOM 元素绘制碾压痕迹（履带印）
      // 简化方案：每隔一段距离生成一个小横条
      var now = Date.now();
      // 清理过期痕迹（超过 3 秒的）
      trailPoints = trailPoints.filter(function (p) {
        return now - p.time < 3000;
      });

      // 高效渲染：用 Canvas 代替多个 DOM 元素
      var canvas = trailContainer;
      if (canvas.tagName !== 'CANVAS') return;

      var ctx = canvas.getContext('2d');
      if (!ctx) return;

      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 绘制碾压痕迹（履带印）
      for (var i = 0; i < trailPoints.length; i++) {
        var p = trailPoints[i];
        var age = (now - p.time) / 3000; // 0~1
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
    robot.style.transform = 'translateY(' + currentY + 'px)';

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

    // 启动动画循环
    animate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalleScroll);
  } else {
    initWalleScroll();
  }
})();
