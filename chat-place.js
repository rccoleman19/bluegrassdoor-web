/* Keeps the floating help button (#chat-open) off the door drawings.
   Only moves the button; it does not touch what the chat says.
   Tries, in order: normal spot (bottom right), round icon at bottom right,
   and, when the live drawing panel is on screen, a "Questions?" button in the
   panel's heading instead (same chat). Last resorts: round icon at bottom left,
   then the button steps aside until the drawing scrolls away. */
(function () {
  "use strict";
  var chat = document.getElementById("chat"), fab = document.getElementById("chat-open");
  if (!chat || !fab) return;
  var DRAW = "svg.dp-svg, .dcard__draw svg, .qdoor__draw svg, .rq-draw svg, [data-door-preview] svg, .viz__stage canvas";
  var SPOTS = ["", "chat--mini", "chat--mini chat--left"], ALL = ["chat--mini", "chat--left", "chat--tucked"];
  var GAP = 8, queued = false, cur = "", timer = 0, rects = {};

  function apply(s) {
    ALL.forEach(function (c) { chat.classList.remove(c); });
    if (s) s.split(" ").forEach(function (c) { chat.classList.add(c); });
  }
  function setSpot(s) {                             // only touches the page when the spot really changes
    if (s === cur) return;
    cur = s; apply(s);
    document.documentElement.classList.toggle("chat-tucked", s === "chat--tucked");
  }
  // the button is position:fixed, so each spot's box only changes with the window size: measure once, reuse
  function rectOf(s) {
    if (!rects[s]) {
      if (s !== cur) apply(s);
      var r = fab.getBoundingClientRect();
      rects[s] = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
      if (s !== cur) apply(cur);
    }
    return rects[s];
  }
  // the heading row of the live drawing panel, fully on screen (it holds a "Questions?" button shown while tucked)
  function panelAskOnScreen() {
    var heads = document.querySelectorAll(".dp-head");
    for (var i = 0; i < heads.length; i++) {
      var r = heads[i].getBoundingClientRect();
      if (r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight && heads[i].querySelector(".dp-ask")) return true;
    }
    return false;
  }
  function drawings() {
    var out = [], vh = window.innerHeight, vw = window.innerWidth;
    document.querySelectorAll(DRAW).forEach(function (el) {
      if (chat.contains(el)) return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return;
      out.push(r);
    });
    return out;
  }
  function hits(f, list) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (f.left < r.right + GAP && f.right > r.left - GAP && f.top < r.bottom + GAP && f.bottom > r.top - GAP) return true;
    }
    return false;
  }
  function place() {
    queued = false;
    if (chat.classList.contains("is-open")) return;
    var list = drawings();
    if (!list.length || !rectOf("").width) { setSpot(""); return; }   // nothing to avoid, or the button is hidden (small screens)
    for (var i = 0; i < SPOTS.length; i++) {
      if (SPOTS[i] === "chat--mini chat--left" && panelAskOnScreen()) break;
      if (!hits(rectOf(SPOTS[i]), list)) { setSpot(SPOTS[i]); return; }
    }
    setSpot("chat--tucked");
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  function later() { queue(); clearTimeout(timer); timer = setTimeout(queue, 350); }   // again once panels finish moving

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", function () { rects = {}; queue(); });
  window.addEventListener("load", function () { rects = {}; queue(); });
  document.addEventListener("click", later, true);
  document.addEventListener("input", later, true);
  document.addEventListener("change", later, true);
  document.addEventListener("toggle", later, true);
  queue();
})();
