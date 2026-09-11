/* ============================================
   失效图片降级处理
   - 图床图片 404 时隐藏对应占位，避免页面出现满屏裂图
   - 采用「捕获阶段」事件委托，自动适配 PJAX 动态插入的内容
   - 图片恢复后可正常显示，无需改动本文件
   ============================================ */

(function () {
  'use strict';

  function markFailed(img) {
    if (!img || img.dataset.imgFailed === '1') return;
    img.dataset.imgFailed = '1';

    // 相册图：隐藏外层 <a class="article-gallery-img">
    var item = img.closest('.article-gallery-img');
    if (item) {
      item.style.display = 'none';
    } else {
      img.style.display = 'none';
    }

    var gallery = img.closest('.article-gallery');
    if (gallery) checkGallery(gallery);
  }

  // 若整个相册的图全部失效，连容器一起隐藏，避免留下空白区块
  function checkGallery(gallery) {
    var items = gallery.querySelectorAll('.article-gallery-img');
    if (!items.length) return;

    var allFailed = true;
    for (var i = 0; i < items.length; i++) {
      var im = items[i].querySelector('img');
      if (!im) {
        allFailed = false;
        continue;
      }
      // 尚未开始加载（lazyload 未赋 src）或已成功，都不算失败
      if (!(im.getAttribute('src') && im.complete && im.naturalWidth === 0)) {
        allFailed = false;
      }
    }
    if (allFailed) gallery.style.display = 'none';
  }

  // error / load 事件不冒泡，必须在捕获阶段监听
  document.addEventListener(
    'error',
    function (e) {
      if (e.target && e.target.tagName === 'IMG') markFailed(e.target);
    },
    true
  );

  // 兜底扫描：处理在本脚本执行前就已经加载失败的图片
  function sweep() {
    var imgs = document.querySelectorAll(
      '.article-gallery-img img, .article-entry img'
    );
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      // 关键：lazyload 图片的 src 已被移除，此时 naturalWidth 恒为 0，
      // 必须跳过，否则会误隐藏尚未加载的正常图片
      if (!im.getAttribute('src')) continue;
      if (im.complete && im.naturalWidth === 0) markFailed(im);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sweep);
  } else {
    sweep();
  }
  window.addEventListener('load', sweep);
  document.addEventListener('pjax:complete', sweep);
})();
