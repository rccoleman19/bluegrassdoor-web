/* Run: node track-check.js
   Stand-in clock, page, storage, and fetch. No network and no quote request row. */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = __dirname;
var TRACK = fs.readFileSync(path.join(ROOT, "track.js"), "utf8");
var QUOTE = "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/quote_requests";
var fails = [];

function fail(name, detail) {
  fails.push(name + (detail ? ": " + detail : ""));
  console.log("FAIL " + name + (detail ? " — " + detail : ""));
}
function pass(name) { console.log("ok   " + name); }

function copyGlobals(ctx) {
  ["JSON", "Math", "Promise", "Error", "parseInt", "parseFloat", "isFinite", "isNaN",
    "Object", "Array", "String", "Number", "RegExp", "Date", "WeakMap", "URL",
    "encodeURIComponent", "decodeURIComponent"].forEach(function (k) {
    ctx[k] = global[k];
  });
}

function listen(target) {
  target._ev = {};
  target.addEventListener = function (type, fn) {
    (target._ev[type] = target._ev[type] || []).push(fn);
  };
  target.removeEventListener = function () {};
}

function fire(target, type, ev) {
  ev = ev || {};
  ev.type = type;
  var list = (target._ev && target._ev[type]) || [];
  for (var i = 0; i < list.length; i++) list[i](ev);
}

function bootTrack(opts) {
  opts = opts || {};
  var clock = opts.clock0 == null ? 0 : opts.clock0;
  var visibility = opts.visibility || "visible";
  var shipped = [];
  var quotePlan = (opts.quotes || []).slice();
  var store = {};
  var ctx = {};
  copyGlobals(ctx);
  ctx.Date = { now: function () { return clock; } };
  ctx.console = console;
  ctx.setInterval = function () { return 1; };
  ctx.clearInterval = function () {};
  ctx.setTimeout = function () { return 1; };
  ctx.clearTimeout = function () {};
  ctx.requestAnimationFrame = function (fn) { return 1; };
  ctx.navigator = { userAgent: "check" };
  ctx.location = { pathname: "/index.html", href: "http://local/index.html", search: "", hash: "" };
  ctx.history = { replaceState: function () {} };
  if (opts.throwStorage) {
    ctx.sessionStorage = {
      getItem: function () { throw new Error("blocked"); },
      setItem: function () { throw new Error("blocked"); }
    };
  } else {
    ctx.sessionStorage = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    };
  }
  ctx.fetch = function (url, init) {
    url = typeof url === "string" ? url : (url && url.url ? url.url : "");
    if (url.indexOf("quote_requests") !== -1) {
      var step = quotePlan.shift() || { status: 201 };
      if (step.lost) return Promise.reject(new Error("lost"));
      return Promise.resolve({ ok: step.status >= 200 && step.status < 300, status: step.status });
    }
    shipped.push({ url: url, body: init && init.body });
    return Promise.resolve({ ok: true, status: 201 });
  };
  var doc = {};
  listen(doc);
  doc.nodeType = 9;
  doc.body = { nodeType: 1, tagName: "BODY", parentElement: null };
  doc.documentElement = { scrollHeight: 5000 };
  doc.querySelectorAll = function () { return []; };
  doc.querySelector = function () { return null; };
  Object.defineProperty(doc, "visibilityState", {
    get: function () { return visibility; }
  });
  ctx.document = doc;
  ctx.window = ctx;
  listen(ctx);
  ctx.scrollY = 0;
  ctx.innerHeight = 800;
  ctx.innerWidth = 1200;
  vm.createContext(ctx);
  vm.runInContext(TRACK, ctx, { filename: "track.js" });
  return {
    ctx: ctx,
    shipped: shipped,
    setClock: function (n) { clock = n; },
    setVis: function (v) { visibility = v; },
    fire: function (target, type, ev) { fire(target === "doc" ? doc : ctx, type, ev); },
    doc: doc
  };
}

function events(page) { return page.ctx.BGD_EVENTS || page.ctx.window.BGD_EVENTS; }

function named(page, name) {
  return events(page).filter(function (row) { return row.event === name; });
}

function sidOf(body) {
  var row = JSON.parse(body);
  return row.sid || row.distinct_id || "";
}

async function quoteFlow(name, plan, bodies, expectOk, expectFail) {
  var page = bootTrack({ quotes: plan });
  page.fire("doc", "submit", {
    target: {
      tagName: "FORM",
      id: "qlist-form",
      classList: { contains: function () { return false; } }
    }
  });
  var i;
  for (i = 0; i < bodies.length; i++) {
    await page.ctx.fetch(QUOTE, { method: "POST", body: bodies[i] }).catch(function () {});
  }
  await Promise.resolve();
  var oks = named(page, "quote_submit_ok");
  var failsHere = named(page, "quote_submit_fail");
  if (oks.length !== expectOk || failsHere.length !== expectFail) {
    fail(name, "ok " + oks.length + " fail " + failsHere.length + " events " + events(page).map(function (r) { return r.event; }).join(","));
    return;
  }
  var blob = page.shipped.map(function (row) { return row.body; }).join("\n");
  if (blob.indexOf("Ada") !== -1 || blob.indexOf("@") !== -1) {
    fail(name, "private text left the browser");
    return;
  }
  var sawSite = false, sawHog = false, sid = "", mismatch = false;
  page.shipped.forEach(function (row) {
    if (row.url.indexOf("site_events") !== -1) sawSite = true;
    if (row.url.indexOf("posthog.com") !== -1) sawHog = true;
    var id = sidOf(row.body);
    if (!sid) sid = id;
    else if (id && id !== sid) mismatch = true;
  });
  if (!sawSite || !sawHog || mismatch || !/^[a-z0-9]{8,40}$/.test(sid)) {
    fail(name, "collectors sid=" + sid + " site=" + sawSite + " hog=" + sawHog);
    return;
  }
  pass(name);
}

async function checkQuotes() {
  var taken = JSON.stringify({ reference: "BGD-AAAAAA", name: "Ada", notes: "first" });
  var fresh = JSON.stringify({ reference: "BGD-BBBBBB", name: "Ada", notes: "first" });
  var again = JSON.stringify({ reference: "BGD-CCCCCC", name: "Ada", notes: "changed" });
  await quoteFlow("409 then 500 is one failure", [{ status: 409 }, { status: 500 }], [taken, fresh], 0, 1);
  await quoteFlow("409 then 201 is one save", [{ status: 409 }, { status: 201 }], [taken, fresh], 1, 0);
  await quoteFlow("same payload 409 is a save", [{ lost: true }, { status: 409 }], [taken, taken], 1, 1);
  await quoteFlow("changed payload 409 is not a save", [{ lost: true }, { status: 409 }], [taken, again], 0, 1);
}

function leaves(page) {
  return named(page, "page_leave").map(function (row) { return row.seconds; });
}

function checkVisible() {
  var page = bootTrack();
  page.setClock(5000);
  page.setVis("hidden");
  page.fire("doc", "visibilitychange");
  page.setClock(25000);
  page.setVis("visible");
  page.fire("doc", "visibilitychange");
  page.setClock(40000);
  page.fire("win", "pagehide");
  var got = leaves(page);
  var engage = named(page, "engage").map(function (row) { return row.seconds; });
  if (got[got.length - 1] !== 20 || got.indexOf(40) !== -1 || got.indexOf(35) !== -1) fail("visible return", "leaves " + got.join(","));
  else if (engage.indexOf(300) !== -1 || engage.indexOf(30) !== -1 || engage.indexOf(15) === -1) fail("visible return", "engage " + engage.join(","));
  else pass("visible return is 20 seconds");

  page = bootTrack();
  page.setClock(5000);
  page.setVis("hidden");
  page.fire("doc", "visibilitychange");
  page.setClock(305000);
  page.fire("win", "pagehide");
  got = leaves(page);
  engage = named(page, "engage").map(function (row) { return row.seconds; });
  if (got.length !== 1 || got[0] !== 5 || engage.length) fail("hidden gap", "leaves " + got.join(",") + " engage " + engage.join(","));
  else pass("hidden time is not engaged time");

  page = bootTrack();
  page.setClock(5000);
  page.fire("win", "pagehide");
  page.setClock(25000);
  page.setVis("visible");
  page.fire("win", "pageshow", { persisted: true });
  page.setClock(40000);
  page.fire("win", "pagehide");
  got = leaves(page);
  if (got[got.length - 1] !== 20) fail("pageshow resume", "leaves " + got.join(","));
  else pass("pageshow resume counts the second look");
}

function clickButton(page) {
  var btn = {
    nodeType: 1,
    tagName: "BUTTON",
    parentElement: page.doc.body,
    id: "",
    getAttribute: function () { return ""; },
    classList: { contains: function () { return false; } },
    closest: function (sel) { return sel.indexOf("button") !== -1 ? btn : null; }
  };
  page.fire("doc", "click", { target: btn });
}

function checkStorage() {
  var page = bootTrack({ throwStorage: true });
  clickButton(page);
  clickButton(page);
  var ids = [];
  page.shipped.forEach(function (row) {
    var id = sidOf(row.body);
    if (id && ids.indexOf(id) === -1) ids.push(id);
  });
  var steps = events(page).map(function (row) { return row.step; });
  if (ids.length !== 1 || !/^[a-z0-9]{8,40}$/.test(ids[0])) fail("memory session", "ids " + ids.join(","));
  else if (steps[0] !== 1 || steps[1] !== 2 || steps[2] !== 3) fail("memory session", "steps " + steps.join(","));
  else if (page.shipped.length < 4) fail("memory session", "shipped " + page.shipped.length);
  else pass("blocked storage keeps one session id");

  var clicks = 0;
  var last = page.ctx.dataLayer[page.ctx.dataLayer.length - 1];
  while (clicks < 520) {
    clickButton(page);
    clicks++;
    last = page.ctx.dataLayer[page.ctx.dataLayer.length - 1];
    if (last && last.step === 0) break;
  }
  var shippedSteps = page.shipped.filter(function (row) { return row.url.indexOf("site_events") !== -1; }).length;
  if (!last || last.step !== 0 || shippedSteps !== 500) fail("step cap", "step " + (last && last.step) + " shipped " + shippedSteps + " clicks " + clicks);
  else pass("step counter stops at 500");
}

function cls() {
  var list = [];
  return {
    contains: function (c) { return list.indexOf(c) !== -1; },
    add: function (c) { if (list.indexOf(c) === -1) list.push(c); },
    remove: function (c) { var i = list.indexOf(c); if (i !== -1) list.splice(i, 1); },
    toggle: function (c, force) {
      if (force === false) { this.remove(c); return false; }
      if (force === true || !this.contains(c)) { this.add(c); return true; }
      this.remove(c); return false;
    }
  };
}

function domNode(tag) {
  var node = {
    tagName: String(tag || "DIV").toUpperCase(),
    nodeType: 1,
    id: "",
    hidden: false,
    disabled: false,
    value: "",
    tabIndex: -1,
    children: [],
    parentElement: null,
    attrs: {},
    classList: null,
    _html: "",
    textContent: "",
    _scrolled: null,
    _focused: false
  };
  node.classList = cls();
  node.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; };
  node.setAttribute = function (k, v) { node.attrs[k] = String(v); if (k === "id") node.id = String(v); if (k === "tabindex") node.tabIndex = +v; };
  node.removeAttribute = function (k) { delete node.attrs[k]; };
  node.hasAttribute = function (k) { return Object.prototype.hasOwnProperty.call(node.attrs, k); };
  node.appendChild = function (child) {
    child.parentElement = node;
    node.children.push(child);
    return child;
  };
  node.querySelector = function (sel) {
    var all = node.querySelectorAll(sel);
    return all[0] || null;
  };
  node.querySelectorAll = function (sel) {
    var out = [];
    var parts = String(sel).split(",");
    function walk(n) {
      var i, p;
      for (i = 0; i < n.children.length; i++) {
        for (p = 0; p < parts.length; p++) if (selMatch(n.children[i], parts[p].trim())) out.push(n.children[i]);
        walk(n.children[i]);
      }
    }
    walk(node);
    return out;
  };
  node.closest = function (sel) {
    var n = node;
    var parts = String(sel).split(",");
    while (n) {
      for (var p = 0; p < parts.length; p++) if (selMatch(n, parts[p].trim())) return n;
      n = n.parentElement;
    }
    return null;
  };
  node.scrollIntoView = function (opts) { node._scrolled = opts || {}; };
  node.focus = function () { node._focused = true; };
  node.offsetWidth = 40;
  node.insertAdjacentElement = function (where, el) {
    var parent = node.parentElement;
    if (!parent) return el;
    var at = parent.children.indexOf(node);
    if (at < 0) at = parent.children.length - 1;
    el.parentElement = parent;
    parent.children.splice(where === "afterend" ? at + 1 : at, 0, el);
    return el;
  };;
  Object.defineProperty(node, "innerHTML", {
    get: function () { return node._html; },
    set: function (html) {
      node._html = String(html);
      node.children = [];
      var m = /id="([^"]+)"/.exec(node._html);
      if (m && node._html.indexOf("<strong") !== -1) {
        var strong = domNode("strong");
        strong.id = m[1];
        strong.attrs.id = m[1];
        var text = /<strong[^>]*>([^<]*)<\/strong>/.exec(node._html);
        strong.textContent = text ? text[1] : "";
        node.appendChild(strong);
      }
      var reBtn = /<button\b[^>]*data-remove="(\d+)"[^>]*>/g, bm;
      while ((bm = reBtn.exec(node._html))) {
        var btn = domNode("button");
        btn.setAttribute("data-remove", bm[1]);
        node.appendChild(btn);
      }
    }
  });
  listen(node);
  return node;
}

function selMatch(el, sel) {
  if (!el || !sel || typeof el.getAttribute !== "function" || !el.tagName) return false;
  if (sel.charAt(0) === "#") return el.id === sel.slice(1);
  if (sel.charAt(0) === ".") return el.classList.contains(sel.slice(1));
  if (sel.charAt(0) === "[") {
    var m = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) return false;
    var v = el.getAttribute(m[1]);
    if (v == null) return false;
    return m[2] == null ? true : v === m[2];
  }
  return el.tagName === sel.toUpperCase();
}

function byId(root, id) {
  if (root.id === id) return root;
  for (var i = 0; i < root.children.length; i++) {
    var found = byId(root.children[i], id);
    if (found) return found;
  }
  return null;
}

async function main() {
  await checkQuotes();
  checkVisible();
  checkStorage();
  if (fails.length) {
    console.log(fails.length + " failed");
    process.exit(1);
  }
  console.log("all clear");
}

main().catch(function (err) {
  console.log("FAIL runner — " + (err && err.stack ? err.stack : err));
  process.exit(1);
});
