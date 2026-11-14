// Included inline in the standalone TV document, in both development and production.
// No dependency on the Next/React client or a live server after the initial downloads.
export const PLAYER_SCRIPT = String.raw`(function () {
  "use strict";
  var manifest = JSON.parse(document.getElementById("tv-snapshot").textContent);
  var items = manifest.items;
  var frame = document.getElementById("tv-frame");
  var visible = document.getElementById("tv-image");
  var status = document.getElementById("tv-status");
  var sources = new Map();
  var urls = Array.from(new Set(items.map(function (item) { return item.url; })));
  var index = 0;
  var cursor = 0;
  var stopped = false;
  var slideTimer;
  var statusTimer;
  var requests = new Set();
  var objectUrls = new Set();

  function fit() {
    var swapped = manifest.rotation % 180 !== 0;
    var width = document.documentElement.clientWidth;
    var height = document.documentElement.clientHeight;
    frame.style.width = (swapped ? height : width) + "px";
    frame.style.height = (swapped ? width : height) + "px";
  }
  fit();
  window.addEventListener("resize", fit);

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var timer = setTimeout(function () { finish(new Error("Image load timed out")); }, 15000);
      function finish(error) {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (error) reject(error); else resolve(image);
      }
      image.onload = function () { finish(); };
      image.onerror = function () { finish(new Error("Image load failed")); };
      image.src = url;
    });
  }

  function show(next) {
    var source = sources.get(items[next].url);
    if (!source || stopped) return;
    // These URLs refer to bytes owned by this tab; switching slides never needs the server.
    visible.src = source;
    index = next;
  }

  function schedule() {
    if (stopped || items.length < 2) return;
    slideTimer = setTimeout(function () {
      for (var step = 1; step <= items.length; step++) {
        var next = (index + step) % items.length;
        if (sources.has(items[next].url)) { show(next); break; }
      }
      schedule();
    }, items[index].duration * 1000);
  }

  function progress(finished) {
    if (stopped) return;
    if (!finished) {
      status.textContent = "Đang tải ảnh để giữ trên TV: " + sources.size + "/" + urls.length;
    } else if (sources.size === urls.length) {
      status.textContent = "Đã tải đủ ảnh. Có thể tắt server; giữ tab TV đang mở.";
      statusTimer = setTimeout(function () { status.hidden = true; }, 5000);
    } else {
      status.textContent = "Đã giữ " + sources.size + "/" + urls.length + " ảnh. Mở server và reload để tải lại ảnh còn thiếu.";
    }
  }

  async function download() {
    while (!stopped && cursor < urls.length) {
      var url = urls[cursor++];
      var controller = new AbortController();
      requests.add(controller);
      var timer = setTimeout(function () { controller.abort(); }, 30000);
      var objectUrl = undefined;
      try {
        var response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Image download failed");
        var blob = await response.blob();
        if (stopped) return;
        objectUrl = URL.createObjectURL(blob);
        await loadImage(objectUrl);
        if (stopped) { URL.revokeObjectURL(objectUrl); return; }
        objectUrls.add(objectUrl);
        sources.set(url, objectUrl);
        // Replace the initial network image as soon as its retained copy is ready.
        if (items[index].url === url) show(index);
        else if (!sources.has(items[index].url)) {
          show(items.findIndex(function (item) { return item.url === url; }));
        }
        progress(false);
      } catch (_) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        // Keep the currently displayed image. Never reload or clear it on network errors.
      } finally {
        clearTimeout(timer);
        requests.delete(controller);
      }
    }
  }

  // Only local timers remain once these initial image downloads finish.
  Promise.all([download(), download()]).then(function () {
    progress(true);
    if (sources.size) schedule();
  });
  window.addEventListener("pagehide", function (event) {
    if (event.persisted) return;
    stopped = true;
    clearTimeout(slideTimer);
    clearTimeout(statusTimer);
    requests.forEach(function (controller) { controller.abort(); });
    objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
  });
})();`;
