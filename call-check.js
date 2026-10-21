/* Run: node call-check.js
   Voice line, quote handoff, and call events. No network and no quote request row. */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = __dirname;
var fails = [];
function fail(name, detail) {
  fails.push(name + (detail ? ": " + detail : ""));
  console.log("FAIL " + name + (detail ? " — " + detail : ""));
}
function pass(name) { console.log("ok   " + name); }

function copyGlobals(ctx) {
  ["JSON", "Math", "Promise", "Error", "parseInt", "parseFloat", "isFinite", "isNaN",
    "Object", "Array", "String", "Number", "RegExp", "Date", "Uint32Array", "Uint8Array",
    "encodeURIComponent", "decodeURIComponent", "AbortController"].forEach(function (k) {
    ctx[k] = global[k];
  });
  ctx.btoa = function (s) { return Buffer.from(s, "binary").toString("base64"); };
  ctx.atob = function (s) { return Buffer.from(s, "base64").toString("binary"); };
}

function el(tag, id) {
  var node = {
    tagName: String(tag || "div").toUpperCase(),
    id: id || "",
    className: "",
    children: [],
    attrs: {},
    _hidden: false,
    _text: "",
    parentElement: null,
    scrollTop: 0,
    setAttribute: function (k, v) { node.attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; },
    appendChild: function (child) { child.parentElement = node; node.children.push(child); return child; },
    get firstChild() { return node.children[0] || null; },
    removeChild: function (child) {
      var i = node.children.indexOf(child);
      if (i !== -1) node.children.splice(i, 1);
    },
    addEventListener: function (type, fn) { (node._ev = node._ev || {})[type] = (node._ev[type] || []).concat(fn); },
    focus: function () { node._focused = true; },
    click: function () { ((node._ev && node._ev.click) || []).forEach(function (fn) { fn({ preventDefault: function () {} }); }); }
  };
  Object.defineProperty(node, "hidden", {
    get: function () { return node._hidden; },
    set: function (v) {
      node._hidden = !!v;
      if (node._watch) node._watch.push(node._hidden);
    }
  });
  Object.defineProperty(node, "textContent", {
    get: function () { return node._text; },
    set: function (v) { node._text = String(v == null ? "" : v); node.children = []; }
  });
  return node;
}

function bootCall(opts) {
  opts = opts || {};
  var calls = [];
  var events = [];
  var spoken = [];
  var timers = [];
  var rand = 3;
  var store = {};
  var nodes = [];
  var ctx = {};
  copyGlobals(ctx);
  ctx.console = console;
  ctx.setTimeout = function (fn) { timers.push(fn); return timers.length; };
  ctx.clearTimeout = function (id) { if (id) timers[id - 1] = null; };
  ctx.crypto = { getRandomValues: function (buf) { var i; for (i = 0; i < buf.length; i++) buf[i] = rand++; return buf; } };
  ctx.navigator = { userAgent: "check" };
  ctx.location = { href: "http://local/index.html" };
  ctx.sessionStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  };
  function chain(value) {
    return {
      then: function (ok) {
        try {
          var next = ok(value);
          if (next && typeof next.then === "function") return next;
          return chain(next);
        } catch (err) {
          return { then: function () { return this; }, catch: function (bad) { bad(err); return chain(); } };
        }
      },
      catch: function () { return chain(value); }
    };
  }
  function pending(signal) {
    var fail = null;
    var failed = false;
    function reject(err) { if (failed) return; failed = true; if (fail) fail(err); }
    if (signal && signal.addEventListener) signal.addEventListener("abort", function () { reject(new Error("aborted")); });
    var p = {
      then: function (_ok, errFn) { if (errFn) fail = errFn; return p; },
      catch: function (errFn) { fail = errFn; return p; }
    };
    return p;
  }
  ctx.fetch = function (url, init) {
    var href = String(url);
    calls.push({ url: href, body: init && init.body ? String(init.body) : "", headers: init && init.headers ? init.headers : {} });
    if (href.indexOf("quote_requests") !== -1) {
      var status = (opts.quotes || [201]).shift();
      if (status == null) status = 201;
      return chain({ ok: status >= 200 && status < 300, status: status });
    }
    if (opts.hangChat) return pending(init && init.signal);
    var status = opts.chatStatus || 200;
    return chain({
      ok: status >= 200 && status < 300,
      status: status,
      json: function () { return { reply: opts.reply || "Yes, we install flagpoles.", source: "faq" }; }
    });
  };
  function Utterance(text) { this.text = text; this.onend = null; this.onstart = null; this.onerror = null; }
  ctx.SpeechSynthesisUtterance = Utterance;
  ctx.speechSynthesis = {
    cancel: function () {},
    speak: function (u) { spoken.push(u.text); if (u.onstart) u.onstart(); if (u.onend) u.onend(); }
  };
  if (opts.voice !== false) {
    function Rec() { this.onend = null; this.onresult = null; this.onerror = null; }
    Rec.prototype.start = function () { this.started = (this.started || 0) + 1; };
    Rec.prototype.stop = function () { if (this.onend) this.onend(); };
    ctx.webkitSpeechRecognition = Rec;
  }
  var body = el("body");
  body.classList = {
    _list: [],
    add: function (c) { if (this._list.indexOf(c) === -1) this._list.push(c); },
    remove: function (c) { var i = this._list.indexOf(c); if (i !== -1) this._list.splice(i, 1); },
    contains: function (c) { return this._list.indexOf(c) !== -1; }
  };
  function add(node) { nodes.push(node); body.appendChild(node); return node; }
  var root = add(el("div", "vline"));
  root.hidden = true;
  add(el("p", "vline-kicker"));
  add(el("p", "vline-status"));
  var rings = add(el("div", "vline-rings"));
  var ringSeen = [];
  rings._watch = ringSeen;
  var captions = add(el("div", "vline-captions"));
  var fallback = add(el("p", "vline-fallback"));
  fallback.hidden = true;
  var typeBtn = add(el("button", "vline-type"));
  typeBtn.hidden = true;
  var muteBtn = add(el("button", "vline-mute"));
  var endBtn = add(el("button", "vline-end"));
  var opener = add(el("button", "open-call"));
  opener.attrs["data-open-call"] = "";
  var chatOpen = add(el("button", "chat-open"));
  var chatOpened = false;
  chatOpen.addEventListener("click", function () { chatOpened = true; });
  var doc = {
    body: body,
    readyState: "complete",
    querySelector: function (sel) { var all = doc.querySelectorAll(sel); return all[0] || null; },
    querySelectorAll: function (sel) {
      if (sel === "[data-open-call]") return nodes.filter(function (n) { return n.attrs && Object.prototype.hasOwnProperty.call(n.attrs, "data-open-call"); });
      if (sel.charAt(0) === "#") {
        var id = sel.slice(1);
        return nodes.filter(function (n) { return n.id === id; });
      }
      return [];
    },
    addEventListener: function (type, fn) { (doc._ev = doc._ev || {})[type] = (doc._ev[type] || []).concat(fn); },
    createElement: function (tag) { var node = el(tag); nodes.push(node); return node; }
  };
  ctx.document = doc;
  ctx.window = ctx;
  ctx.BGD_CALL_EVENT = function (name, props) { events.push({ name: name, props: props }); };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "door-spec.js"), "utf8"), ctx, { filename: "door-spec.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "call-dory.js"), "utf8"), ctx, { filename: "call-dory.js" });
  return {
    ctx: ctx, calls: calls, events: events, spoken: spoken, rings: ringSeen, captions: captions,
    root: root, fallback: fallback, typeBtn: typeBtn, muteBtn: muteBtn, chatOpened: function () { return chatOpened; },
    flush: function () {
      var copy = timers.slice();
      timers.length = 0;
      copy.forEach(function (fn) { if (fn) fn(); });
    },
    fireKey: function (key) { ((doc._ev && doc._ev.keydown) || []).forEach(function (fn) { fn({ key: key }); }); }
  };
}

function chats(page) { return page.calls.filter(function (c) { return c.url.indexOf("/functions/v1/chat") !== -1; }); }
function quotes(page) { return page.calls.filter(function (c) { return c.url.indexOf("quote_requests") !== -1; }); }
function said(page) { return page.captions.children.map(function (n) { return n.textContent; }).join("\n"); }
function eventBlob(page) { return JSON.stringify(page.events); }

function quoteFlow(page, lines) {
  page.ctx.BGD_CALL.open();
  lines.forEach(function (line) { page.ctx.BGD_CALL.hear(line); });
}

function checkVoiceQuote() {
  var page = bootCall({ quotes: [201] });
  quoteFlow(page, ["My name is Ada and the number is 5550100. Do you install flagpoles?"]);
  var chat = chats(page);
  if (chat.length !== 1) { fail("call question", "chat posts " + chat.length); return; }
  var body;
  try { body = JSON.parse(chat[0].body); } catch (e) { fail("call question", "body was not JSON"); return; }
  var blob = chat[0].body;
  if (body.mode !== "call" || body.builder) fail("call question", "mode or builder");
  else if (!/^[A-Za-z0-9_-]{8,64}$/.test(body.sessionId)) fail("call question", "session");
  else if (!body.messages || body.messages[0].role !== "user") fail("call question", "messages");
  else if (/Ada|555/.test(blob)) fail("call question", "name or number reached the chat");
  else if (chat[0].headers.Authorization || chat[0].headers.authorization) fail("call question", "extra auth header");
  else if (quotes(page).length) fail("call question", "a quote was sent early");
  else if (said(page).indexOf("after-hours line") === -1) fail("call question", "greeting missing");
  else if (page.rings.indexOf(false) === -1) fail("call question", "calling rings never showed");
  else pass("a question uses call mode and leaves the name and number out");

  page.ctx.BGD_CALL.hear("yes");
  ["Ada", "5550100", "hollow metal", "36 by 84", "Bowling Green", "within a month"].forEach(function (line) {
    page.ctx.BGD_CALL.hear(line);
  });
  if (quotes(page).length) { fail("readback", "sent before a yes"); return; }
  if (said(page).indexOf("Should I send this quote request?") === -1) { fail("readback", said(page)); return; }
  page.ctx.BGD_CALL.hear("yes");
  var sent = quotes(page);
  if (sent.length !== 1) { fail("quote from call", "posts " + sent.length); return; }
  var row = JSON.parse(sent[0].body);
  var ev = eventBlob(page);
  if (sent[0].headers.Prefer !== "return=minimal") fail("quote from call", "prefer header");
  else if (row.notes.indexOf("Phone (Dory).") !== 0) fail("quote from call", row.notes);
  else if (!row.doors || row.doors[0].type !== "Hollow Metal / Steel" || row.doors[0].type_id !== "hollow") fail("quote from call", "door type");
  else if (row.doors[0].good_to_know[0] !== "Phone (Dory) request.") fail("quote from call", "marker");
  else if (row.name !== "Ada" || String(row.phone).indexOf("555") === -1) fail("quote from call", "contact missing from the quote");
  else if (row.project_location !== "Bowling Green" || row.timeline !== "Within 1 month" || row.doors[0].size !== "36 by 84") fail("quote from call", "job details");
  else if (row.door_count !== 1 || !/^BGD-[A-Z2-9]{6}$/.test(row.reference)) fail("quote from call", "reference");
  else if (/Ada|555/.test(ev)) fail("quote from call", "name or number in an event");
  else if (!page.events.some(function (e) { return e.name === "call_start" && e.props.voice === true; })) fail("quote from call", "call_start");
  else if (!page.events.some(function (e) { return e.name === "quote_from_call" && e.props.kind === "quote"; })) fail("quote from call", "quote_from_call");
  else if (chats(page).length !== 1) fail("quote from call", "intake was sent to chat");
  else if (said(page).indexOf("dash") === -1) fail("quote from call", "reference was not spoken");
  else pass("a confirmed quote uses the existing quote request");
}

function checkDecline() {
  var page = bootCall();
  quoteFlow(page, ["I need a quote", "Ada", "5550100", "hollow metal", "not sure", "Bowling Green", "one to three months", "no"]);
  if (quotes(page).length) fail("decline", "a no still sent the quote");
  else if (said(page).indexOf("What should I change?") === -1) fail("decline", "no change prompt");
  else pass("a no on the readback does not send");
}

function checkUrgentAndPerson() {
  var urgent = bootCall();
  urgent.ctx.BGD_CALL.open();
  urgent.ctx.BGD_CALL.hear("The door is broken");
  if (quotes(urgent).length || said(urgent).indexOf("270-780-3235 now") === -1) fail("urgent", said(urgent));
  else pass("a broken door points to the office number");

  var page = bootCall({ quotes: [201] });
  quoteFlow(page, ["I need to talk to a person", "yes", "Ada", "5550100", "yes"]);
  var sent = quotes(page);
  if (sent.length !== 1) { fail("callback", "posts " + sent.length); return; }
  var row = JSON.parse(sent[0].body);
  if (row.notes.indexOf("Phone (Dory).") !== 0 || row.notes.indexOf("Callback request.") === -1) fail("callback", row.notes);
  else if (row.name !== "Ada" || String(row.phone).indexOf("555") === -1) fail("callback", "contact");
  else if (!page.events.some(function (e) { return e.name === "quote_from_call" && e.props.kind === "callback"; })) fail("callback", "event");
  else if (/Ada|555/.test(eventBlob(page))) fail("callback", "name or number in an event");
  else if (page.spoken.join("\n").indexOf("270-780-3235") === -1) fail("callback", "office number");
  else pass("talk to a person logs a callback request");
}

function checkCollision() {
  var page = bootCall({ quotes: [409, 409] });
  quoteFlow(page, ["I need a quote", "Ada", "5550100", "storefront", "not sure", "Bowling Green", "as soon as possible", "yes"]);
  var sent = quotes(page);
  if (sent.length !== 2) { fail("collision", "posts " + sent.length); return; }
  var first = JSON.parse(sent[0].body);
  var second = JSON.parse(sent[1].body);
  if (first.reference === second.reference) fail("collision", "reference was not replaced");
  else if (!page.events.some(function (e) { return e.name === "quote_from_call"; })) fail("collision", "second collision was not kept");
  else if (said(page).indexOf("is in") === -1) fail("collision", "no confirmation");
  else pass("a taken reference is replaced once and a repeat collision counts as saved");
}

function checkSendFailure() {
  var page = bootCall({ quotes: [500] });
  quoteFlow(page, ["I need a quote", "Ada", "5550100", "barn door", "not sure", "Bowling Green", "planning and bidding", "yes"]);
  if (quotes(page).length !== 1) fail("send failure", "posts");
  else if (page.events.some(function (e) { return e.name === "quote_from_call"; })) fail("send failure", "counted a failed send");
  else if (said(page).indexOf("couldn't send") === -1) fail("send failure", said(page));
  else pass("a failed send stays on the confirmation");
}

function checkFallbackAndLateReply() {
  var quiet = bootCall({ voice: false });
  quiet.ctx.BGD_CALL.open();
  if (!quiet.fallback.hidden && quiet.fallback.textContent.indexOf("Voice isn't available") !== -1 && quiet.typeBtn.hidden === false) {
    quiet.typeBtn.click();
    if (!quiet.chatOpened() || !quiet.root.hidden) fail("fallback", "typed chat did not open");
    else if (!quiet.events.some(function (e) { return e.name === "call_start" && e.props.voice === false; })) fail("fallback", "call_start");
    else pass("a browser without voice opens typed chat");
  } else fail("fallback", quiet.fallback.textContent);

  var page = bootCall({ hangChat: true });
  page.ctx.BGD_CALL.open();
  page.ctx.BGD_CALL.hear("Do you install flagpoles?");
  page.ctx.BGD_CALL.hear("I need a quote");
  var before = said(page);
  page.flush();
  if (said(page) !== before) fail("late reply", "a late answer talked over the quote");
  else if (before.indexOf("What's your name?") === -1) fail("late reply", before);
  else pass("a late answer does not talk over the quote");
}

function checkMuteAndEnd() {
  var page = bootCall();
  page.ctx.BGD_CALL.open();
  page.muteBtn.click();
  if (page.muteBtn.getAttribute("aria-pressed") !== "true") { fail("mute", "not pressed"); return; }
  page.muteBtn.click();
  page.fireKey("Escape");
  if (!page.root.hidden) fail("end", "still open");
  else if (!page.events.some(function (e) { return e.name === "call_end" && typeof e.props.seconds === "number"; })) fail("end", "call_end");
  else pass("mute and end stay on the call screen");
}

function checkSources() {
  var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  var call = fs.readFileSync(path.join(ROOT, "call-dory.js"), "utf8");
  var track = fs.readFileSync(path.join(ROOT, "track.js"), "utf8");
  var sql = fs.readFileSync(path.join(ROOT, "site-events.sql"), "utf8");
  var app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  var visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  var banned = ["twin", "demo", "bake-off", "prototype", "test", "placeholder", "sample", "mock"];
  var hit = banned.filter(function (word) { return new RegExp("\\b" + word.replace("-", "\\-") + "\\b", "i").test(visible); });
  var chatPart = app.slice(app.indexOf("Help chat"));
  var pages = ["index.html", "start.html", "flagpoles.html", "visit-review.html"];
  var cssOk = pages.every(function (name) { return fs.readFileSync(path.join(ROOT, name), "utf8").indexOf("styles.css?v=cc17") !== -1; });
  var trackPages = ["index.html", "start.html", "flagpoles.html", "request.html", "visit-review.html"];
  var trackOk = trackPages.every(function (name) { return fs.readFileSync(path.join(ROOT, name), "utf8").indexOf("track.js?v=tr6") !== -1; });
  if (hit.length) fail("page wording", hit.join(", "));
  else if (visible.indexOf("Talk to Dory by voice") === -1 || visible.indexOf("After hours? Talk to Dory") === -1) fail("page wording", "entry missing");
  else if (html.indexOf("call-dory.js?v=cd1") === -1 || html.indexOf("call-check.js") !== -1) fail("page wording", "script link");
  else if (call.indexOf('mode: "call"') === -1 || call.indexOf("quote_requests") === -1) fail("page wording", "call script");
  else if (/notify-quote|quote_requests/.test(chatPart)) fail("page wording", "typed chat posts quotes");
  else if (app.indexOf("Hi, welcome in. I'm Dory.") === -1) fail("page wording", "greeting changed");
  else if (track.indexOf("call_start") === -1 || sql.split("call_start").length < 3) fail("page wording", "event allow list");
  else if (!cssOk || !trackOk) fail("page wording", "cache string");
  else pass("the page keeps the voice line off the typed chat and off private words");
}

function bootTrack() {
  var shipped = [];
  var store = {};
  var ctx = {};
  copyGlobals(ctx);
  ctx.console = console;
  ctx.setInterval = function () { return 1; };
  ctx.clearInterval = function () {};
  ctx.setTimeout = function () { return 1; };
  ctx.clearTimeout = function () {};
  ctx.navigator = { userAgent: "check" };
  ctx.location = { pathname: "/index.html", href: "http://local/index.html", search: "", hash: "" };
  ctx.sessionStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  };
  ctx.fetch = function (url, init) {
    shipped.push({ url: String(url), body: init && init.body ? String(init.body) : "" });
    var done = { then: function () { return done; }, catch: function () { return done; } };
    return done;
  };
  var doc = {
    body: { nodeType: 1, tagName: "BODY", parentElement: null },
    documentElement: { scrollHeight: 800 },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    addEventListener: function () {},
    visibilityState: "visible"
  };
  ctx.document = doc;
  ctx.window = ctx;
  ctx.scrollY = 0;
  ctx.innerHeight = 800;
  ctx.innerWidth = 1200;
  ctx.addEventListener = function () {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "track.js"), "utf8"), ctx, { filename: "track.js" });
  return { ctx: ctx, shipped: shipped };
}

function checkTrack() {
  var page = bootTrack();
  var before = page.ctx.BGD_EVENTS.length;
  page.ctx.BGD_CALL_EVENT("call_start", { voice: true, name: "Ada", phone: "5550100" });
  page.ctx.BGD_CALL_EVENT("quote_from_call", { kind: "quote", name: "Ada" });
  page.ctx.BGD_CALL_EVENT("quote_from_call", { kind: "secret", phone: "5550100" });
  page.ctx.BGD_CALL_EVENT("call_end", { seconds: 4, phone: "5550100" });
  page.ctx.BGD_CALL_EVENT("quote_submit", { voice: true });
  var rows = page.ctx.BGD_EVENTS.filter(function (row, i) { return i >= before; });
  var blob = page.shipped.map(function (row) { return row.body; }).join("\n");
  var start = rows.filter(function (row) { return row.event === "call_start"; })[0];
  var quote = rows.filter(function (row) { return row.event === "quote_from_call" && row.kind === "quote"; })[0];
  var bare = rows.filter(function (row) { return row.event === "quote_from_call" && row.kind !== "quote"; })[0];
  var end = rows.filter(function (row) { return row.event === "call_end"; })[0];
  if (!start || start.voice !== true || start.name || start.phone) fail("call events", "call_start props");
  else if (!quote || quote.name) fail("call events", "quote kind");
  else if (!bare || bare.kind) fail("call events", "unknown kind kept");
  else if (!end || end.seconds !== 4 || end.phone) fail("call events", "call_end");
  else if (rows.some(function (row) { return row.event === "quote_submit"; })) fail("call events", "other events accepted");
  else if (/Ada|555/.test(blob)) fail("call events", "name or number was shipped");
  else pass("call events keep only voice, seconds, and kind");
}

checkVoiceQuote();
checkDecline();
checkUrgentAndPerson();
checkCollision();
checkSendFailure();
checkFallbackAndLateReply();
checkMuteAndEnd();
checkSources();
checkTrack();

if (fails.length) {
  console.log(fails.length + " failed");
  process.exit(1);
}
console.log("all clear");
