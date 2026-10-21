/* Visitor tracking for this static site.
   Events are recorded in window.dataLayer and window.BGD_EVENTS in the browser,
   in order. Each row has step (1, 2, 3, ... for this tab) and t (client time).
   The same row is posted to the site_events table. The public site can add a
   row. It cannot read the table. There is no name, phone, email, address, or
   notes column.

   The write target is the bluegrassdoor Supabase table site_events, using the
   same public publishable key the quote form already uses. To point somewhere
   else, set window.BGD_TRACK before this file runs:

   window.BGD_TRACK = {
     url: "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/site_events",
     key: "",
     posthogKey: "",
     posthogHost: "https://us.i.posthog.com"
   };

   posthogKey is the PostHog project key for this site (it starts with phc_).
   The same events are also sent to https://us.i.posthog.com. No extra library is loaded.

   If sessionStorage is blocked, the session id and the step counter stay in memory
   for this page only. They are not written to a cookie or to localStorage.
   The step counter still stops at 500.

   How to read the rows: open the Supabase SQL editor for project bluegrassdoor
   and run visit-queries.sql. visit-review.html is not in the site menu.

   Events:
   page_view, click, tel_click, mailto_click, scroll_depth, section_enter,
   hover, focus, form_focus, quote_submit, quote_submit_ok, quote_submit_fail,
   chat_open, chat_close, chat_send, gallery_open, engage, page_leave,
   call_start, call_end, quote_from_call.

   A visitor's name, phone, email, address, company, and notes are never copied
   into an event. Phone and email clicks are counted without the number or
   address. The page path is the pathname only, so a quote link's query and
   hash stay out of the event.
*/
(function () {
  var defaults = {
    url: "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/site_events",
    key: "sb_publishable_aOUQv3tbsDOP4eTDjbyA6w_RKZBxx8K",
    posthogKey: "phc_zLFL5DuFYuYtBif2qQFKDAtkztkTSufAgfzVGdEbtqz9",
    posthogHost: "https://us.i.posthog.com"
  };
  var over = window.BGD_TRACK || {};
  var cfg = {
    url: over.url ? String(over.url) : defaults.url,
    key: over.key ? String(over.key) : defaults.key,
    posthogKey: over.posthogKey ? String(over.posthogKey) : defaults.posthogKey,
    posthogHost: over.posthogHost ? String(over.posthogHost) : defaults.posthogHost
  };

  var QUOTE_FORMS = {
    "quote-form": 1,
    "qlist-form": 1,
    "fp-form": 1,
    "door-form": 1,
    "flagpole-form": 1
  };
  var DROP = {
    name: 1, phone: 1, email: 1, address: 1, notes: 1, message: 1,
    value: 1, company: 1, telephone: 1, comment: 1, body: 1
  };
  var HOVER_SEL = "a, button, summary, .svc, .gallery__item";
  var SCROLL_MARKS = [25, 50, 75, 100];
  var ENGAGE_MARKS = [15, 30, 60, 120, 300];
  var seenHover = typeof WeakMap === "function" ? new WeakMap() : null;
  var seenFocus = typeof WeakMap === "function" ? new WeakMap() : null;
  var seenField = {};
  var seenScroll = {};
  var seenSection = {};
  var seenEngage = {};
  var pendingForm = "";
  var left = false;
  var scrollQueued = false;
  var running = document.visibilityState !== "hidden";
  var visibleSince = running ? Date.now() : null;
  var visibleMs = 0;
  var memSid = "";
  var memStep = 0;
  var quoteBodies = [];
  var netFetch = window.fetch ? window.fetch.bind(window) : null;

  window.dataLayer = window.dataLayer || [];
  window.BGD_EVENTS = window.BGD_EVENTS || [];

  function own(obj, k) {
    if (Object.hasOwn) return Object.hasOwn(obj, k);
    return Object.keys(obj).indexOf(k) !== -1;
  }

  function digitRun(s) {
    var n = 0, max = 0, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) {
        n++;
        if (n > max) max = n;
      } else if (c === 45 || c === 40 || c === 41 || c === 46 || c === 32 || c === 43) {
        /* phone separators stay inside the run */
      } else {
        n = 0;
      }
    }
    return max;
  }

  function scrubText(s) {
    var parts, out, i, bit;
    if (s == null) return "";
    s = String(s).replace(/\s+/g, " ").trim();
    if (!s) return "";
    parts = s.split(" ");
    out = [];
    for (i = 0; i < parts.length; i++) {
      bit = parts[i];
      if (!bit) continue;
      if (bit.indexOf("@") !== -1) continue;
      if (digitRun(bit) >= 7) continue;
      out.push(bit);
    }
    s = out.join(" ");
    if (s.indexOf("@") !== -1) return "";
    return s.slice(0, 80);
  }

  function pagePath() {
    return location.pathname || "/";
  }

  function sidOk(v) {
    var i, c;
    if (!v || v.length < 8 || v.length > 40) return false;
    for (i = 0; i < v.length; i++) {
      c = v.charCodeAt(i);
      if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 122))) return false;
    }
    return true;
  }

  function sid() {
    var k = "bgd-sid", v = "";
    try {
      v = sessionStorage.getItem(k) || "";
      if (sidOk(v)) return v;
      v = "";
      while (v.length < 16) v += Math.random().toString(36).slice(2);
      v = v.slice(0, 24);
      sessionStorage.setItem(k, v);
      return v;
    } catch (err) {
      if (sidOk(memSid)) return memSid;
      v = "";
      while (v.length < 16) v += Math.random().toString(36).slice(2);
      memSid = v.slice(0, 24);
      return memSid;
    }
  }

  function nextStep() {
    var n = 1;
    try {
      n = Number(sessionStorage.getItem("bgd-step") || "0") + 1;
      if (!isFinite(n) || n < 1) n = 1;
      if (n > 500) return 0;
      sessionStorage.setItem("bgd-step", String(n));
      return n;
    } catch (err) {
      if (memStep >= 500) return 0;
      memStep += 1;
      return memStep;
    }
  }

  function linkPath(href) {
    var u, door;
    try {
      u = new URL(href, location.href);
    } catch (err) {
      return "";
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    door = u.searchParams.get("door");
    if (door && door.length < 24 && digitRun(door) < 7 && door.indexOf("@") === -1) {
      return u.pathname + "?door=" + door;
    }
    return u.pathname;
  }

  function whereOf(el) {
    var n = el, sectionId = "", tag;
    while (n && n !== document.body) {
      tag = n.tagName;
      if (tag === "NAV") return "nav";
      if (tag === "HEADER" || (n.classList && n.classList.contains("topbar"))) return "header";
      if (tag === "FOOTER") return "footer";
      if (n.classList && n.classList.contains("callbar")) return "callbar";
      if (n.id === "chat" || n.id === "chat-panel") return "chat";
      if (!sectionId && tag === "SECTION" && n.id) sectionId = n.id;
      n = n.parentElement;
    }
    return sectionId || "page";
  }

  function controlOf(el) {
    var add, build, val, bits, n, i;
    if (!el || !el.getAttribute) return "";
    if (el.id) return scrubText(el.id);
    add = el.getAttribute("data-add");
    if (add) return "add-" + scrubText(add);
    build = el.getAttribute("data-build-type");
    if (build) return scrubText(build);
    val = el.getAttribute("data-value");
    if (val && val.length < 32 && digitRun(val) < 7 && val.indexOf("@") === -1) return scrubText(val);
    bits = [];
    n = el;
    i = 0;
    while (n && n.tagName && i < 4) {
      bits.push(n.tagName.toLowerCase());
      n = n.parentElement;
      i++;
    }
    return bits.join(">");
  }

  function cleanProps(props) {
    var out = {}, k, v;
    if (!props) return out;
    for (k in props) {
      if (!own(props, k)) continue;
      if (DROP[k]) continue;
      v = props[k];
      if (typeof v === "number" && isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
      else {
        v = scrubText(v);
        if (v) out[k] = v;
      }
    }
    return out;
  }

  var PAGE_ONLY = { service_step: 1, photo_look: 1, fastlane_parse: 1, fastlane_open: 1, fastlane_export: 1, dory_route: 1, myrequests_view: 1 };
  function ship(name, props, step, clientMs) {
    var body, headers, host;
    if (!netFetch || !step) return;
    body = JSON.stringify({
      sid: sid(),
      step: step,
      event: name,
      path: pagePath(),
      client_ms: clientMs,
      props: props || {}
    });
    /* the newer events go to PostHog and the page only: the site_events insert policy lists the original event names */
    if (cfg.url && cfg.key && !PAGE_ONLY[name]) {
      headers = { "Content-Type": "application/json", apikey: cfg.key, Prefer: "return=minimal" };
      netFetch(cfg.url, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: headers,
        body: body
      }).catch(function () {});
    }
    if (cfg.posthogKey) {
      host = String(cfg.posthogHost || defaults.posthogHost).replace(/\/$/, "");
      netFetch(host + "/capture/", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: cfg.posthogKey,
          event: name,
          distinct_id: sid(),
          properties: {
            $pathname: pagePath(),
            $lib: "bgd",
            path: pagePath(),
            props: props
          }
        })
      }).catch(function () {});
    }
  }

  function send(name, props) {
    var clean = cleanProps(props);
    var n = nextStep();
    var when = Date.now();
    var row = { event: name, path: pagePath(), step: n, t: when };
    var k;
    for (k in clean) {
      if (own(clean, k)) row[k] = clean[k];
    }
    window.dataLayer.push(row);
    window.BGD_EVENTS.push(row);
    if (window.BGD_EVENTS.length > 200) window.BGD_EVENTS.shift();
    ship(name, clean, n, when);
  }

  function element(node) {
    if (!node) return null;
    if (node.nodeType === 1) return node;
    return node.parentElement || null;
  }

  function once(map, el, key) {
    if (!el) return true;
    if (map) {
      if (map.get(el)) return true;
      map.set(el, 1);
      return false;
    }
    if (el[key]) return true;
    el[key] = 1;
    return false;
  }

  function onClick(e) {
    var el = element(e.target);
    var href, low, where, path, kind, to;
    if (!el || !el.closest) return;
    el = el.closest("a, button, summary, [role='button']");
    if (!el) return;
    href = el.getAttribute("href") || "";
    low = href.toLowerCase();
    where = whereOf(el);
    path = pagePath();
    if (low.indexOf("tel:") === 0) {
      send("tel_click", { where: where, path: path });
      return;
    }
    if (low.indexOf("mailto:") === 0) {
      send("mailto_click", { where: where, path: path });
      return;
    }
    if (el.id === "chat-open") {
      send("chat_open", { path: path });
      return;
    }
    if (el.id === "chat-close") {
      send("chat_close", { path: path });
      return;
    }
    if (el.classList && el.classList.contains("gallery__item")) {
      send("gallery_open", { where: where, control: controlOf(el), path: path });
      return;
    }
    kind = el.tagName === "A" ? "a" : "button";
    to = href ? linkPath(href) : "";
    send("click", {
      kind: kind,
      where: where,
      control: controlOf(el),
      label: el.getAttribute("aria-label") || el.textContent || "",
      to: to,
      path: path
    });
  }

  function onHover(e) {
    var el = element(e.target);
    if (!el || !el.closest) return;
    el = el.closest(HOVER_SEL);
    if (!el || once(seenHover, el, "_bgdH")) return;
    send("hover", { where: whereOf(el), control: controlOf(el), path: pagePath() });
  }

  function onFocus(e) {
    var t = element(e.target);
    var tag, field, hoverEl, target, fid;
    if (!t) return;
    tag = t.tagName;
    field = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") ? t : null;
    if (field && field.type === "hidden") field = null;
    hoverEl = t.closest ? t.closest(HOVER_SEL) : null;
    target = field || hoverEl;
    if (target && !once(seenFocus, target, "_bgdF")) {
      send("focus", { where: whereOf(target), control: controlOf(target), path: pagePath() });
    }
    if (!field || !field.form) return;
    fid = (field.form.id || "form") + ":" + (field.id || field.name || field.type || "field");
    if (seenField[fid]) return;
    seenField[fid] = 1;
    send("form_focus", {
      form: field.form.id || "",
      field: field.id || field.name || field.type || "field",
      path: pagePath()
    });
  }

  function onSubmit(e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    if (form.id === "chat-form") {
      send("chat_send", { form: "chat-form", path: pagePath() });
      return;
    }
    if (QUOTE_FORMS[form.id] || (form.classList && form.classList.contains("qform"))) {
      pendingForm = form.id || "quote";
    }
  }

  function measureScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max <= 0 ? 100 : Math.round((window.scrollY / max) * 100);
    var i, mark;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    for (i = 0; i < SCROLL_MARKS.length; i++) {
      mark = SCROLL_MARKS[i];
      if (pct >= mark && !seenScroll[mark]) {
        seenScroll[mark] = 1;
        send("scroll_depth", { pct: mark, path: pagePath() });
      }
    }
  }

  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      measureScroll();
    });
  }

  function watchSections() {
    var nodes, i;
    if (!window.IntersectionObserver) return;
    nodes = document.querySelectorAll("section[id]");
    if (!nodes.length) return;
    var io = new IntersectionObserver(function (entries) {
      var i, entry, id;
      for (i = 0; i < entries.length; i++) {
        entry = entries[i];
        if (!entry.isIntersecting) continue;
        id = entry.target.id;
        if (!id || seenSection[id]) continue;
        seenSection[id] = 1;
        send("section_enter", { section: id, path: pagePath() });
        io.unobserve(entry.target);
      }
    }, { threshold: 0.2 });
    for (i = 0; i < nodes.length; i++) io.observe(nodes[i]);
  }

  function accumulate(now) {
    if (!running || visibleSince == null) return;
    visibleMs += now - visibleSince;
    visibleSince = now;
  }

  function markEngage() {
    var sec = Math.floor(visibleMs / 1000);
    var i, mark;
    for (i = 0; i < ENGAGE_MARKS.length; i++) {
      mark = ENGAGE_MARKS[i];
      if (sec >= mark && !seenEngage[mark]) {
        seenEngage[mark] = 1;
        send("engage", { seconds: mark, path: pagePath() });
      }
    }
    return sec;
  }

  function flushVisible() {
    accumulate(Date.now());
    return markEngage();
  }

  function onHide() {
    var sec;
    if (running) {
      accumulate(Date.now());
      running = false;
      visibleSince = null;
    }
    sec = markEngage();
    if (left) return;
    left = true;
    send("page_leave", { seconds: sec, path: pagePath() });
  }

  function resume() {
    if (document.visibilityState === "hidden") {
      onHide();
      return;
    }
    if (!running) {
      running = true;
      visibleSince = Date.now();
    }
    left = false;
  }

  function sameQuote(body) {
    var i, prior = false;
    if (typeof body !== "string" || !body) return false;
    for (i = 0; i < quoteBodies.length; i++) {
      if (quoteBodies[i] === body) prior = true;
    }
    quoteBodies.push(body);
    if (quoteBodies.length > 40) quoteBodies.shift();
    return prior;
  }

  if (netFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
      var isQuote = url.indexOf("quote_requests") !== -1;
      var formId = pendingForm || "";
      var prior = isQuote ? sameQuote(init && init.body) : false;
      var p = netFetch(input, init);
      if (isQuote && p && p.then) {
        send("quote_submit", { form: formId, path: pagePath() });
        p.then(function (res) {
          var status = res && typeof res.status === "number" ? res.status : 0;
          /* A first 409 means that reference is taken. The form chooses another and tries again.
             A 409 for the same payload means the first try was saved and its answer was lost. */
          if (res && res.ok) {
            send("quote_submit_ok", { form: formId, status: status, path: pagePath() });
            return;
          }
          if (status === 409 && prior) {
            send("quote_submit_ok", { form: formId, status: status, path: pagePath() });
            return;
          }
          if (status === 409) return;
          send("quote_submit_fail", { form: formId, status: status, path: pagePath() });
        }, function () {
          send("quote_submit_fail", { form: formId, status: 0, path: pagePath() });
        });
      }
      return p;
    };
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("mouseover", onHover, true);
  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("submit", onSubmit, true);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") onHide();
    else resume();
  });
  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", resume);
  window.BGD_CALL_EVENT = function (name, props) {
    var allow = { call_start: 1, call_end: 1, quote_from_call: 1 };
    var keep = { seconds: 1, voice: 1, kind: 1 };
    var safe, k;
    if (!allow[name]) return;
    safe = {};
    props = props || {};
    for (k in props) {
      if (!own(props, k) || !keep[k]) continue;
      if (k === "kind" && props[k] !== "quote" && props[k] !== "callback") continue;
      safe[k] = props[k];
    }
    send(name, safe);
  };
  /* events from the repair request, photo first look, contractor fast lane and Dory routing (no personal fields) */
  window.BGD_EVENT = function (name, props) {
    var allow = { service_step: 1, photo_look: 1, fastlane_parse: 1, fastlane_open: 1, fastlane_export: 1, dory_route: 1, myrequests_view: 1 };
    var keep = { step: 1, result: 1, count: 1, kind: 1, urgent: 1, to: 1 };
    var safe = {}, k;
    if (!allow[name]) return;
    props = props || {};
    for (k in props) {
      if (!own(props, k) || !keep[k]) continue;
      if (typeof props[k] === "string") safe[k] = props[k].slice(0, 40);
      else if (typeof props[k] === "number" || typeof props[k] === "boolean") safe[k] = props[k];
    }
    send(name, safe);
  };
  send("page_view", { path: pagePath() });
  watchSections();
  measureScroll();
  setInterval(flushVisible, 1000);
})();
