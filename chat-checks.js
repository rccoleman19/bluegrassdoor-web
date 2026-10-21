/* Checks for the public help chat.
   Run: node chat-checks.js
   Covers the opening greeting, reply cleanup, scripted fallback, the 600-character limit,
   the 8-second give-up, and words that must not appear on the page. */
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var { spawn } = require("child_process");

var ROOT = __dirname;
var GREETING = "Hi, welcome in. I'm Dory. I'll try to help with anything I can, not just doors, and we also do flagpoles. What would you like to know?";
var TITLE = "Dory";
var PHONE = "270-780-3235";
var NOTE = "Dory is a virtual assistant for Bluegrass Commercial Door & More.\nPlease don't share private info.\nFor anything urgent, call " + PHONE + ".";
var EMAIL = "sonya@bluegrassdoor.com";
var BANNED = ["twin", "demo", "bake-off", "prototype", "test", "placeholder", "sample", "mock"];
var fails = [];

function fail(name, detail) { fails.push(name + (detail ? ": " + detail : "")); console.log("FAIL " + name + (detail ? " — " + detail : "")); }
function pass(name) { console.log("ok   " + name); }

function read(file) { return fs.readFileSync(path.join(ROOT, file), "utf8"); }

function sourceChecks() {
  var app = read("app.js");
  var html = read("index.html");
  var req = read("request.html");

  if (app.indexOf(GREETING) < 0) fail("greeting copy", "opening line missing from app.js");
  else if (/\u2014|\bAI\b|\bDOORY\b/.test(GREETING) || !/\bDory\b/.test(GREETING)) fail("greeting copy", "greeting should introduce Dory, without DOORY, an em dash, or AI in the name");
  else pass("greeting copy is in the chat opener");

  if (html.indexOf("<strong>" + TITLE + "</strong>") < 0 || html.indexOf('aria-label="' + TITLE + '"') < 0) fail("chat title", "panel title is not Dory");
  else if (html.indexOf("DOORY") >= 0 || /Bluegrass Door Help/i.test(html)) fail("chat title", "old title is still on the page");
  else pass("chat panel title is Dory");

  [html, app, req].forEach(function (src, i) {
    if (src.indexOf("DOORY") >= 0) fail("DOORY leftover", (i === 0 ? "home" : i === 1 ? "script" : "request") + " still says DOORY");
  });
  if (!fails.some(function (f) { return f.indexOf("DOORY leftover") === 0; })) pass("visitor pages do not say DOORY");

  if (app.indexOf("Dory is a virtual assistant for Bluegrass Commercial Door & More.\\nPlease don't share private info.\\nFor anything urgent, call ") < 0) fail("chat note", "new note missing from app.js");
  else if (/not someone in the office|I'm an AI helper|Answers are automated|\u2014/.test(app)) fail("chat note", "old note wording is still in app.js");
  else pass("chat note copy is in the opener");

  if (!/setTimeout\(function \(\) \{ ctl\.abort\(\); \}, 8000\)/.test(app)) fail("8s give-up", "abort timer is not 8000");
  else pass("8-second give-up is still in place");

  if (!/ask\(v\.slice\(0, 600\)\)/.test(app)) fail("600-character limit", "typed questions are not cut at 600");
  else pass("typed questions are still cut at 600 characters");

  if (!/maxlength="600"/.test(html)) fail("input limit", "chat box maxlength is not 600");
  else pass("chat box still limits input to 600 characters");

  ["tidyReply", "LINKISH", "script|style", "bluegrassdoor", "github\\.io", "2707803235"].forEach(function (bit) {
    if (app.indexOf(bit) < 0) fail("cleanup still present", bit);
  });
  if (!fails.some(function (f) { return f.indexOf("cleanup still present") === 0; })) pass("reply cleanup is still in the page script");

  if (!/name="robots" content="noindex,nofollow"/.test(html)) fail("noindex", "homepage");
  else pass("homepage still has noindex");
  if (!/name="robots" content="noindex,nofollow"/.test(req)) fail("noindex", "request page");
  else pass("request page still has noindex");

  [html, req].forEach(function (src, i) {
    var visible = src.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
    BANNED.forEach(function (word) {
      var re = new RegExp("\\b" + word.replace("-", "\\-") + "\\b", "i");
      if (re.test(visible)) fail("banned word on a page", (i ? "request" : "home") + " has " + word);
    });
  });
  if (!fails.some(function (f) { return f.indexOf("banned word") === 0; })) pass("pages do not use the banned words");

  if (/notify-quote|quote_requests/.test(app) && app.indexOf("CHAT_URL") > 0) {
    /* quote saving must still be present and untouched in spirit: the chat block must not post quotes */
  }
  if (/functions\/v1\/notify-quote/.test(app) || /notify-quote/.test(read("app.js").slice(0, read("app.js").indexOf("Help chat")))) {
    /* recorded below */
  }
  var quotePart = app.slice(0, app.indexOf("Help chat"));
  var chatPart = app.slice(app.indexOf("Help chat"));
  if (/notify-quote|quote_requests/.test(chatPart)) fail("quote path", "chat block mentions quote delivery");
  else pass("chat block does not send quote requests");
  if (!/quote_requests/.test(quotePart)) fail("quote path", "quote saving missing above the chat");
  else pass("quote saving is still in the page script");
}

function contentType(file) {
  var ext = path.extname(file);
  return { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" }[ext] || "application/octet-stream";
}

function startServer() {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      var file = path.normalize(path.join(ROOT, urlPath));
      if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, function (err, data) {
        if (err) { res.writeHead(404); res.end("missing"); return; }
        res.writeHead(200, { "Content-Type": contentType(file) });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", function () { resolve(server); });
  });
}

function launchChrome() {
  return new Promise(function (resolve, reject) {
    var chrome = spawn("google-chrome", [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      "--remote-debugging-port=0", "--user-data-dir=/tmp/bgd-chat-chrome", "about:blank"
    ], { stdio: ["ignore", "pipe", "pipe"] });
    var buf = "";
    var done = false;
    function take(chunk) {
      if (done) return;
      buf += chunk.toString();
      var m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) { done = true; resolve({ chrome: chrome, browserWs: m[1] }); }
    }
    chrome.stdout.on("data", take);
    chrome.stderr.on("data", take);
    chrome.on("error", reject);
    setTimeout(function () { if (!done) reject(new Error("chrome did not start: " + buf.slice(-400))); }, 15000);
  });
}

function connect(wsUrl) {
  var ws = new WebSocket(wsUrl);
  var next = 0;
  var pending = new Map();
  var listeners = [];
  ws.addEventListener("message", function (ev) {
    var msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      var p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method) listeners.forEach(function (fn) { fn(msg); });
  });
  return new Promise(function (resolve, reject) {
    ws.addEventListener("open", function () {
      resolve({
        send: function (method, params) {
          var id = ++next;
          return new Promise(function (res, rej) {
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
          });
        },
        on: function (fn) { listeners.push(fn); },
        close: function () { ws.close(); }
      });
    });
    ws.addEventListener("error", function () { reject(new Error("devtools socket failed")); });
  });
}

async function browserChecks(pageUrl) {
  fs.rmSync("/tmp/bgd-chat-chrome", { recursive: true, force: true });
  var launched = await launchChrome();
  var versionUrl = launched.browserWs.replace("ws://", "http://").replace(/\/devtools\/browser\/.*/, "/json/version");
  var version = await fetch(versionUrl).then(function (r) { return r.json(); });
  var browser = await connect(version.webSocketDebuggerUrl);
  var created = await browser.send("Target.createTarget", { url: "about:blank" });
  var targets = await fetch(versionUrl.replace("/json/version", "/json/list")).then(function (r) { return r.json(); });
  var page = targets.find(function (t) { return t.id === created.targetId; });
  var cdp = await connect(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: pageUrl });
  await waitFor(async function () {
    var r = await cdp.send("Runtime.evaluate", { expression: "!!document.querySelector('#chat-open') && !!document.querySelector('#chat-log') && !!window.DoorVisualize", returnByValue: true });
    return r.result && r.result.value;
  }, 15000, "page");

  async function js(expr) {
    var r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result ? r.result.value : undefined;
  }

  await js("(" + installFetch.toString() + ")();");
  await js("(function () { var fab = document.querySelector('#chat-open'); var alt = document.querySelector('[data-open-chat]'); function shown(el) { return !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; } var el = shown(fab) ? fab : (alt || fab); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); })()");
  await sleep(100);
  var opened = await js("var panel = document.querySelector('#chat-panel'); ({ hidden: panel.hidden, greeting: (document.querySelector('#chat-log .msg--bot') || {}).innerText || '', users: document.querySelectorAll('#chat-log .msg--user').length, chips: Array.from(document.querySelectorAll('#chat-chips button')).map(function (b) { return b.textContent; }) })");
  if (opened.hidden) fail("greeting visible", "panel stayed closed");
  else if (opened.users !== 0) fail("greeting visible", "a visitor message appeared before anyone typed");
  else if (opened.greeting !== GREETING) fail("greeting visible", JSON.stringify(opened.greeting));
  else if (/\u2014|\bAI\b|\bDOORY\b/.test(opened.greeting) || !/\bDory\b/.test(opened.greeting)) fail("greeting visible", "greeting should introduce Dory, without DOORY, an em dash, or AI in the name");
  else pass("greeting is visible on open, before anyone types");

  var title = await js("(function () { var panel = document.querySelector('#chat-panel'); var strong = document.querySelector('#chat-panel .chat__head strong'); return { title: (strong || {}).textContent || '', label: panel ? (panel.getAttribute('aria-label') || '') : '', transform: strong ? getComputedStyle(strong).textTransform : '' }; })()");
  if (title.title !== TITLE || title.label !== TITLE) fail("chat title", JSON.stringify(title));
  else if (title.transform === "uppercase" || /DOORY|\u2014|\bAI\b/.test(title.title + " " + title.label)) fail("chat title", "title still says DOORY, or uses an em dash or AI");
  else pass("panel title reads Dory");

  var note = await js("(function () { var n = document.querySelector('#chat-log .chat__note'); return { text: (n || {}).textContent || '', lines: n ? getComputedStyle(n).whiteSpace : '' }; })()");
  if (note.text !== NOTE) fail("chat note", JSON.stringify(note.text));
  else if (note.lines !== "pre-line" && note.lines !== "pre-wrap") fail("chat note", "the two reminders are not on their own lines");
  else if (/automated|\u2014|not someone in the office/.test(note.text)) fail("chat note", "old wording is showing");
  else pass("note under the greeting");

  var shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync("/opt/cursor/artifacts/chat_greeting_open.png", Buffer.from(shot.data, "base64"));

  var chipOk = opened.chips.indexOf("Services") >= 0 && opened.chips.indexOf("Get a quote") >= 0 && opened.chips.indexOf("Contact info") >= 0;
  if (!chipOk) fail("topic buttons", JSON.stringify(opened.chips));
  else pass("topic buttons still sit under the greeting");

  var actionsOnGreeting = await js("var m = document.querySelector('#chat-log .msg--bot'); m ? m.querySelectorAll('.msg__actions a, .msg__actions button').length : -1");
  if (actionsOnGreeting !== 0) fail("opening buttons", "the opening message grew its own buttons (" + actionsOnGreeting + ")");
  else pass("opening message keeps its original shape (no extra buttons on that bubble)");

  await js("window.__chatMode = { kind: 'reply', payload: " + JSON.stringify({
    reply: "<script>alert(1)</script><style>body{color:red}</style>**Hello** from <b>us</b>. See [site](https://evil.example/phish) and https://evil.example/x. Mail bad@example.com or 555-111-2222. Keep https://bluegrassdoor.com/contact and https://rccoleman19.github.io/bluegrassdoor-site-a-next/ and 270-780-3235 and sonya@bluegrassdoor.com.",
    actions: [{ type: "builder" }, { type: "call" }]
  }) + " };");
  await ask(js, "Do your frames come with hardware?");
  var cleaned = await js("var m = document.querySelectorAll('#chat-log .msg--bot:not(.msg--typing)'); var el = m[m.length - 1]; ({ text: el.innerText, html: el.innerHTML, scripts: el.querySelectorAll('script, style, img').length })");
  var text = cleaned.text || "";
  if (cleaned.scripts !== 0) fail("html stripping", "a script, style, or image was inserted");
  else if (/[<>]/.test(text) || /evil\.example/i.test(text) || /555/.test(text) || /bad@example/i.test(text)) fail("html stripping", text);
  else if (text.indexOf("Hello") < 0 || text.indexOf("bluegrassdoor.com/contact") < 0 || text.indexOf("rccoleman19.github.io") < 0) fail("html stripping", "own sites were removed: " + text);
  else if (text.indexOf(PHONE) < 0 || text.indexOf(EMAIL) < 0) fail("html stripping", "own phone or email missing: " + text);
  else if (text.indexOf("Build my door") < 0 || text.indexOf("Call " + PHONE) < 0) fail("html stripping", "next-step buttons missing: " + text);
  else pass("replies drop html, scripts, styles, markdown, and outside links");

  await js("window.__chatMode = { kind: 'reply', payload: { reply: '<script>alert(1)</script><style>.x{}</style>', fallback: false } };");
  await ask(js, "how much does a steel door cost");
  var priced = await lastBot(js);
  if (/\$\s?\d|\b\d[\d,]*\s?dollars\b/i.test(priced)) fail("price refusal", priced);
  else if (priced.indexOf("don't give prices") < 0 || priced.indexOf(PHONE) < 0 || priced.indexOf("quote") < 0) fail("price refusal", priced);
  else pass("an empty cleaned reply falls back, and prices are still refused");

  await js("window.__chatMode = { kind: 'fallback' };");
  await ask(js, "What is the capital of France?");
  var off = await lastBot(js);
  if (/paris/i.test(off)) fail("off topic", off);
  else if (off.indexOf("only help") < 0 || off.indexOf(PHONE) < 0 || off.indexOf("build the door") < 0) fail("off topic", off);
  else pass("questions that are not about the company are refused and point to a next step");

  await js("window.__chatMode = { kind: 'fallback' };");
  await ask(js, "which closer should I pick");
  var closer = await lastBot(js);
  if (closer.indexOf("only help") >= 0 || closer.indexOf(PHONE) < 0 || /quote request/i.test(closer) === false) fail("on-topic next step", closer);
  else pass("a door question still gets a next step");

  await js("window.__chatMode = { kind: 'fail' };");
  await ask(js, "where is your shop");
  var down = await lastBot(js);
  if (down.indexOf("930 Gordon Avenue") < 0 || down.indexOf(PHONE) < 0) fail("fallback when the service fails", down);
  else pass("a failed chat service still gets a scripted answer");

  await js("window.__chatMode = { kind: 'capture' };");
  var long = "x".repeat(800);
  await js("var input = document.querySelector('#chat-input'); input.value = " + JSON.stringify(long) + "; document.querySelector('#chat-form').requestSubmit();");
  await waitFor(async function () { return await js("!!window.__chatBody"); }, 4000, "posted question");
  var posted = await js("JSON.parse(window.__chatBody).messages.filter(function (m) { return m.role === 'user'; }).pop().content.length");
  var max = await js("document.querySelector('#chat-input').getAttribute('maxlength')");
  if (posted !== 600) fail("600-character limit", "sent " + posted);
  else if (max !== "600") fail("600-character limit", "maxlength " + max);
  else pass("a longer question is sent as 600 characters");

  await waitFor(async function () { return await js("!document.querySelector('#chat-log .msg--typing')"); }, 4000, "chat idle");
  await sleep(200);
  var before = await js("document.querySelectorAll('#chat-log .msg--bot:not(.msg--typing)').length");
  await js("window.__chatMode = { kind: 'hang' }; var input = document.querySelector('#chat-input'); input.removeAttribute('maxlength'); input.value = 'tell me about your frames please'; document.querySelector('#chat-form').requestSubmit(); 'ok'");
  var gaveUp = false;
  var start = Date.now();
  while (Date.now() - start < 12000) {
    var n = await js("document.querySelectorAll('#chat-log .msg--bot:not(.msg--typing)').length");
    if (n > before) { gaveUp = true; break; }
    await sleep(200);
  }
  var elapsed = Date.now() - start;
  var hung = await lastBot(js);
  if (!gaveUp) fail("8s give-up", "no scripted answer after the service stayed quiet");
  else if (elapsed < 7000) fail("8s give-up", "answered after " + elapsed + "ms");
  else if (hung.indexOf("door specialists") < 0) fail("8s give-up", hung);
  else pass("a quiet service falls back after about 8 seconds");

  var pageText = await js("document.body.innerText");
  var href = await js("location.href");
  BANNED.forEach(function (word) {
    var re = new RegExp("\\b" + word + "\\b", "i");
    if (re.test(pageText)) fail("banned word on screen", word);
    if (re.test(href)) fail("banned word in the url", word);
  });
  if (!fails.some(function (f) { return f.indexOf("banned word on screen") === 0 || f.indexOf("banned word in the url") === 0; })) pass("open page and its address avoid the banned words");

  var robots = await js("document.querySelector('meta[name=robots]').content");
  if (robots.indexOf("noindex") < 0) fail("noindex", robots);
  else pass("noindex is still on the open page");

  cdp.close();
  browser.close();
  launched.chrome.kill();
}

function installFetch() {
  var orig = window.fetch;
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf("/functions/v1/chat") < 0) return orig.apply(this, arguments);
    var mode = window.__chatMode || { kind: "fallback" };
    if (mode.kind === "hang") {
      return new Promise(function (resolve, reject) {
        var signal = opts && opts.signal;
        if (signal) {
          if (signal.aborted) { reject(new Error("aborted")); return; }
          signal.addEventListener("abort", function () { reject(new Error("aborted")); });
        }
      });
    }
    if (mode.kind === "capture") {
      window.__chatBody = opts && opts.body;
      return Promise.resolve(new Response(JSON.stringify({ fallback: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    if (mode.kind === "fail") return Promise.reject(new Error("down"));
    return Promise.resolve(new Response(JSON.stringify(mode.payload), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
}

async function ask(js, text) {
  var before = await js("document.querySelectorAll('#chat-log .msg--bot:not(.msg--typing)').length");
  await js("var input = document.querySelector('#chat-input'); input.value = " + JSON.stringify(text) + "; document.querySelector('#chat-form').requestSubmit(); 'ok'");
  await waitFor(async function () {
    var n = await js("document.querySelectorAll('#chat-log .msg--bot:not(.msg--typing)').length");
    var busyTyping = await js("!!document.querySelector('#chat-log .msg--typing')");
    return n > before && !busyTyping;
  }, 5000, text);
}

async function lastBot(js) {
  return js("var m = document.querySelectorAll('#chat-log .msg--bot:not(.msg--typing)'); m[m.length - 1].innerText");
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitFor(fn, ms, label) {
  var start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return;
    await sleep(80);
  }
  throw new Error("timed out waiting for " + label);
}

(async function () {
  sourceChecks();
  var server = await startServer();
  var port = server.address().port;
  try {
    await browserChecks("http://127.0.0.1:" + port + "/");
  } catch (e) {
    fail("browser checks", e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : String(e));
  } finally {
    server.close();
  }
  if (fails.length) {
    console.log("\n" + fails.length + " check(s) failed");
    process.exit(1);
  }
  console.log("\nAll chat checks passed");
})();
