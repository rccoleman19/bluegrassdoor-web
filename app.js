/* Bluegrass Commercial Door & More: site scripts */
(function () {
  "use strict";
  var PHONE = "270-780-3235";
  var TEL = "tel:+12707803235";
  var EMAIL = "sonya@bluegrassdoor.com";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.from((c || document).querySelectorAll(s)); };

  /* ---------- Year ---------- */
  var y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  /* ---------- Header + mobile menu ---------- */
  var header = $(".header");
  var nav = $("#site-nav");
  var toggle = $(".menu-toggle");
  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  }
  toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { setMenu(false); closeChat(); closeLightbox(); }
  });
  window.addEventListener("resize", function () { if (window.innerWidth >= 1024) setMenu(false); });
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Sticky call bar (phones & tablets): shown once the homepage buttons scroll away, never over the door builder or the footer ---------- */
  var callbar = $(".callbar"), callGo = $("#callbar-go");
  var chatWrap = $("#chat");
  if ("IntersectionObserver" in window && callbar) {
    var hideFor = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) hideFor.add(en.target); else hideFor.delete(en.target); });
      callbar.classList.toggle("is-visible", hideFor.size === 0);
    }, { threshold: 0 });
    [$(".hb__band"), $("#door-builder"), $(".footer")].forEach(function (el) { if (el) io.observe(el); });
  } else if (callbar) { callbar.classList.add("is-visible"); }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = $$(".svc, .pillar, .review, .about__copy, .about__photo, .area__copy, .area__map, .gallery__item");
  if ("IntersectionObserver" in window) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); rio.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { el.classList.add("reveal"); rio.observe(el); });
  }

  /* ---------- Lightbox ---------- */
  var lb = $("#lightbox"), lbImg = $("#lightbox-img"), lbCap = $("#lightbox-cap"), lastFocus = null;
  $$(".gallery__item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      lastFocus = btn;
      lbImg.src = btn.getAttribute("data-full");
      lbImg.alt = btn.getAttribute("data-caption");
      lbCap.textContent = btn.getAttribute("data-caption");
      lb.hidden = false;
      $(".lightbox__close", lb).focus();
    });
  });
  function closeLightbox() { if (!lb.hidden) { lb.hidden = true; if (lastFocus) lastFocus.focus(); } }
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.closest(".lightbox__close")) closeLightbox(); });

  var ICON = {
    storefront: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 3v18M9 12h1M14 12h1"/></svg>',
    steel: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="1"/><path d="M15 12h1"/></svg>',
    fire: '<svg viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2-1-4-2-5-1 4-4 6-4 11 0 4.3 3 7 7 7z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
    door: '<svg viewBox="0 0 24 24"><path d="M4 22h16M6 22V3h12v19"/><path d="M14 12h1"/></svg>',
    barn: '<svg viewBox="0 0 24 24"><path d="M2 4h20"/><path d="M7 4v2M15 4v2"/><rect x="5" y="6" width="12" height="16"/><path d="m5 6 12 16M17 6 5 22"/></svg>',
    glass: '<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="m8 7 3-3M8 12l7-7M11 13l5-5"/></svg>',
    wood: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="1"/><rect x="8" y="5" width="8" height="6"/><rect x="8" y="13" width="8" height="6"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
    single: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="18"/><path d="M14 12h.5"/></svg>',
    pair: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18"/><path d="M12 3v18M10 12h.5M14 12h-.5"/></svg>',
    ruler: '<svg viewBox="0 0 24 24"><path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/></svg>',
    tape: '<svg viewBox="0 0 24 24"><circle cx="11" cy="12" r="8"/><circle cx="11" cy="12" r="2"/><path d="M19 12h3v8h-9"/></svg>',
    lever: '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="3"/><path d="M11 12h10"/></svg>',
    panic: '<svg viewBox="0 0 24 24"><rect x="2" y="10" width="20" height="4" rx="2"/><path d="M6 10V8M18 10V8"/></svg>',
    closer: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="10" height="4" rx="1"/><path d="M12 6l8 6"/></svg>',
    keypad: '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01"/></svg>',
    hinge: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="5" height="18"/><rect x="13" y="3" width="5" height="18"/><path d="M11 7h2M11 12h2M11 17h2"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    track: '<svg viewBox="0 0 24 24"><path d="M2 6h20"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/><path d="M7 8v4M17 8v4"/></svg>',
    plate: '<svg viewBox="0 0 24 24"><rect x="3" y="15" width="18" height="6" rx="1"/><path d="M6 3v12M18 3v12"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/></svg>'
  };

  /* =====================================================================
   * Door builder: a step on this page, reached from the homepage.
   * steps (type, material, size, hardware) -> a finished door -> "Get a quote on this door" (in place)
   * -> saved for the office. Several doors can go into one request. Rules: builder-rules.js. Catalog,
   * spec text, and links: door-spec.js. Drawings: door-preview.js.
   * ===================================================================== */
  var S = window.DoorSpec, R = window.BuilderRules, DP = window.DoorPreview;
  var reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var smooth = function () { return reduceMotion.matches ? "auto" : "smooth"; };
  var BASE = location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "");
  var STEP_NAMES = ["Type", "Material", "Size", "Hardware"];

  var blank = function () { return { type: null, material: null, size: null, hardware: [], cw: "", ch: "", qty: 1, loc: "" }; };
  var clone = function (d) { var o = {}; for (var k in d) o[k] = d[k]; o.hardware = (d.hardware || []).slice(); return o; };
  var state = blank(), step = 1, MAX = 4;
  var doors = [], editing = -1, view = "steps";
  var CC = window.CodeChecks, code = { juris: CC ? CC.DEFAULT_JURIS : "warren", place: "", picked: false, fromAddr: false, use: null, all: false };
  var lastAction = "", photoSaved = false, reqRef = "", reqSig = "", reqSaved = false, reqTries = 0, lastRemoved = null, drawRev = 0;
  var work = $("#door-builder");
  var btnNext = $("#b-next"), btnBack = $("#b-back"), btnCancel = $("#b-cancel"), btnSave = $("#b-save");
  var notice = $("#builder-notice"), live = $("#builder-live");
  var sizeW = $("#size-w"), sizeH = $("#size-h");

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(el, msg) { el.textContent = ""; setTimeout(function () { el.textContent = msg; }, 60); }
  function headerBottom() { return Math.max(0, header.getBoundingClientRect().bottom); }
  function reveal(el, force) { // bring el's top just under the sticky header when it is out of comfortable view
    var r = el.getBoundingClientRect(), hb = headerBottom();
    if (force || r.top < hb + 4 || r.top > window.innerHeight * 0.55) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - hb - (el === work ? 0 : 12)), behavior: smooth() });
  }
  function focusEl(el) { if (el) el.focus({ preventScroll: true }); }

  function optHTML(value, title, sub, icon, multi, selected, st) {
    st = st || {};
    var cls = "opt" + (st.disabled ? " is-disabled" : "") + (st.locked ? " is-locked" : "");
    var aria = multi ? 'aria-pressed="' + selected + '"' : 'role="radio" aria-checked="' + selected + '"';
    if (st.disabled || st.locked) aria += ' aria-disabled="true"';
    var why = st.reason ? '<span class="opt__why opt__why--' + (st.disabled ? "no" : "req") + '">' + esc(st.reason) + "</span>" : st.note ? '<span class="opt__why opt__why--info">' + esc(st.note) + "</span>" : "";
    var badge = st.locked ? '<span class="opt__badge">Required</span>' : "";
    return '<button type="button" class="' + cls + '" ' + aria + ' data-value="' + esc(value) + '">' +
      '<span class="opt__icon" aria-hidden="true">' + (ICON[icon] || ICON.door) + '</span>' +
      '<span class="opt__text"><strong>' + esc(title) + '</strong>' + badge + '<small>' + esc(sub) + '</small>' + why + '</span><span class="opt__tick" aria-hidden="true"></span></button>';
  }

  /* rules adapter */
  function sel() { return S.sel(state); }
  function hwStatus(label) { return R ? R.option(sel(), R.KEY_OF[label] || label, step >= 4) : { title: label }; }
  function applyRules() {
    if (!R) return;
    var res = R.normalize(sel(), { atHardware: step >= 4 });
    if (!res.changes.length) return;
    state.hardware = res.sel.hardware.map(function (k) { return R.HW[k] || k; });
    lastAction = res.changes.filter(function (c) { return c.action === "removed"; }).map(function (c) {
      return "We took off the " + R.HW[c.key].toLowerCase() + ": " + c.say.replace(/^Not [^:]+: /, "");
    }).join(" ");
    var added = res.changes.filter(function (c) { return c.action === "added"; }).map(function (c) { return c.say; }).join(" ");
    if (added) say(live, added);
  }
  function blockingNow() { return R && step >= 4 && state.hardware.length ? R.evaluate(sel()).blocking : []; }
  function showNotice() {
    var need = step === 4 ? blockingNow().filter(function (r) { return r.fix && r.fix.oneOf; }) : [];
    var html = "";
    if (lastAction) html += '<p class="builder__notice-msg">' + esc(lastAction) + "</p>";
    if (need.length) html += '<p class="builder__notice-need">' + esc(need[0].say) + "</p>";
    notice.innerHTML = html; notice.hidden = !html; notice.classList.toggle("is-need", !!need.length);
  }
  function stepOk(n) {
    if (n === 1) return !!state.type;
    if (n === 2) return !!state.material;
    if (n === 3) return !!state.size && (state.size !== "custom" || S.customOk(state));
    return state.hardware.length > 0 && (!R || R.evaluate(sel()).blocking.length === 0);
  }
  function reachable(n) { for (var k = 1; k < n; k++) if (!stepOk(k)) return false; return true; }

  function renderProgress() {
    var html = STEP_NAMES.map(function (name, i) {
      var n = i + 1, cur = n === step, done = n < step || (n !== step && stepOk(n) && reachable(n));
      var cls = (cur ? "is-active" : "") + (done && !cur ? " is-done" : "");
      var inner = '<span class="bprog__n" aria-hidden="true">' + (done && !cur ? "&#10003;" : n) + '</span><em>' + name + "</em>";
      if (!cur && reachable(n) && (done || n < step)) return '<li class="' + cls + '"><button type="button" data-goto="' + n + '" aria-label="Step ' + n + ", " + name + ' (done, change it)">' + inner + "</button></li>";
      return '<li class="' + cls + '"' + (cur ? ' aria-current="step"' : "") + '><span class="bprog__s"><span class="sr-only">Step ' + n + ", </span>" + inner + "</span></li>";
    }).join("");
    html += '<li class="bprog__end"><span class="bprog__s"><span class="bprog__n" aria-hidden="true">&#9733;</span><em>Your door</em></span></li>';
    $("#builder-progress").innerHTML = html;
  }

  function renderStep() {
    applyRules();
    var active = document.activeElement, keep = active && active.classList && active.classList.contains("opt") && work.contains(active) ? [active.parentElement.getAttribute("data-field"), active.getAttribute("data-value")] : null;
    var box;
    if (step === 1) {
      box = $('[data-field="type"]');
      box.innerHTML = S.TYPES.map(function (o) { return optHTML(o.v, o.t, o.s, o.i, false, state.type === o.v); }).join("");
    }
    if (step === 2) {
      box = $('[data-field="material"]');
      box.innerHTML = S.materialsFor(state.type).map(function (m) { return optHTML(m[0], m[1], m[2], m[3], false, state.material === m[0]); }).join("");
    }
    if (step === 3) {
      box = $('[data-field="size"]');
      box.innerHTML = S.SIZES.map(function (z) {
        var n = R ? R.sizeNote(sel(), z[0]) : "";
        return optHTML(z[0], z[1], z[2], z[3], false, state.size === z[0], n && state.size === z[0] ? { note: n } : null);
      }).join("");
      $("#custom-size").hidden = state.size !== "custom";
      if (sizeW.value !== String(state.cw || "")) sizeW.value = state.cw || "";
      if (sizeH.value !== String(state.ch || "")) sizeH.value = state.ch || "";
    }
    if (step === 4) {
      box = $('[data-field="hardware"]');
      box.innerHTML = S.hwListFor(state.type).map(function (h) {
        var st = hwStatus(h[0]);
        return optHTML(h[0], st.title || h[0], st.sub || h[1], h[2], true, state.hardware.indexOf(h[0]) > -1, st);
      }).join("");
    }
    $$(".builder__panel").forEach(function (p) { p.hidden = +p.getAttribute("data-step") !== step; });
    renderProgress();
    var label = $("#door-label");
    if (editing >= 0) { label.hidden = false; label.textContent = "Changing door " + (editing + 1); }
    else if (doors.length) { label.hidden = false; label.textContent = "Door " + (doors.length + 1) + ": a new door for the same quote"; }
    else label.hidden = true;
    btnBack.hidden = step === 1;
    btnCancel.hidden = !doors.length;
    btnCancel.textContent = editing >= 0 ? "Cancel changes" : "Back to my doors";
    var nextLabel = step < MAX ? "Next &rarr;" : editing >= 0 ? "Save changes" : "See my door &rarr;";
    if (btnNext.getAttribute("data-label") !== nextLabel) { btnNext.innerHTML = nextLabel; btnNext.setAttribute("data-label", nextLabel); } // (never swap nodes under a pointer that is pressing Next)
    updateNext();
    if (keep) { var again = $('[data-field="' + keep[0] + '"] .opt[data-value="' + CSS.escape(keep[1]) + '"]'); if (again) focusEl(again); }
    document.dispatchEvent(new CustomEvent("doorbuilder:change", { detail: { step: step, state: state, rows: S.rows(state), hwLabels: S.hwTitles(state) } })); // live door preview (read-only)
  }
  function updateNext() {
    btnNext.disabled = !stepOk(step);
    btnNext.parentElement.classList.toggle("is-ready", !btnNext.disabled || editing >= 0);
    btnSave.hidden = !(editing >= 0 && step < MAX);
    btnSave.disabled = !S.isValid(state);
    var sizeErr = $("#size-err");
    if (sizeErr) {
      var sizeBad = [sizeW, sizeH].some(function (el) {
        if (!el) return false;
        var v = el.validity;
        if (v && (v.badInput || v.rangeOverflow || v.rangeUnderflow)) return true;
        var raw = String(el.value || "").trim();
        if (!raw) return false;
        var n = Math.round(+raw);
        return !(n >= 12 && n <= 240);
      });
      sizeErr.classList.toggle("is-on", state.size === "custom" && sizeBad);
    }
    showNotice();
  }
  function focusStep() {
    var h = $('.builder__panel[data-step="' + step + '"] .bq');
    reveal($(".bsteps__top"));
    focusEl(h);
  }
  function goStep(n) { lastAction = ""; step = n; renderStep(); focusStep(); }

  work.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (go) { goStep(+go.getAttribute("data-goto")); return; }
    var opt = e.target.closest(".opt"); if (!opt || !work.contains(opt)) return;
    var field = opt.parentElement.getAttribute("data-field"), v = opt.getAttribute("data-value");
    lastAction = "";
    if (field === "hardware") {
      var st = hwStatus(v);
      if (st.disabled) { lastAction = st.reason; showNotice(); return; }   // not a dead end: the reason says what to do instead
      if (st.locked) { lastAction = st.lockReason; showNotice(); return; }
      var i = state.hardware.indexOf(v);
      if (v === "Recommend for me") state.hardware = i > -1 ? [] : ["Recommend for me"];
      else {
        state.hardware = state.hardware.filter(function (h) { return h !== "Recommend for me"; });
        if (i > -1) state.hardware.splice(state.hardware.indexOf(v), 1); else state.hardware.push(v);
      }
    } else {
      if (field === "type" && state.type !== v) { state.material = null; state.hardware = []; }
      state[field] = v;
    }
    touched();
    renderStep();
    if (field === "size" && v === "custom") sizeW.focus();
  });
  // arrow keys move between the options of a step
  work.addEventListener("keydown", function (e) {
    var opt = e.target.closest && e.target.closest(".opt"); if (!opt) return;
    var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return;
    var all = $$(".opt", opt.parentElement), i = all.indexOf(opt);
    e.preventDefault(); focusEl(all[(i + d + all.length) % all.length]);
  });
  [sizeW, sizeH].forEach(function (el) {
    el.addEventListener("input", function () { state.cw = sizeW.value; state.ch = sizeH.value; touched(); updateNext(); renderProgress(); });
    el.addEventListener("change", function () { // re-draw only if the size note changes (the tap that blurred this field may be on Next)
      var shown = $('[data-field="size"] .opt[data-value="custom"] .opt__why'), want = R ? R.sizeNote(sel(), "custom") : "";
      if ((shown ? shown.textContent : "") !== (want || "")) renderStep();
    });
  });
  btnNext.addEventListener("click", function () {
    if (btnNext.disabled) return;
    if (step < MAX) goStep(step + 1); else commit();
  });
  btnBack.addEventListener("click", function () { if (step > 1) goStep(step - 1); });
  btnSave.addEventListener("click", function () { if (!btnSave.disabled) commit(); });
  btnCancel.addEventListener("click", function () { editing = -1; state = blank(); lastAction = ""; showBuilt(); });

  function commit() {
    if (!S.isValid(state)) { step = MAX; renderStep(); focusStep(); return; }
    var d = clone(state); d.qty = d.qty || 1;
    if (d.size !== "custom") { d.cw = ""; d.ch = ""; }
    var wasEdit = editing >= 0, idx = wasEdit ? editing : doors.length;
    if (wasEdit) doors[editing] = d; else doors.push(d);
    editing = -1; state = blank(); step = 1; lastAction = "";
    touched();
    showBuilt(wasEdit ? "Door " + (idx + 1) + " updated." : doors.length > 1 ? "Door " + doors.length + " added to your quote." : "");
  }

  /* ---------- views ---------- */
  function showView(v) {
    view = v; work.setAttribute("data-view", v);
    $$("[data-panel]", work).forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== v; });
    if (callGo) callGo.textContent = doors.length ? "Get a quote" : "Build a door";
  }
  function startDoor(preset) {
    editing = -1; state = blank(); if (preset) for (var k in preset) state[k] = preset[k];
    step = 1; lastAction = ""; showView("steps"); renderStep();
  }
  function showBuilt(msg) {
    renderDoors();
    showView("built");
    reveal(work);
    focusEl($("#built-title"));
    if (msg) say($("#built-live"), msg);
  }

  function drawing(d, uid, label) {
    var cfg = DP.buildConfig(S.previewSel(d));
    return DP.svgMarkup(cfg, uid, label || "Drawing of " + cfg.summary);
  }
  function countLabel() {
    var n = doors.length, total = S.totalCount(doors);
    return total === n ? (n === 1 ? "1 door, ready to quote" : n + " doors, ready to quote") : n + " door builds, " + total + " doors in all";
  }
  function quoteLabel() {
    $("#built-count").textContent = countLabel();
    var total = S.totalCount(doors);
    return total === 1 ? "Get a quote on this door" : "Get a quote on these " + total + " doors";
  }
  function renderDoors() {
    var n = doors.length; drawRev++;
    $("#built-title").textContent = n === 1 ? "Your door is ready for quote." : "Your doors are ready for quote.";
    $("#built-lead").textContent = n === 1 ? "This is exactly what you built. Look it over, then get a quote on it." : "Each door goes into one quote request, exactly as you built it.";
    $("#b-quote-text").textContent = quoteLabel();
    $("#door-list").innerHTML = doors.map(function (d, i) {
      var rows = S.rows(d), num = i + 1;
      var spec = rows.map(function (r) {
        return '<div class="spec__row' + (r[2] ? " spec__row--notes" : "") + '"><dt>' + esc(r[0]) + "</dt><dd>" + (r[2] ? "<ul>" + r[2].map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : esc(r[1])) + "</dd></div>";
      }).join("");
      return '<li class="dcard" data-i="' + i + '">' +
        '<div class="dcard__draw">' + drawing(d, "c" + drawRev + "-" + i, "Drawing of door " + num + ": " + S.typeLabel(d.type) + ", " + S.oneLine(d)) + "</div>" +
        '<div class="dcard__body">' +
          '<div class="dcard__top"><h3 class="dcard__title"><span class="dcard__num">Door ' + num + "</span> " + esc(S.typeLabel(d.type)) + "</h3>" +
            '<button type="button" class="dcard__remove" data-remove="' + i + '" aria-label="' + (n === 1 ? "Remove this door and start over" : "Remove door " + num) + '">' + (n === 1 ? "Start over" : "Remove") + "</button></div>" +
          '<dl class="spec">' + spec + "</dl>" +
          '<div class="dcard__meta">' +
            '<div class="qty"><span class="qty__label" id="qty-l-' + i + '">How many</span><div class="qty__ctl" role="group" aria-labelledby="qty-l-' + i + '">' +
              '<button type="button" data-qty="-1" data-i="' + i + '" aria-label="One fewer of door ' + num + '"' + (d.qty <= 1 ? " disabled" : "") + '>&minus;</button>' +
              '<input type="number" inputmode="numeric" min="1" max="500" value="' + (d.qty || 1) + '" data-qty-input="' + i + '" aria-label="How many of door ' + num + '">' +
              '<button type="button" data-qty="1" data-i="' + i + '" aria-label="One more of door ' + num + '">+</button></div></div>' +
            '<label class="loc"><span>Where does it go? <em>(optional)</em></span><input type="text" maxlength="60" data-loc="' + i + '" value="' + esc(d.loc || "") + '" placeholder="e.g. Front entrance"></label>' +
          "</div>" +
          '<div class="dcard__acts">' +
            '<button type="button" class="btn btn--outline dcard__viz" data-viz="' + i + '" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6l1.5-2h4l1.5 2"/></svg>See it on your building</button>' +
            '<div class="dcard__change" role="group" aria-label="Change something on door ' + num + '"><span aria-hidden="true">Change:</span>' +
              STEP_NAMES.map(function (nm, k) { return '<button type="button" data-edit="' + i + '" data-step="' + (k + 1) + '" aria-label="Change the ' + nm.toLowerCase() + " of door " + num + '">' + nm + "</button>"; }).join("") +
            "</div>" +
          "</div>" +
        "</div></li>";
    }).join("");
    renderCodes();
  }
  /* ---------- local & state code suggestions (code-checks.js). Optional: nothing here blocks the quote ---------- */
  function codeResult() { return CC ? CC.evaluate(doors, { juris: code.juris, use: code.use, place: code.place }) : null; }
  var SHOW_FIRST = 3;
  function renderCodes() {
    var box = $("#codes"); if (!box) return;
    if (!CC || !doors.length) { box.hidden = true; return; }
    box.hidden = false;
    var sel = $("#code-juris");
    if (!sel.options.length) sel.innerHTML = CC.JURIS.map(function (j) { return '<option value="' + j.v + '">' + esc(j.t) + "</option>"; }).join("");
    sel.value = code.juris;
    var placeWrap = $("#code-place-wrap"), placeInput = $("#code-place");
    var askPlace = CC.needsPlace(code.juris);
    if (placeWrap) placeWrap.hidden = !askPlace;
    if (placeInput && placeInput.value !== code.place) placeInput.value = code.place;
    var res = codeResult(), total = doors.length;
    var hint = $("#code-juris-hint");
    if (askPlace && res.needPlace) hint.textContent = "Type a zip code or the place the door will be installed. The notes will follow that place.";
    else if (res.unavailable) hint.textContent = "We don't have verified notes for that place. You can still send the quote.";
    else if (askPlace && res.juris === "ky" && /^\d{5}(?:-\d{4})?$/.test(String(res.place || "").trim())) hint.textContent = "Notes for " + res.jurisLabel + ". If the door is inside Bowling Green or in Warren County outside the city, choose that above.";
    else if (askPlace) hint.textContent = "Notes for " + res.jurisLabel + ". Change the place if that's not right.";
    else if (code.fromAddr && !code.picked) hint.textContent = "Picked from the project address you typed. Change it if that's not right.";
    else if (code.juris === CC.DEFAULT_JURIS) hint.textContent = "Most of our jobs are in Warren County, KY. Change it if your project is elsewhere.";
    else hint.textContent = "Change it any time.";
    $$(".codes__use button").forEach(function (b) { b.setAttribute("aria-pressed", code.use === b.getAttribute("data-use") ? "true" : "false"); });
    $("#code-use-hint").textContent = code.use ? "" : res.useInferred ? "Showing business notes because of the door types. Tap Home if it's a house." : "Not sure? We're showing notes for both. Tap Business or Home to narrow them down.";
    var miss = $("#code-miss");
    if (miss) {
      if (res.unavailable) { miss.hidden = false; miss.innerHTML = esc(res.unavailable).replace(/270-780-3235/g, '<a href="' + TEL + '">270-780-3235</a>'); }
      else { miss.hidden = true; miss.textContent = ""; }
    }
    var many = res.items.length > SHOW_FIRST + 1 && !code.all;
    $("#code-list").innerHTML = res.items.map(function (it, k) {
      var dl = CC.doorsLabel(it, total);
      return '<li data-code="' + esc(it.id) + '"' + (many && k >= SHOW_FIRST ? " hidden" : "") + ">" + (dl ? '<span class="codes__doors">' + esc(dl) + "</span>" : "") + esc(it.text) +
        '<span class="codes__src">Source: ' + it.sources.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.cite) + "</a>"; }).join(" &middot; ") + "</span></li>";
    }).join("");
    var more = $("#code-more");
    more.hidden = res.items.length <= SHOW_FIRST + 1;
    more.textContent = code.all ? "Show fewer" : "Show all " + res.items.length + " suggestions";
    more.setAttribute("aria-expanded", code.all ? "true" : "false");
  }
  function codeSpoken(res) {
    if (!res) return "";
    if (res.needPlace) return "Type a zip code or the place the door will be installed.";
    if (res.unavailable) return res.unavailable;
    return "Suggestions updated for " + res.jurisLabel + ".";
  }
  if ($("#codes")) {
    $("#code-juris").addEventListener("change", function () {
      var prev = code.juris;
      code.juris = this.value; code.picked = true; renderCodes();
      if (CC.needsPlace(code.juris) && !CC.needsPlace(prev)) $("#code-place").focus();
      say($("#code-live"), codeSpoken(codeResult()));
    });
    $("#code-place").addEventListener("input", function () {
      code.place = this.value; code.picked = true; renderCodes();
      say($("#code-live"), codeSpoken(codeResult()));
    });
    $(".codes__use").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-use]"); if (!b) return;
      var u = b.getAttribute("data-use"); code.use = code.use === u ? null : u; renderCodes();
      say($("#code-live"), code.use ? "Showing suggestions for a " + (code.use === "home" ? "home" : "business") + "." : "Showing suggestions for both.");
    });
    $("#code-more").addEventListener("click", function () { code.all = !code.all; renderCodes(); });
  }
  // until the customer picks a location, the project address (quote form) can set it
  function codeFromAddr() {
    if (!CC || code.picked) return;
    var addr = $("#q-addr").value;
    var g = CC.guessJuris(addr);
    if (g) {
      code.juris = g; code.fromAddr = true;
      if (CC.needsPlace(g)) code.place = addr.trim().slice(0, 80);
    } else if (code.fromAddr) { code.juris = CC.DEFAULT_JURIS; code.place = ""; code.fromAddr = false; }
    renderCodes();
    updateQuoteCodes();
  }
  function updateQuoteCodes() {
    var el = $("#q-codes"); if (!el || !CC) return;
    var res = doors.length ? codeResult() : null;
    if (!res) { el.hidden = true; return; }
    if (res.needPlace) { el.hidden = false; el.textContent = "Add a zip code or place to include local code notes."; return; }
    if (res.unavailable) { el.hidden = false; el.textContent = res.unavailable; return; }
    var n = res.items.length;
    el.hidden = !n;
    el.textContent = n + " local & state code suggestion" + (n === 1 ? "" : "s") + " included (" + res.jurisLabel + ")";
  }
  function setQty(i, q) {
    q = Math.max(1, Math.min(500, parseInt(q, 10) || 1));
    doors[i].qty = q; touched();
    var li = $('.dcard[data-i="' + i + '"]');
    var inp = $("[data-qty-input]", li); if (+inp.value !== q) inp.value = q;
    $('[data-qty="-1"]', li).disabled = q <= 1;
    $("#b-quote-text").textContent = quoteLabel();
  }
  $("#door-list").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-qty")) { var i = +b.getAttribute("data-i"); setQty(i, (doors[i].qty || 1) + +b.getAttribute("data-qty")); if (b.disabled) focusEl($('[data-qty-input="' + i + '"]')); return; }
    if (b.hasAttribute("data-edit")) { editing = +b.getAttribute("data-edit"); state = clone(doors[editing]); step = +b.getAttribute("data-step"); lastAction = ""; showView("steps"); renderStep(); focusStep(); return; }
    if (b.hasAttribute("data-viz")) {
      var k = +b.getAttribute("data-viz");
      if (window.DoorVisualize) window.DoorVisualize.open(DP.buildConfig(S.previewSel(doors[k])), doors.length > 1 ? "Door " + (k + 1) : "");
      return;
    }
    if (b.hasAttribute("data-remove")) {
      var r = +b.getAttribute("data-remove");
      lastRemoved = { door: doors[r], i: r };
      doors.splice(r, 1); touched();
      if (!doors.length) { startDoor(); focusStep(); say(live, "Door removed. Start a new door whenever you're ready."); return; }
      renderDoors(); showView("built");
      var ban = $("#built-banner");
      ban.innerHTML = 'Door ' + (r + 1) + ' removed. <button type="button" class="btn btn--text" id="undo-remove">Undo</button>';
      ban.hidden = false; focusEl($("#undo-remove"));
    }
  });
  var codeTimer = 0;
  $("#door-list").addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-loc")) { doors[+t.getAttribute("data-loc")].loc = S.cleanText(t.value, 60); touched(); clearTimeout(codeTimer); codeTimer = setTimeout(renderCodes, 400); }
  });
  $("#door-list").addEventListener("change", function (e) {
    var t = e.target; if (t.hasAttribute("data-qty-input")) setQty(+t.getAttribute("data-qty-input"), t.value);
  });
  $("#built-banner").addEventListener("click", function (e) {
    if (e.target.id !== "undo-remove" || !lastRemoved) return;
    doors.splice(lastRemoved.i, 0, lastRemoved.door); lastRemoved = null;
    $("#built-banner").hidden = true; renderDoors(); focusEl($("#built-title")); say($("#built-live"), "Door restored.");
  });
  $("#b-add").addEventListener("click", function () { $("#built-banner").hidden = true; startDoor(); focusStep(); });
  document.addEventListener("doorviz:download", function () { photoSaved = true; });

  /* ---------- the quote step (opens in place) ---------- */
  var form = $("#quote-form");
  $("#b-quote").addEventListener("click", function () { openQuote(); });
  function openQuote() {
    var total = S.totalCount(doors), many = total > 1;
    $("#quote-title").textContent = quoteLabel();
    $("#q-back-text").textContent = doors.length > 1 ? "Back to my doors" : "Back to my door";
    $("#q-lead-doors").textContent = many ? "Your doors are attached" : "Your door is attached";
    $("#q-fine-doors").textContent = many ? "doors" : "door";
    drawRev++;
    $("#q-doors").innerHTML = doors.map(function (d, i) {
      var hw = S.hwTitles(d).join(", ");
      return '<li class="qdoor"><div class="qdoor__draw">' + drawing(d, "q" + drawRev + "-" + i, "Drawing of door " + (i + 1)) + "</div>" +
        '<div class="qdoor__text"><strong>Door ' + (i + 1) + (d.loc ? ": " + esc(d.loc) : "") + "</strong>" +
        "<span>" + esc(S.typeLabel(d.type)) + ((d.qty || 1) > 1 ? ' <b class="qdoor__qty">&times; ' + d.qty + "</b>" : "") + "</span>" +
        "<small>" + esc(S.oneLine(d).replace(/ \u00d7 /g, "\u00a0\u00d7\u00a0").replace(/(\d") ([WH])\b/g, "$1\u00a0$2")) + "</small><small>" + esc(hw) + "</small>" +
        (S.notes(d).length ? '<small class="qdoor__notes">' + S.notes(d).length + " good-to-know note" + (S.notes(d).length > 1 ? "s" : "") + " included</small>" : "") +
        "</div></li>";
    }).join("");
    $("#q-photo").hidden = !photoSaved;
    updateQuoteCodes();
    showView("quote");
    reveal(work);
    focusEl($("#quote-title"));
  }
  $("#q-addr").addEventListener("input", codeFromAddr);
  $("#q-back").addEventListener("click", function () { showBuilt(); });
  $("#q-edit").addEventListener("click", function () { showBuilt(); });

  function fieldErr(el, bad) { var f = el.closest(".field"); if (f) f.classList.toggle("is-invalid", bad); el.setAttribute("aria-invalid", bad ? "true" : "false"); }
  function checkName() {
    var el = $("#q-name"), bad = !el.value.trim();
    fieldErr(el, bad); if (bad) el.setAttribute("aria-describedby", "q-name-err"); else el.removeAttribute("aria-describedby");
    return !bad;
  }
  function checkReach(show) {
    var p = $("#q-phone"), e = $("#q-email"), pv = p.value.trim(), ev = e.value.trim(), msg = "";
    var pOk = !pv || pv.replace(/\D/g, "").length >= 7, eOk = !ev || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(ev);
    if (!pv && !ev) msg = "Please give us a phone number or an email address.";
    else if (!pOk) msg = "Please check the phone number (at least 7 digits).";
    else if (!eOk) msg = "That email address doesn't look quite right.";
    if (show !== false) {
      var set = $("#q-reach"); set.classList.toggle("is-invalid", !!msg);
      $("#q-reach-err").textContent = msg || "Please give us a phone number or an email address.";
      fieldErr(p, !!msg && (!pOk || (!pv && !ev))); fieldErr(e, !!msg && (!eOk || (!pv && !ev)));
      [p, e].forEach(function (x) { if (msg) x.setAttribute("aria-describedby", "q-reach-err"); else x.removeAttribute("aria-describedby"); });
    }
    return !msg;
  }
  $("#q-name").addEventListener("input", function () { if (this.getAttribute("aria-invalid") === "true") checkName(); });
  ["#q-phone", "#q-email"].forEach(function (s) {
    $(s).addEventListener("input", function () { if ($("#q-reach").classList.contains("is-invalid")) checkReach(); });
    $(s).addEventListener("blur", function () { if ($("#q-phone").value.trim() || $("#q-email").value.trim()) checkReach(); });
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var okName = checkName(), okReach = checkReach();
    if (!okName) { $("#q-name").focus(); return; }
    if (!okReach) { var p = $("#q-phone"); (p.getAttribute("aria-invalid") === "true" ? p : $("#q-email")).focus(); return; }
    var c = S.unpackContact({ n: $("#q-name").value, co: $("#q-company").value, p: $("#q-phone").value, e: $("#q-email").value, a: $("#q-addr").value, tl: $("#q-when").value, x: $("#q-msg").value });
    var sig = JSON.stringify([S.buildPayload(doors), c]);
    if (!reqRef || sig !== reqSig || reqSaved) { reqRef = S.newRef(); reqSig = sig; reqSaved = false; reqTries = 0; }
    sendRequest(c);
  });
  /* The request goes straight to our office's quote inbox (a database table the website can add to but never read). */
  var QUOTE_API = { url: "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/quote_requests", key: "sb_publishable_aOUQv3tbsDOP4eTDjbyA6w_RKZBxx8K" };
  var sending = false;
  function sendErr(msg) {
    var box = $("#q-send-err");
    if (!msg) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = msg; box.hidden = false;
  }
  function sendRequest(c) {
    if (sending) return;
    var btn = $("#q-submit"), photo = photoSaved && $("#q-photo-yes").checked;
    var url = BASE + "request.html#b=" + S.encode(S.requestPayload(doors, c, reqRef, new Date(), { j: code.juris, u: code.use, p: CC && CC.needsPlace(code.juris) ? code.place : "" }));
    var buildUrl = BASE + "#build=" + S.encode(S.buildPayload(doors, reqRef));
    var notes = c.x + (photo ? (c.x ? "\n\n" : "") + "Photo: I have a photo of the new door on my building. Please ask me for it." : "");
    var row = {
      reference: reqRef, name: c.n, company: c.co || null, phone: c.p || null, email: c.e || null,
      project_location: c.a || null, timeline: c.tl || null, notes: notes || null,
      doors: doors.map(S.record), door_count: doors.length, total_quantity: S.totalCount(doors),
      build_link: buildUrl, office_link: url, user_agent: String(navigator.userAgent || "").slice(0, 400)
    };
    if (CC) row.code_checks = CC.record(codeResult(), doors.length);
    sending = true; sendErr("");
    btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = "Sending\u2026";
    var retry = reqTries > 0; reqTries++;
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    var done = function () { clearTimeout(timer); sending = false; btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = "Send my quote request"; };
    fetch(QUOTE_API.url, {
      method: "POST", mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined,
      headers: { "Content-Type": "application/json", apikey: QUOTE_API.key, Prefer: "return=minimal" },
      body: JSON.stringify(row)
    }).then(function (r) {
      // 409 on a retry: the first try reached us even though its answer got lost, so the request is saved
      if (r.ok || (r.status === 409 && retry)) { done(); sent(c, url, photo); return; }
      if (r.status === 409) { done(); reqRef = S.newRef(); reqTries = 0; sendRequest(c); return; } // (reference already taken: pick another)
      throw new Error("HTTP " + r.status);
    }).catch(function () {
      done();
      sendErr("<strong>We couldn't send your request just now.</strong> Please check your connection and press <strong>Send my quote request</strong> again. Your doors and details are still here. Or call us at <a href=\"tel:+12707803235\">" + PHONE + "</a>.");
      $("#q-send-err").scrollIntoView({ block: "nearest" });
    });
  }
  function sent(c, url, photo) {
    reqSaved = true;
    try { // "My requests" (this browser only)
      var my = JSON.parse(localStorage.getItem("bgd-my-requests") || "[]"); if (!Array.isArray(my)) my = [];
      my = my.filter(function (x) { return x.ref !== reqRef; });
      my.unshift({ ref: reqRef, kind: "Door quote", when: new Date().toISOString(), summary: doors.map(function (d) { return ((d.qty || 1) > 1 ? d.qty + " × " : "") + S.typeLabel(d.type); }).join(", "), link: "index.html#build=" + S.encode(S.buildPayload(doors, reqRef)) });
      localStorage.setItem("bgd-my-requests", JSON.stringify(my.slice(0, 30)));
    } catch (eMy) { /* storage blocked */ }
    $("#sent-view").href = url;
    $("#sent-ref").textContent = reqRef;
    $("#sent-name").textContent = c.n ? ", " + c.n.split(" ")[0] : "";
    $("#sent-photo").hidden = !photo;
    showView("sent");
    reveal(work);
    focusEl($("#sent-title"));
  }
  $("#sent-back").addEventListener("click", function () { showBuilt(); });
  $("#sent-new").addEventListener("click", function () {
    doors = []; reqRef = ""; reqSig = ""; reqSaved = false; reqTries = 0; photoSaved = false; form.reset(); sendErr("");
    $$(".is-invalid", form).forEach(function (f) { f.classList.remove("is-invalid"); });
    $("#built-banner").hidden = true; startDoor(); focusStep();
  });

  /* ---------- links to the builder (nav "Get a quote", service cards, contact) ---------- */
  function currentHeading() {
    if (view === "built") return $("#built-title");
    if (view === "quote") return $("#quote-title");
    if (view === "sent") return $("#sent-title");
    return $('.builder__panel[data-step="' + step + '"] .bq');
  }
  function goToBuilder() { setMenu(false); reveal(work, true); focusEl(currentHeading()); }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-to-builder], [data-build-type]"); if (!a) return;
    e.preventDefault();
    var t = a.getAttribute("data-build-type");
    if (t && S.find(S.TYPES, t)) {
      if (view !== "steps") startDoor({ type: t });
      else { if (state.type !== t) { state.type = t; state.material = null; state.hardware = []; } step = 1; lastAction = ""; renderStep(); }
    }
    goToBuilder();
  });

  /* ---------- a shared build link: index.html#build=... reopens exactly those doors ---------- */
  function touched() { if (/^#build=/.test(location.hash) && history.replaceState) history.replaceState(null, "", location.pathname + location.search); }
  function openFromHash() {
    var m = /^#build=([A-Za-z0-9_-]+)/.exec(location.hash); if (!m) return false;
    var got = S.decode(m[1]), ban = $("#built-banner");
    if (!got || !got.doors.length) {
      startDoor(); notice.innerHTML = '<p class="builder__notice-msg">That link couldn\'t be opened. Please build your door here, or call us at ' + PHONE + ".</p>"; notice.hidden = false;
      return true;
    }
    doors = got.doors; editing = -1; state = blank(); step = 1;
    renderDoors(); showView("built");
    if (/[?&]from=fastlane\b/.test(location.search)) {
      var skip = ""; try { skip = sessionStorage.getItem("bgd-fastlane-skipped") || ""; } catch (eS) { skip = ""; }
      var msg = $("#q-msg"); if (msg && !msg.value) msg.value = "Sent from the contractor fast lane." + (skip ? "\nLines to review: " + skip.split("\n").join(" | ") : "");
    }
    var fromLane = /[?&]from=fastlane\b/.test(location.search);
    ban.innerHTML = (got.ref ? "These are the doors from quote request <strong>" + esc(got.ref) + "</strong>." : fromLane ? "These " + doors.length + " openings came from your door schedule." : "These doors were opened from a link.") +
      " Change anything you like, then get a quote." + (got.dropped ? " (One door in the link couldn't be opened.)" : "");
    ban.hidden = false;
    return true;
  }
  window.addEventListener("hashchange", function () { if (openFromHash()) { reveal(work, true); focusEl($("#built-title")); } });
  renderStep(); // (with a shared link open, this keeps the hidden steps and the preview in a clean state)
  if (!openFromHash()) {
    var presetDoor = "";
    try { presetDoor = new URLSearchParams(location.search).get("door") || ""; } catch (e1) { presetDoor = ""; }
    if (presetDoor && S.find(S.TYPES, presetDoor)) startDoor({ type: presetDoor });
  }


  /* ---------- Help chat ---------- */
  var chatPanel = $("#chat-panel"), chatLog = $("#chat-log"), chatChips = $("#chat-chips"), chatInput = $("#chat-input"), chatOpenBtn = $("#chat-open");
  var started = false, history = [], busy = false;
  /* AI answers come from the "chat" function (free tiers only). If it has no answer, is busy or can't be
     reached, the scripted answers below are used instead, so the chat always works. */
  var CHAT_URL = "https://esrwugfaqlwttxmfkpkx.supabase.co/functions/v1/chat";
  var CHAT_KEY = QUOTE_API.key; // the same public website key the quote form uses; the function checks the site origin and rate limits
  /* Replies are shown as plain text. As a second line of defence (the service already cleans them), drop any HTML,
     markdown and links to other websites, and keep only our own phone number and email. */
  var OWN_SITE = /(^|\.)(bluegrassdoor\.com|rccoleman19\.github\.io)$/i;
  var LINKISH = /\b(?:https?:\/\/|www\.)[^\s<>"'()\[\]]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|us|info|biz|gov|edu|app|dev|ai|xyz|site|online|shop|store|me|ly|gl|to)\b(?:\/[^\s<>"'()\[\]]*)?/gi;
  function tidyReply(t) {
    t = String(t == null ? "" : t).replace(/\r/g, "").replace(/<(script|style)\b[\s\S]*?(<\/\1\s*>|$)/gi, "")
      .replace(/<\s*(br|\/p|\/div|\/li)\b[^>]*>/gi, "\n").replace(/<\/?[a-z!][^>]*>?/gi, "")   // HTML tags
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")                                             // [text](link) -> text
      .replace(/\*\*|__|`/g, "").replace(/^\s*#{1,6}\s+/gm, "");                               // markdown marks
    t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, function (m) { return m.toLowerCase() === EMAIL ? m : EMAIL; });
    t = t.replace(LINKISH, function (m, off, all) {
      if (all.charAt(off - 1) === "@") return m;                                                // the domain of our email
      var tail = /[.,;:!?]+$/.exec(m); tail = tail ? tail[0] : ""; m = m.slice(0, m.length - tail.length);
      var host = m.replace(/^https?:\/\//i, "").split(/[\/?#:]/)[0];
      return (OWN_SITE.test(host) ? m : "") + tail;
    });
    t = t.replace(/(?:\+?1[\s.-]*)?\(?\b\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/g, function (m) { return m.replace(/\D/g, "").slice(-10) === "2707803235" ? m : PHONE; });
    return t.replace(/\(\s*\)/g, "").replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  function remember(role, text) { text = String(text || "").trim(); if (text) history.push({ role: role, content: text.slice(0, role === "user" ? 600 : 1500) }); if (history.length > 24) history = history.slice(-24); }
  function chatSession() {
    try { var k = sessionStorage.getItem("bgd-chat"); if (!k) { k = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("bgd-chat", k); } return k; }
    catch (e) { return chatSession.k || (chatSession.k = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36)); }
  }
  function builderSummary() {
    try {
      var line = function (d) { return [S.typeLabel(d.type), S.oneLine(d), (d.hardware || []).length ? "hardware: " + S.hwTitles(d).join(", ") : ""].filter(Boolean).join(" - "); };
      var out = doors.map(function (d, i) { return "Door " + (i + 1) + ((d.qty || 1) > 1 ? " (x" + d.qty + ")" : "") + ": " + line(d); });
      if (state && state.type) out.push("Door being built now (step " + step + " of 4): " + line(state));
      return out.join("\n").slice(0, 700);
    } catch (e) { return ""; }
  }
  var AI_ACTIONS = { builder: { go: "builder", label: "Build my door" }, gallery: { go: "gallery", label: "See our work" }, area: { go: "area", label: "View map" } };
  function aiActions(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (a) { var x = a && AI_ACTIONS[a.type]; if (x && out.indexOf(x) < 0 && out.length < 3) out.push(x); });
    return out.map(function (x, i) { return { href: x.href, go: x.go, label: x.label, alt: i > 0 }; });
  }
  function askAI(text, done) {
    if (!window.fetch || !window.AbortController) { done(false); return; }
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 8000);
    fetch(CHAT_URL, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", apikey: CHAT_KEY },
      body: JSON.stringify({ messages: history.slice(-12), builder: builderSummary(), sessionId: chatSession() })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { clearTimeout(timer); var r = d && !d.fallback && typeof d.reply === "string" ? tidyReply(d.reply) : ""; if (r) done(true, { reply: r, actions: d.actions }); else done(false); })
      .catch(function () { clearTimeout(timer); done(false); });
  }
  var CHIPS = ["Services", "Scheduling & hours", "Service area", "Broken door", "Get a quote", "Contact info"];
  function openChat() {
    chatPanel.hidden = false; chatWrap.classList.add("is-open"); chatOpenBtn.setAttribute("aria-expanded", "true");
    if (!started) {
      started = true;
      bot("Hi, welcome in. I'm Dory. I'll try to help with anything I can, not just doors, and we also do flagpoles. What would you like to know?");
      history = [];
      var note = document.createElement("p"); note.className = "chat__note";
      note.textContent = "Dory is a virtual assistant for Bluegrass Commercial Door & More.\nPlease don't share private info.\nFor anything urgent, call " + PHONE + ".";
      chatLog.appendChild(note);
      renderChips(CHIPS);
    }
    setTimeout(function () { if (window.innerWidth >= 640) chatInput.focus(); }, 50);
  }
  function closeChat() { if (chatPanel.hidden) return; chatPanel.hidden = true; chatWrap.classList.remove("is-open"); chatOpenBtn.setAttribute("aria-expanded", "false"); if (window.innerWidth >= 1024) chatOpenBtn.focus(); }
  chatOpenBtn.addEventListener("click", openChat);
  $$("[data-open-chat]").forEach(function (b) { b.addEventListener("click", openChat); });
  $("#chat-close").addEventListener("click", closeChat);
  function scrollLog() { chatLog.scrollTop = chatLog.scrollHeight; }
  function actionRow(actions) {
    var a = document.createElement("div"); a.className = "msg__actions";
    a.innerHTML = actions.map(function (x) {
      return x.href ? '<a href="' + esc(x.href) + '"' + (x.alt ? ' class="alt"' : "") + ">" + esc(x.label) + "</a>"
        : '<button type="button" data-go="' + esc(x.go) + '"' + (x.alt ? ' class="alt"' : "") + ">" + esc(x.label) + "</button>";
    }).join("");
    return a;
  }
  function bot(html, actions) { // scripted replies (trusted HTML written in this file)
    var m = document.createElement("div"); m.className = "msg msg--bot"; m.innerHTML = html;
    var said = m.textContent;
    if (actions && actions.length) m.appendChild(actionRow(actions));
    chatLog.appendChild(m); scrollLog(); remember("assistant", said);
  }
  function botText(text, actions) { // replies from the chat service: plain text only, never HTML
    var m = document.createElement("div"); m.className = "msg msg--bot";
    String(text).split("\n").forEach(function (line, i) { if (i) m.appendChild(document.createElement("br")); m.appendChild(document.createTextNode(line)); });
    if (actions && actions.length) m.appendChild(actionRow(actions));
    chatLog.appendChild(m); scrollLog(); remember("assistant", String(text));
  }
  function user(text) { var m = document.createElement("div"); m.className = "msg msg--user"; m.textContent = text; chatLog.appendChild(m); scrollLog(); remember("user", text); }
  function renderChips(list) { chatChips.innerHTML = list.map(function (c) { return '<button type="button">' + c + "</button>"; }).join(""); }
  function serviceLink(text) { return "service.html" + (text ? "?note=" + encodeURIComponent(String(text).slice(0, 300)) : ""); }
  /* Dory's next steps: add a button that opens the right flow, carrying what the visitor said */
  function routeActions(text, list) {
    var add = null;
    if (/(broken|repair|fix|won'?t (close|lock|latch|open)|stuck|slam|drag|sag|leak|damag|closer (is|isn'?t|won)|hinge)/i.test(text)) add = { href: serviceLink(text), label: "Fix my door", to: "service" };
    else if (/(schedule|takeoff|submittal|spec|contractor|\bgc\b|plans|several doors|multiple doors|\d+\s+doors)/i.test(text)) add = { href: "contractors.html", label: "Contractor fast lane", to: "contractors" };
    else if (/(my request|status|reference|bgd-[a-z0-9]{6})/i.test(text)) add = { href: "my-requests.html", label: "My requests", to: "my" };
    if (!add) return list;
    try { if (window.BGD_EVENT) window.BGD_EVENT("dory_route", { to: add.to }); } catch (eR) { /* ignore */ }
    return [{ href: add.href, label: add.label }].concat(list.map(function (x) { return { href: x.href, go: x.go, label: x.label, alt: true }; })).slice(0, 3);
  }
  var CALL = { href: TEL, label: "Call " + PHONE };
  var MAIL = { href: "mailto:" + EMAIL, label: "Email us", alt: true };
  AI_ACTIONS.call = CALL; AI_ACTIONS.email = MAIL;
  var INTENTS = [
    { k: /(emergenc|broken|break[- ]?in|won'?t (close|lock|latch|open)|stuck|damag|urgent|asap|right away|kicked|smash|repair|fix|slam|drag|sag)/i, r: function (text) {
      bot("Sorry you're dealing with that. If the building can't be secured or someone could get hurt, please call our office now at <strong>" + PHONE + "</strong>. Otherwise, start a repair request: tell us what the door is doing, add a photo for a first look, and the office follows up.", [CALL, { href: serviceLink(text), label: "Fix my door" }, { href: "service.html#photo", label: "Send a photo", alt: true }]); } },
    { k: /(door schedule|schedule of doors|takeoff|take-off|submittal|spec sheet|hardware schedule|contractor|\bgc\b|general contractor|bid set|plans|several doors|multiple doors|\d+\s+doors)/i, r: function () {
      bot("For a job with several openings, the <strong>contractor fast lane</strong> is quickest: paste your door schedule, check each opening, print it or download a CSV, and send it all to our office in one request.", [{ href: "contractors.html", label: "Contractor fast lane" }, CALL]); } },
    { k: /(my request|status|reference|bgd-[a-z0-9]{6}|did you get|follow ?up)/i, r: function () {
      bot("Requests sent from this browser are listed in <strong>My requests</strong> with their reference number. For an update, call " + PHONE + " and give the reference.", [{ href: "my-requests.html", label: "My requests" }, CALL]); } },
    { k: /(flag ?pole|flag)/i, r: function () {
      bot("Yes, we install flagpoles. They're built to stand tall in tough weather, so you can fly your American and state flags. When you'd like to talk about yours, call us at " + PHONE + " or send an email.", [CALL, MAIL]); } },
    { k: /door closers?/i, r: function () {
      bot("A door closer is hardware we offer: controlled self-closing, the same Door closer listed with our other hardware. A regular closer on a door, including an existing door, is that hardware. It is not an automatic or power operator. Call " + PHONE + ", or add a door closer when you build the door and send a quote request.", [{ go: "builder", label: "Build my door" }, CALL]); } },
    { k: /(fire|rated|code|egress|panic|exit device|stairwell)/i, r: function () {
      bot("We can help with that. We provide <strong>code-compliant fire-rated doors</strong>, along with hollow metal doors and frames and the hardware that goes with them, such as closers and exit devices. Tell us about your opening, build the door, or call " + PHONE + ".", [{ go: "builder", label: "Build my door" }, CALL]); } },
    { k: /(storefront|glass|entrance|entry|commercial|business|office|retail|industrial|security|safe ?room)/i, r: function () {
      bot("For a business, we can take care of the whole entrance: <strong>storefront doors and glass</strong>, code-compliant fire-rated doors, and durable security doors. We also do safe room doors for homes and businesses. Build the door when you're ready, or call " + PHONE + ".", [{ go: "builder", label: "Build my door" }, CALL]); } },
    { k: /(residential|home|house|interior|barn|closet|replace|replacement|remodel|swing)/i, r: function () {
      bot("We do residential work too, and we're glad to help. That includes interior and exterior swing doors, replacement doors, safe room doors, and sliding barn doors, for new construction or remodeling. Build the door, or call " + PHONE + " if you'd rather talk it through.", [{ go: "gallery", label: "See our work" }, { go: "builder", label: "Build my door", alt: true }]); } },
    { k: /(price|cost|how much|quote|estimate|bid|pricing)/i, r: function () {
      bot("We don't give prices in chat. Every opening is a little different, so we quote each project on its own. Build your door and send a quote request, and our office will follow up. Or call " + PHONE + " whenever you're ready.", [{ go: "builder", label: "Build my door" }, CALL]); } },
    { k: /(hour|open|close[sd]?\b|schedul|appointment|when can|availability|available|time)/i, r: function () {
      bot("Our hours aren't listed online. Call our office at <strong>" + PHONE + "</strong> and we'll find a time with you. You can also build your door and send a quote request whenever it suits you, and we'll reach out.", [CALL, { go: "builder", label: "Build my door", alt: true }]); } },
    { k: /(area|serve|service area|travel|county|where|location|located|near|bowling green|warren|kentucky|\bky\b|come to)/i, r: function () {
      bot("We're based at <strong>930 Gordon Avenue in Bowling Green, KY</strong> and serve <strong>Warren County and the surrounding area</strong>. Not sure if we cover your spot? Call " + PHONE + " and we'll let you know.", [{ go: "area", label: "View map" }, CALL]); } },
    { k: /(service|offer|what do you|do you do|products|hardware|frame|partition|accessor|door)/i, r: function () {
      bot("Happy to help. We're your door specialists: <strong>doors, frames, hardware, partitions, accessories and flag poles</strong> for commercial and residential projects. That includes storefronts and glass, fire-rated and hollow metal, security and safe room doors, interior and exterior doors, and flagpoles. Our own team does the fabrication. Build a door when you're ready, or call " + PHONE + ".", [{ go: "services", label: "View services" }, { go: "builder", label: "Build my door", alt: true }]); } },
    { k: /(contact|phone|call|email|e-mail|address|talk|speak|person|human|someone)/i, r: function () {
      bot("We'd be glad to hear from you:<br>&#9742; <a href='" + TEL + "'>" + PHONE + "</a><br>&#9993; <a href='mailto:" + EMAIL + "'>" + EMAIL + "</a><br>930 Gordon Avenue, Bowling Green, KY 42101<br>Call us if you'd like to talk it through.", [CALL, MAIL]); } },
    { k: /(thank|thanks|thx|appreciate)/i, r: function () {
      bot("You're welcome. If something else comes up, call " + PHONE + ", or build the door and send a quote request. We're here when you need us.", [CALL, { go: "builder", label: "Build my door", alt: true }]); } },
    { k: /^(hi|hello|hey|howdy|good (morning|afternoon|evening))\b/i, r: function () {
      bot("Hello, welcome. I'll try to help with anything I can, not just doors, and we also do flagpoles. What's your question? You can also build the door or call " + PHONE + ".", [{ go: "builder", label: "Build my door" }, CALL]); } }
  ];
  var CHIP_MAP = { "Services": "services", "Scheduling & hours": "hours", "Service area": "service area", "Broken door": "broken door", "Get a quote": "quote", "Contact info": "contact" };
  function onTopic(text) {
    return /door|frame|hardware|hinge|lock|closer|deadbolt|panic|exit|kick|keypad|storefront|fire|barn|flag|quote|pric|cost|estimate|\bbid\b|hour|schedul|appoint|address|phone|e-?mail|bowling|warren|kentuck|\bky\b|glass|steel|wood|fiberglass|hollow|partition|accessor|safe|security|entrance|entry|commercial|residential|remodel|replac|swing|builder|opening|measure|\bcode\b|\bada\b|egress|threshold|repair|\bfix\b|broken|stuck|contact|shop|office|bluegrass|sonya|install|service/i.test(text);
  }
  function answer(text) {
    for (var i = 0; i < INTENTS.length; i++) { if (INTENTS[i].k.test(text)) { INTENTS[i].r(text); return; } }
    if (!onTopic(text)) {
      bot("We only help with questions about <strong>Bluegrass Commercial Door &amp; More</strong>. I'll try to help with anything I can, not just doors, and we also do flagpoles. You can also build the door or call <strong>" + PHONE + "</strong>.", [{ go: "builder", label: "Build my door" }, CALL]);
      return;
    }
    bot("That's a good one for our team to walk through with you. Call <strong>" + PHONE + "</strong>, or build the door and send a quote request, and we'll take it from there.", [CALL, { go: "builder", label: "Build my door", alt: true }]);
  }
  function ask(text, query) {
    busy = true;
    user(text);
    var t = document.createElement("div"); t.className = "msg msg--bot msg--typing"; t.innerHTML = "<i></i><i></i><i></i>"; chatLog.appendChild(t); scrollLog();
    var scripted = function () { t.remove(); answer(query || text); busy = false; };
    if (query) { setTimeout(scripted, 550); return; } // topic chips keep their scripted answers
    var t0 = Date.now();
    askAI(text, function (ok, d) {
      setTimeout(function () {
        if (!ok) { scripted(); return; }
        t.remove(); botText(d.reply, routeActions(text, aiActions(d.actions))); busy = false;
      }, Math.max(0, 450 - (Date.now() - t0)));
    });
  }
  chatChips.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b && !busy) ask(b.textContent, CHIP_MAP[b.textContent]); });
  $("#chat-form").addEventListener("submit", function (e) { e.preventDefault(); var v = chatInput.value.trim(); if (!v || busy) return; chatInput.value = ""; ask(v.slice(0, 600)); });
  chatLog.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]"); if (!b) return;
    var go = b.getAttribute("data-go");
    var target = { builder: "#builder", gallery: "#projects", area: "#area", services: "#services" }[go];
    if (window.innerWidth < 640) closeChat();
    if (go === "builder") { goToBuilder(); return; }
    var el = $(target); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" });
  });
})();

/* Service cards: keep every card box exactly the size the original layout gives it, then tighten
   the text so the photo area grows into the freed space (see .is-tight in styles.css). */
(function () {
  var grid = document.querySelector(".services");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.children), lastW = -1, raf = 0;
  function lock(force) {
    var w = grid.getBoundingClientRect().width;
    if (!force && w === lastW) return;
    lastW = w;
    grid.classList.remove("is-tight");
    cards.forEach(function (c) { c.style.height = ""; });
    var hs = cards.map(function (c) { return c.getBoundingClientRect().height; });
    cards.forEach(function (c, i) { c.style.height = hs[i] + "px"; });
    grid.classList.add("is-tight");
  }
  lock(true);
  window.addEventListener("resize", function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { lock(false); }); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { lock(true); });
  window.addEventListener("load", function () { lock(true); });
})();

