/* Bluegrass Commercial Door & More: "See it on your building" (optional photo step on the door summary).
   The customer's photo is decoded, drawn and saved entirely in this browser tab. Nothing is uploaded or sent.
   The door artwork comes from door-preview.js (same config, same drawing code as the live preview), rasterised
   once, then perspective-warped onto the photo with an exact per-pixel homography. Drag the door to move it,
   the edge bars to change width or height, or any corner freely (including on an angled photo). */
(function () {
  "use strict";
  var DP = window.DoorPreview;
  if (!DP || !DP.openingSVG || !window.HTMLCanvasElement) return;

  var MAX_EDGE = 2048;      // working photo size (long edge); phone photos are downscaled to this on the device
  var DISPLAY_MAX = 1600;   // on-screen canvas backing store (long edge)
  var TEX_H = 1400;         // door artwork raster height (px) before mip levels
  var NAMES = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];
  /* Horizontal bars (top, bottom) change height only. Vertical bars (right, left) change width only.
     pts are the two corners that move together, in the same order as NAMES. */
  var EDGES = [
    { axis: "y", orient: "h", pts: [0, 1], label: "Top edge of the door. Drag up or down to change the height." },
    { axis: "x", orient: "v", pts: [1, 2], label: "Right edge of the door. Drag left or right to change the width." },
    { axis: "y", orient: "h", pts: [2, 3], label: "Bottom edge of the door. Drag up or down to change the height." },
    { axis: "x", orient: "v", pts: [3, 0], label: "Left edge of the door. Drag left or right to change the width." }
  ];
  var HEIC_MSG = "We couldn't open that photo. It looks like a HEIC photo, which this browser can't read. Please choose a JPG or PNG instead (on an iPhone, a screenshot of the photo works too).";
  var BAD_MSG = "We couldn't open that file as a photo. Please choose a JPG or PNG photo of your doorway.";
  var SMALL_MSG = "That photo is too small to work with. Please choose a larger photo.";
  var mqLandscape = window.matchMedia("(orientation: landscape) and (max-height: 540px)");
  var mqWide = window.matchMedia("(min-width: 1024px) and (min-height: 541px)");

  var dlg, els = {}, photo = null, tex = null, texKey = "", quad = null, lastFocus = null, raf = 0, dragKind = "", dragIndex = -1, keypadShown = false, cur = null, curTag = "";

  /* ---------- opened from a finished door's "See it on your building" button (app.js) ---------- */
  window.DoorVisualize = { open: function (cfg, tag) { open(cfg, tag); }, isOpen: function () { return !!dlg && !dlg.hidden; } };

  /* ---------- dialog markup (built on first use) ---------- */
  function build() {
    dlg = document.createElement("div");
    dlg.className = "viz"; dlg.id = "viz"; dlg.hidden = true;
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", "viz-title");
    dlg.innerHTML =
      '<div class="viz__box">' +
        '<div class="viz__head"><h2 id="viz-title">See it on your building</h2>' +
          '<button type="button" class="viz__close" data-viz-close aria-label="Close and go back to your door"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
        '<p class="viz__door" data-viz-door></p>' +
        '<div class="viz__view viz__pick" data-viz-view="pick">' +
          '<p class="viz__lead">Take or choose a photo of the doorway, as straight on as you can. Then drag the four corners to fit the door into the opening.</p>' +
          '<div class="viz__pick-btns">' +
            '<label class="btn btn--accent viz__file viz__file--camera"><input type="file" accept="image/*" capture="environment" data-viz-file><span>Take a photo</span></label>' +
            '<label class="btn viz__file viz__file--choose"><input type="file" accept="image/*" data-viz-file><span>Choose a photo</span></label>' +
          '</div>' +
          '<p class="viz__drop" aria-hidden="true">or drop a photo here</p>' +
          '<p class="viz__error" data-viz-error role="alert" hidden></p>' +
          '<p class="viz__privacy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Your photo stays on your device. It isn\'t uploaded or sent anywhere.</p>' +
        '</div>' +
        '<div class="viz__view viz__fit" data-viz-view="fit" hidden>' +
          '<div class="viz__work">' +
            '<div class="viz__stage" data-viz-stage><canvas data-viz-canvas role="img" aria-label="Your photo with the door placed on it"></canvas>' +
              '<svg class="viz__move" data-viz-move aria-hidden="true" focusable="false" preserveAspectRatio="none"><polygon data-viz-move-poly points="0,0 0,0 0,0 0,0"></polygon></svg>' +
              NAMES.map(function (n, i) { return '<button type="button" class="viz__handle" data-viz-handle="' + i + '" aria-label="' + n + ' corner of the door. Use the arrow keys to move it." aria-describedby="viz-help"><span></span></button>'; }).join("") +
              EDGES.map(function (e, i) { return '<button type="button" class="viz__edge viz__edge--' + e.orient + '" data-viz-edge="' + i + '" aria-label="' + e.label + '"><span></span></button>'; }).join("") +
            '</div>' +
          '</div>' +
          '<div class="viz__side">' +
            '<p class="viz__help" id="viz-help" data-viz-help>Drag the four corners onto the corners of your door opening. Or tab to a corner and move it with the arrow keys (hold Shift to move faster).</p>' +
            '<div class="viz__controls">' +
              '<label class="viz__check"><input type="checkbox" data-viz-auto checked> Match the light in my photo</label>' +
              '<label class="viz__range"><span>Brightness</span><input type="range" min="-40" max="40" step="1" value="0" data-viz-bright aria-label="Door brightness"></label>' +
            '</div>' +
            '<div class="viz__actions">' +
              '<button type="button" class="btn btn--accent" data-viz-download>Download image</button>' +
              '<button type="button" class="btn viz__btn-line" data-viz-restart>Start over</button>' +
              '<button type="button" class="btn btn--text" data-viz-done>Back to my door</button>' +
            '</div>' +
            '<p class="viz__note">Want us to see it? Download the image and attach it to your quote email when your email app opens. Your photo stays on your device.</p>' +
            '<p class="viz__note" data-viz-keypad hidden>Your keypad mounts on the wall beside the door, so it isn\'t drawn on the photo.</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);
    var q = function (s) { return dlg.querySelector(s); };
    els = {
      box: q(".viz__box"), door: q("[data-viz-door]"), pick: q('[data-viz-view="pick"]'), fit: q('[data-viz-view="fit"]'),
      error: q("[data-viz-error]"), stage: q("[data-viz-stage]"), canvas: q("[data-viz-canvas]"), work: q(".viz__work"),
      handles: Array.prototype.slice.call(dlg.querySelectorAll("[data-viz-handle]")),
      edges: Array.prototype.slice.call(dlg.querySelectorAll("[data-viz-edge]")),
      move: q("[data-viz-move]"), movePoly: q("[data-viz-move-poly]"), help: q("[data-viz-help]"),
      auto: q("[data-viz-auto]"), bright: q("[data-viz-bright]"), keypad: q("[data-viz-keypad]"),
      files: Array.prototype.slice.call(dlg.querySelectorAll("[data-viz-file]"))
    };
    els.files.forEach(function (inp) { inp.addEventListener("change", function () { if (inp.files && inp.files[0]) loadFile(inp.files[0]); inp.value = ""; }); });
    q("[data-viz-close]").addEventListener("click", close);
    q("[data-viz-done]").addEventListener("click", close);
    q("[data-viz-restart]").addEventListener("click", startOver);
    q("[data-viz-download]").addEventListener("click", download);
    els.auto.addEventListener("change", schedule);
    els.bright.addEventListener("input", schedule);
    dlg.addEventListener("keydown", onKey);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
    // drag and drop a photo onto the dialog (desktop)
    dlg.addEventListener("dragover", function (e) { if (!photo) { e.preventDefault(); els.pick.classList.add("is-drop"); } });
    dlg.addEventListener("dragleave", function () { els.pick.classList.remove("is-drop"); });
    dlg.addEventListener("drop", function (e) {
      if (photo) return; e.preventDefault(); els.pick.classList.remove("is-drop");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f);
    });
    els.handles.forEach(function (h, i) { bindHandle(h, i); });
    els.edges.forEach(function (h, i) { bindEdge(h, i); });
    bindMove(els.movePoly);
    window.addEventListener("resize", function () { if (!dlg.hidden && photo) layout(); });
  }

  /* ---------- open / close ---------- */
  function open(cfg, tag) {
    if (!dlg) build();
    if (!cfg || cfg.empty || cfg.product !== "door") return;
    cur = cfg; curTag = tag || "";
    lastFocus = document.activeElement;
    els.door.textContent = (curTag ? curTag + ": " : "Your door: ") + cfg.summary;
    keypadShown = !!cfg.hardware.has.keypad;
    els.keypad.hidden = !keypadShown;
    dlg.hidden = false;
    document.documentElement.classList.add("viz-open");
    if (photo) {
      show("fit");
      prepareDoor(cfg).then(function () { layout(); focusFirst(); }, function () { layout(); focusFirst(); });
    } else { show("pick"); focusFirst(); }
  }
  function close() {
    if (!dlg || dlg.hidden) return;
    dlg.hidden = true;
    document.documentElement.classList.remove("viz-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && !dlg.hidden) { e.stopPropagation(); close(); } });
  function show(view) {
    els.pick.hidden = view !== "pick"; els.fit.hidden = view !== "fit";
    dlg.setAttribute("data-view", view);
  }
  function focusables() {
    return Array.prototype.filter.call(dlg.querySelectorAll("button, input"), function (el) {
      if (el.disabled || el.closest("[hidden]")) return false;
      var r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0;
    });
  }
  function focusFirst() {
    var f = photo ? els.handles[0] : focusables().filter(function (el) { return el.type === "file"; })[0];
    (f || dlg.querySelector(".viz__close")).focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key !== "Tab") return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function startOver() {
    photo = null; quad = null; els.base = null;
    els.error.hidden = true; els.bright.value = "0"; els.auto.checked = true;
    var ctx = els.canvas.getContext("2d"); ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.canvas.width = els.canvas.height = 1;
    show("pick"); focusFirst();
  }

  /* ---------- photo decoding (EXIF orientation, HEIC, size) ---------- */
  // 2x1 JPEG tagged "rotate 90°": decodes as 1x2 when the browser applies EXIF orientation itself.
  var PROBE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDFoooryz7w/9k=";
  var autoOrient = null; // Promise<{bitmap:boolean, img:boolean}>
  function probeOrientation() {
    if (autoOrient) return autoOrient;
    var viaImg = new Promise(function (res) { var im = new Image(); im.onload = function () { res(im.naturalWidth === 1); }; im.onerror = function () { res(false); }; im.src = PROBE; });
    var viaBitmap = !window.createImageBitmap ? Promise.resolve(null) :
      fetch(PROBE).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b, { imageOrientation: "from-image" }); })
        .then(function (bm) { var ok = bm.width === 1; if (bm.close) bm.close(); return ok; }).catch(function () { return null; });
    autoOrient = Promise.all([viaBitmap, viaImg]).then(function (r) { return { bitmap: r[0], img: r[1] }; });
    return autoOrient;
  }
  function exifOrientation(buf) { // JPEG only; 1 when absent
    var v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return 1;
    var o = 2;
    while (o + 4 < v.byteLength) {
      var m = v.getUint16(o); if ((m & 0xFF00) !== 0xFF00) return 1;
      var len = v.getUint16(o + 2);
      if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        var t = o + 10, le = v.getUint16(t) === 0x4949;
        var ifd = t + v.getUint32(t + 4, le), n = v.getUint16(ifd, le);
        for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (e + 10 > v.byteLength) break; if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le) || 1; }
        return 1;
      }
      if (m === 0xFFDA) return 1;
      o += 2 + len;
    }
    return 1;
  }
  function decode(file) {
    var url;
    var viaImg = function () {
      return new Promise(function (res, rej) {
        url = URL.createObjectURL(file); var im = new Image();
        im.onload = function () { res({ src: im, w: im.naturalWidth, h: im.naturalHeight, how: "img" }); };
        im.onerror = function () { rej(new Error("decode")); };
        im.src = url;
      });
    };
    return probeOrientation().then(function (auto) {
      // prefer whichever decoder turns the photo upright by itself; if neither does, rotate it ourselves from the EXIF tag
      var useBitmap = !!window.createImageBitmap && (auto.bitmap === true || (auto.bitmap === false && !auto.img));
      var p = useBitmap
        ? createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bm) { return { src: bm, w: bm.width, h: bm.height, how: "bitmap" }; }, viaImg)
        : viaImg();
      return p.then(function (d) {
        var applied = d.how === "bitmap" ? auto.bitmap : auto.img;
        if (applied || !/jpe?g$/i.test(file.type || file.name || "")) { d.orient = 1; return d; }
        return file.slice(0, 256 * 1024).arrayBuffer().then(function (b) { d.orient = exifOrientation(b); return d; }, function () { d.orient = 1; return d; });
      });
    }).then(function (d) { d.cleanup = function () { if (url) URL.revokeObjectURL(url); if (d.src.close) d.src.close(); }; return d; },
            function (err) { if (url) URL.revokeObjectURL(url); throw err; });
  }
  function toWorkingCanvas(d) {
    var swap = d.orient >= 5 && d.orient <= 8;
    var W0 = swap ? d.h : d.w, H0 = swap ? d.w : d.h;
    var s = Math.min(1, MAX_EDGE / Math.max(W0, H0));
    var W = Math.max(1, Math.round(W0 * s)), H = Math.max(1, Math.round(H0 * s));
    // halve in steps first so big phone photos downscale smoothly
    var src = d.src, sw = d.w, sh = d.h;
    while (sw * s < sw / 2.2 && sw > 2) {
      var hw = Math.round(sw / 2), hh = Math.round(sh / 2), tmp = document.createElement("canvas");
      tmp.width = hw; tmp.height = hh; var tc = tmp.getContext("2d"); tc.imageSmoothingQuality = "high"; tc.drawImage(src, 0, 0, hw, hh);
      s = s * sw / hw; src = tmp; sw = hw; sh = hh;
    }
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"); x.imageSmoothingQuality = "high";
    var dw = swap ? H : W, dh = swap ? W : H;
    switch (d.orient) { // undo the camera rotation when the browser has not
      case 2: x.setTransform(-1, 0, 0, 1, W, 0); break;
      case 3: x.setTransform(-1, 0, 0, -1, W, H); break;
      case 4: x.setTransform(1, 0, 0, -1, 0, H); break;
      case 5: x.setTransform(0, 1, 1, 0, 0, 0); break;
      case 6: x.setTransform(0, 1, -1, 0, W, 0); break;
      case 7: x.setTransform(0, -1, -1, 0, W, H); break;
      case 8: x.setTransform(0, -1, 1, 0, 0, H); break;
    }
    x.drawImage(src, 0, 0, dw, dh);
    return c;
  }
  function fail(msg) { els.error.textContent = msg; els.error.hidden = false; els.pick.classList.remove("is-busy"); }
  function loadFile(file) {
    els.error.hidden = true;
    var heic = /hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "");
    if (file.type && !/^image\//i.test(file.type) && !heic) return fail(BAD_MSG);
    els.pick.classList.add("is-busy");
    decode(file).then(function (d) {
      if (d.w < 160 || d.h < 160) { d.cleanup(); return fail(SMALL_MSG); }
      var c = toWorkingCanvas(d); d.cleanup();
      var data = c.getContext("2d").getImageData(0, 0, c.width, c.height);
      photo = { canvas: c, w: c.width, h: c.height, data: data }; els.base = null;
      els.pick.classList.remove("is-busy");
      return prepareDoor(cur).then(function () {
        quad = defaultQuad();
        show("fit"); layout(); els.handles[0].focus({ preventScroll: true });
        dlg.setAttribute("data-ready", String(Date.now()));
      });
    }).catch(function () { fail(heic ? HEIC_MSG : BAD_MSG); });
  }

  /* ---------- door artwork: SVG from door-preview.js -> canvas -> mip levels ---------- */
  function prepareDoor(cfg) {
    var o = DP.openingSVG(cfg, TEX_H);
    if (!o) return Promise.reject(new Error("no door"));
    if (o.svg === texKey && tex) return Promise.resolve(tex);
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"); c.width = o.width; c.height = o.height;
        var x = c.getContext("2d"); x.drawImage(im, 0, 0, o.width, o.height);
        var levels = [{ w: c.width, h: c.height, data: x.getImageData(0, 0, c.width, c.height).data }], src = c;
        while (src.height > 48) {
          var n = document.createElement("canvas"); n.width = Math.max(1, Math.round(src.width / 2)); n.height = Math.round(src.height / 2);
          var nx = n.getContext("2d"); nx.imageSmoothingQuality = "high"; nx.drawImage(src, 0, 0, n.width, n.height);
          levels.push({ w: n.width, h: n.height, data: nx.getImageData(0, 0, n.width, n.height).data }); src = n;
        }
        var sum = 0, cnt = 0, d0 = levels[levels.length - 1].data;
        for (var i = 0; i < d0.length; i += 4) if (d0[i + 3] > 128) { sum += lum(d0[i], d0[i + 1], d0[i + 2]); cnt++; }
        tex = { levels: levels, aspect: o.aspect, lum: cnt ? sum / cnt : 0.5 }; texKey = o.svg;
        res(tex);
      };
      im.onerror = function () { rej(new Error("svg")); };
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(o.svg);
    });
  }
  function lum(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

  /* ---------- corners ---------- */
  function defaultQuad() { // door-shaped box, centred, standing near the bottom of the photo (normalised 0..1 coordinates)
    var hf = 0.62, wf = hf * tex.aspect * photo.h / photo.w;
    if (wf > 0.7) { hf *= 0.7 / wf; wf = 0.7; }
    var x0 = 0.5 - wf / 2, x1 = 0.5 + wf / 2, y1 = Math.min(0.92, 0.5 + hf / 2 + 0.12), y0 = y1 - hf;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  }
  function layout() {
    if (!photo) return;
    var aspect = photo.w / photo.h;
    var availW = els.work.clientWidth || 300;
    var maxH = mqLandscape.matches ? window.innerHeight - 92 : mqWide.matches ? window.innerHeight - 170 : Math.max(240, window.innerHeight * 0.6);
    var cw = Math.min(availW, maxH * aspect), ch = cw / aspect;
    els.stage.style.width = Math.round(cw) + "px"; els.stage.style.height = Math.round(ch) + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.round(cw * dpr), bh = Math.round(ch * dpr), k = Math.min(1, DISPLAY_MAX / Math.max(bw, bh), photo.w / bw);
    bw = Math.max(1, Math.round(bw * k)); bh = Math.max(1, Math.round(bh * k));
    if (els.canvas.width !== bw || els.canvas.height !== bh || !els.base) {
      els.canvas.width = bw; els.canvas.height = bh;
      var t = document.createElement("canvas"); t.width = bw; t.height = bh;
      var tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(photo.canvas, 0, 0, bw, bh);
      els.base = tx.getImageData(0, 0, bw, bh);
    }
    draw();
  }
  function placeHandles() {
    if (!quad) return;
    var r = els.stage.getBoundingClientRect(), w = r.width, h = r.height;
    quad.forEach(function (p, i) { els.handles[i].style.transform = "translate(" + (p[0] * w).toFixed(1) + "px," + (p[1] * h).toFixed(1) + "px)"; });
    els.edges.forEach(function (el, i) {
      var a = quad[EDGES[i].pts[0]], b = quad[EDGES[i].pts[1]];
      var x1 = a[0] * w, y1 = a[1] * h, x2 = b[0] * w, y2 = b[1] * h;
      var ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      var len = Math.hypot(x2 - x1, y2 - y1);
      var shrink = len < 78 ? Math.max(0.5, len / 78) : 1;
      el.style.transform = "translate(" + ((x1 + x2) / 2).toFixed(1) + "px," + ((y1 + y2) / 2).toFixed(1) + "px) rotate(" + ang.toFixed(2) + "deg) scale(" + shrink.toFixed(3) + ")";
    });
    if (w > 0 && h > 0) {
      els.move.setAttribute("viewBox", "0 0 " + w.toFixed(2) + " " + h.toFixed(2));
      els.movePoly.setAttribute("points", quad.map(function (p) { return (p[0] * w).toFixed(2) + "," + (p[1] * h).toFixed(2); }).join(" "));
    }
  }
  function cloneQuad(q) { return q.map(function (p) { return [p[0], p[1]]; }); }
  function limitDelta(src, indices, axis, delta) {
    indices.forEach(function (i) {
      var v = src[i][axis];
      if (delta > 0) delta = Math.min(delta, 1 - v);
      else delta = Math.max(delta, -v);
    });
    return delta;
  }
  function endDrag(kind, index, el) {
    if (dragKind !== kind || dragIndex !== index) return;
    dragKind = ""; dragIndex = -1;
    if (el) el.classList.remove("is-drag");
    document.documentElement.classList.remove("viz-moving", "viz-ns", "viz-ew");
    schedule();
  }
  /* Window listeners so a drag keeps working after the pointer leaves the handle (mouse and touch). */
  function watchPointer(pid, onMove, onEnd) {
    var done = false;
    function move(e) {
      if (done) return;
      if (typeof pid === "number" && e.pointerId !== pid) return;
      onMove(e);
    }
    function end(e) {
      if (done) return;
      if (e && typeof pid === "number" && typeof e.pointerId === "number" && e.pointerId !== pid) return;
      done = true;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      onEnd();
    }
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    return end;
  }
  function armLost(el, finish) {
    function onLost(e) { el.removeEventListener("lostpointercapture", onLost); finish(e); }
    el.addEventListener("lostpointercapture", onLost);
  }
  function bindHandle(h, i) {
    var off = [0, 0];
    h.addEventListener("pointerdown", function (e) {
      if (!quad || dragKind || e.button > 0) return;
      e.preventDefault(); e.stopPropagation();
      h.focus({ preventScroll: true });
      try { h.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
      var r = els.stage.getBoundingClientRect();
      off = [quad[i][0] * r.width - (e.clientX - r.left), quad[i][1] * r.height - (e.clientY - r.top)];
      dragKind = "corner"; dragIndex = i; h.classList.add("is-drag");
      var finish = watchPointer(e.pointerId, function (ev) {
        if (dragKind !== "corner" || dragIndex !== i) return;
        var box = els.stage.getBoundingClientRect();
        setCorner(i, (ev.clientX - box.left + off[0]) / box.width, (ev.clientY - box.top + off[1]) / box.height);
      }, function () { endDrag("corner", i, h); });
      armLost(h, finish);
    });
    h.addEventListener("keydown", function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || !quad || dragKind) return;
      e.preventDefault();
      var r = els.stage.getBoundingClientRect(), px = e.shiftKey ? 10 : 1;
      setCorner(i, quad[i][0] + d[0] * px / r.width, quad[i][1] + d[1] * px / r.height);
    });
  }
  function bindEdge(h, i) {
    h.addEventListener("pointerdown", function (e) {
      if (!quad || dragKind || e.button > 0) return;
      e.preventDefault(); e.stopPropagation();
      h.focus({ preventScroll: true });
      try { h.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
      var origin = { x: e.clientX, y: e.clientY, quad: cloneQuad(quad) };
      dragKind = "edge"; dragIndex = i; h.classList.add("is-drag");
      document.documentElement.classList.add(EDGES[i].axis === "y" ? "viz-ns" : "viz-ew");
      var finish = watchPointer(e.pointerId, function (ev) {
        if (dragKind !== "edge" || dragIndex !== i) return;
        var box = els.stage.getBoundingClientRect(), meta = EDGES[i], axis = meta.axis === "x" ? 0 : 1;
        var delta = axis === 0 ? (ev.clientX - origin.x) / (box.width || 1) : (ev.clientY - origin.y) / (box.height || 1);
        delta = limitDelta(origin.quad, meta.pts, axis, delta);
        quad = cloneQuad(origin.quad);
        meta.pts.forEach(function (pi) { quad[pi][axis] = origin.quad[pi][axis] + delta; });
        placeHandles(); schedule();
      }, function () { endDrag("edge", i, h); });
      armLost(h, finish);
    });
    h.addEventListener("keydown", function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || !quad || dragKind) return;
      var meta = EDGES[i], axis = meta.axis === "x" ? 0 : 1;
      if (!d[axis]) { e.preventDefault(); return; }
      e.preventDefault();
      var r = els.stage.getBoundingClientRect(), px = e.shiftKey ? 10 : 1;
      var delta = limitDelta(quad, meta.pts, axis, d[axis] * px / ((axis === 0 ? r.width : r.height) || 1));
      meta.pts.forEach(function (pi) { quad[pi][axis] = quad[pi][axis] + delta; });
      placeHandles(); schedule();
    });
  }
  function bindMove(poly) {
    poly.addEventListener("pointerdown", function (e) {
      if (!quad || dragKind || e.button > 0) return;
      var hit = document.elementFromPoint(e.clientX, e.clientY);
      if (hit && hit.closest && hit.closest("[data-viz-handle], [data-viz-edge]")) return;
      e.preventDefault(); e.stopPropagation();
      try { poly.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
      var origin = { x: e.clientX, y: e.clientY, quad: cloneQuad(quad) };
      dragKind = "move"; dragIndex = 0; poly.classList.add("is-drag");
      document.documentElement.classList.add("viz-moving");
      var finish = watchPointer(e.pointerId, function (ev) {
        if (dragKind !== "move") return;
        var box = els.stage.getBoundingClientRect();
        var dx = limitDelta(origin.quad, [0, 1, 2, 3], 0, (ev.clientX - origin.x) / (box.width || 1));
        var dy = limitDelta(origin.quad, [0, 1, 2, 3], 1, (ev.clientY - origin.y) / (box.height || 1));
        quad = origin.quad.map(function (p) { return [p[0] + dx, p[1] + dy]; });
        placeHandles(); schedule();
      }, function () { endDrag("move", 0, poly); });
      armLost(poly, finish);
    });
  }
  function setCorner(i, x, y) {
    quad[i] = [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
    placeHandles(); schedule();
  }
  function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

  /* ---------- rendering ---------- */
  function convex(q) {
    var s = 0;
    for (var i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      var z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) < 1e-9) return false;
      if (!s) s = z > 0 ? 1 : -1; else if ((z > 0 ? 1 : -1) !== s) return false;
    }
    return true;
  }
  function lighting(q) { // brightness + colour cast of the wall around the opening (sampled from the working photo)
    var auto = els.auto.checked, bright = 1 + (+els.bright.value || 0) / 100;
    if (!auto) return [bright, bright, bright];
    var cx = 0, cy = 0; q.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    var d = photo.data.data, W = photo.w, H = photo.h, r = 0, g = 0, b = 0, n = 0;
    for (var e = 0; e < 4; e++) {
      var a = q[e], c = q[(e + 1) % 4];
      for (var t = 0.05; t < 1; t += 0.1) {
        for (var ring = 1.08; ring <= 1.3; ring += 0.11) {
          var x = cx + ((a[0] + (c[0] - a[0]) * t) - cx) * ring, y = cy + ((a[1] + (c[1] - a[1]) * t) - cy) * ring;
          if (x < 0 || y < 0 || x >= 1 || y >= 1) continue;
          var o = ((y * H | 0) * W + (x * W | 0)) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++;
        }
      }
    }
    if (!n) return [bright, bright, bright];
    r /= n; g /= n; b /= n;
    var L = lum(r, g, b), k = Math.max(0.6, Math.min(1.05, 0.35 + 0.65 * L / 0.55)) * bright, m = (r + g + b) / 3 || 1;
    var tint = function (ch) { return Math.max(0.88, Math.min(1.12, 1 + 0.3 * (ch / m - 1))); };
    return [k * tint(r), k * tint(g), k * tint(b)];
  }
  // Per-pixel inverse homography from the destination quad back to the door artwork, with mip-level selection,
  // premultiplied bilinear sampling and analytic edge coverage (anti-aliased edges, no seams).
  function warp(dst, dw, dh, qpx, mul) {
    var x0 = qpx[0][0], y0 = qpx[0][1], x1 = qpx[1][0], y1 = qpx[1][1], x2 = qpx[2][0], y2 = qpx[2][1], x3 = qpx[3][0], y3 = qpx[3][1];
    var a, b, c = x0, d, e, f = y0, g, h;
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) { a = x1 - x0; b = x2 - x1; d = y1 - y0; e = y2 - y1; g = 0; h = 0; }
    else {
      var den = dx1 * dy2 - dx2 * dy1; if (Math.abs(den) < 1e-12) return;
      g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den;
      a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3;
    }
    // inverse (adjugate)
    var A = e - f * h, B = c * h - b, C = b * f - c * e, D = f * g - d, E = a - c * g, F = c * d - a * f, G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
    var ccx = (x0 + x1 + x2 + x3) / 4, ccy = (y0 + y1 + y2 + y3) / 4, sgn = (G * ccx + Hh * ccy + I) > 0 ? 1 : -1;
    var qw = Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x3, y2 - y3)), qh = Math.max(Math.hypot(x3 - x0, y3 - y0), Math.hypot(x2 - x1, y2 - y1));
    var lv = tex.levels[0];
    for (var li = 1; li < tex.levels.length; li++) { if (tex.levels[li].h >= qh && tex.levels[li].w >= qw) lv = tex.levels[li]; else break; }
    var tw = lv.w, th = lv.h, td = lv.data;
    var bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2, x3)) - 1), bx1 = Math.min(dw - 1, Math.ceil(Math.max(x0, x1, x2, x3)) + 1);
    var by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2, y3)) - 1), by1 = Math.min(dh - 1, Math.ceil(Math.max(y0, y1, y2, y3)) + 1);
    var mr = mul[0], mg = mul[1], mb = mul[2];
    for (var py = by0; py <= by1; py++) {
      var fy = py + 0.5, o = (py * dw + bx0) * 4;
      for (var px = bx0; px <= bx1; px++, o += 4) {
        var fx = px + 0.5, dd = G * fx + Hh * fy + I;
        if (dd * sgn <= 0) continue;
        var u = (A * fx + B * fy + C) / dd, v = (D * fx + E * fy + F) / dd;
        var fu = Math.abs((A - u * G) / dd) + Math.abs((B - u * Hh) / dd), fv = Math.abs((D - v * G) / dd) + Math.abs((E - v * Hh) / dd);
        var cu = Math.min(u, 1 - u) / fu + 0.5, cv = Math.min(v, 1 - v) / fv + 0.5;
        if (cu <= 0 || cv <= 0) continue;
        var cov = (cu > 1 ? 1 : cu) * (cv > 1 ? 1 : cv);
        var sx = (u < 0 ? 0 : u > 1 ? 1 : u) * tw - 0.5, sy = (v < 0 ? 0 : v > 1 ? 1 : v) * th - 0.5;
        var ix = Math.floor(sx), iy = Math.floor(sy), ax = sx - ix, ay = sy - iy;
        var ix0 = ix < 0 ? 0 : ix, iy0 = iy < 0 ? 0 : iy, ix1 = ix + 1 >= tw ? tw - 1 : ix + 1, iy1 = iy + 1 >= th ? th - 1 : iy + 1;
        var p00 = (iy0 * tw + ix0) * 4, p10 = (iy0 * tw + ix1) * 4, p01 = (iy1 * tw + ix0) * 4, p11 = (iy1 * tw + ix1) * 4;
        var w00 = (1 - ax) * (1 - ay) * td[p00 + 3], w10 = ax * (1 - ay) * td[p10 + 3], w01 = (1 - ax) * ay * td[p01 + 3], w11 = ax * ay * td[p11 + 3];
        var wa = w00 + w10 + w01 + w11; if (wa <= 0) continue;
        var alpha = wa / 255 * cov;
        var r = (td[p00] * w00 + td[p10] * w10 + td[p01] * w01 + td[p11] * w11) / wa * mr;
        var gg = (td[p00 + 1] * w00 + td[p10 + 1] * w10 + td[p01 + 1] * w01 + td[p11 + 1] * w11) / wa * mg;
        var bb = (td[p00 + 2] * w00 + td[p10 + 2] * w10 + td[p01 + 2] * w01 + td[p11 + 2] * w11) / wa * mb;
        dst[o] = dst[o] + ((r > 255 ? 255 : r) - dst[o]) * alpha;
        dst[o + 1] = dst[o + 1] + ((gg > 255 ? 255 : gg) - dst[o + 1]) * alpha;
        dst[o + 2] = dst[o + 2] + ((bb > 255 ? 255 : bb) - dst[o + 2]) * alpha;
      }
    }
  }
  function composite(base, w, h, withOutline, ctx) {
    var out = new ImageData(new Uint8ClampedArray(base.data), w, h);
    var ok = convex(quad);
    if (ok) warp(out.data, w, h, quad.map(function (p) { return [p[0] * w, p[1] * h]; }), lighting(quad));
    ctx.putImageData(out, 0, 0);
    if (withOutline) {
      ctx.save(); ctx.lineWidth = Math.max(1.5, w / 500); ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3]);
      ctx.strokeStyle = ok ? "rgba(255,255,255,.9)" : "#e0413a"; ctx.beginPath();
      quad.forEach(function (p, i) { ctx[i ? "lineTo" : "moveTo"](p[0] * w, p[1] * h); }); ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    return ok;
  }
  function draw() {
    if (!photo || !quad || !tex || !els.base) return;
    placeHandles();
    var ok = composite(els.base, els.canvas.width, els.canvas.height, true, els.canvas.getContext("2d"));
    dlg.classList.toggle("is-crossed", !ok);
    els.help.textContent = ok ? "Drag the four corners onto the corners of your door opening. Or tab to a corner and move it with the arrow keys (hold Shift to move faster)."
      : "Those corners cross over. Drag them back so they make a box around your door opening.";
    els.canvas.setAttribute("data-rev", String((+els.canvas.getAttribute("data-rev") || 0) + 1));
  }

  /* ---------- download (full working resolution, no guide lines) ---------- */
  function download() {
    if (!photo || !quad) return;
    var c = document.createElement("canvas"); c.width = photo.w; c.height = photo.h;
    composite(photo.data, photo.w, photo.h, false, c.getContext("2d"));
    var save = function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "my-building-with-new-door.jpg"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      document.dispatchEvent(new CustomEvent("doorviz:download", { detail: { tag: curTag, file: a.download } }));
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    };
    if (c.toBlob) c.toBlob(save, "image/jpeg", 0.9);
    else fetch(c.toDataURL("image/jpeg", 0.9)).then(function (r) { return r.blob(); }).then(save);
  }
})();
