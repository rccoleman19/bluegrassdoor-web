/* Shared by the repair request, the contractor fast lane and "My requests".
   Requests are saved to the same office quote inbox as the door builder (insert only, the site can never read it back).
   "My requests" lives only in this browser (localStorage); nothing about it is sent anywhere. */
(function (root) {
  "use strict";
  var PHONE = "270-780-3235", EMAIL = "sonya@bluegrassdoor.com";
  var API = { base: "https://esrwugfaqlwttxmfkpkx.supabase.co", key: "sb_publishable_aOUQv3tbsDOP4eTDjbyA6w_RKZBxx8K" };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function track(name, props) { try { if (root.BGD_EVENT) root.BGD_EVENT(name, props || {}); } catch (e) { /* ignore */ } }

  // menu + year (same as the other pages)
  var y = $("#year"); if (y) y.textContent = String(new Date().getFullYear());
  var nav = $("#site-nav"), toggle = $(".menu-toggle");
  function setMenu(open) { if (!nav || !toggle) return; nav.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", open ? "true" : "false"); toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu"); document.body.classList.toggle("nav-open", open); }
  if (toggle) toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  if (nav) nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });

  function session() {
    try { var k = sessionStorage.getItem("bgd-chat"); if (!k) { k = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("bgd-chat", k); } return k.slice(0, 48); }
    catch (e) { return session.k || (session.k = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36)); }
  }
  function fieldErr(el, bad) { var f = el.closest(".field"); if (f) f.classList.toggle("is-invalid", bad); el.setAttribute("aria-invalid", bad ? "true" : "false"); }
  function reachOk(p, e, set, err) {
    var pv = p.value.trim(), ev = e.value.trim(), msg = "";
    var pOk = !pv || pv.replace(/\D/g, "").length >= 7, eOk = !ev || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(ev);
    if (!pv && !ev) msg = "Please give us a phone number or an email address.";
    else if (!pOk) msg = "Please check the phone number (at least 7 digits).";
    else if (!eOk) msg = "That email address doesn't look quite right.";
    set.classList.toggle("is-invalid", !!msg); err.textContent = msg || "Please give us a phone number or an email address.";
    fieldErr(p, !!msg && (!pOk || (!pv && !ev))); fieldErr(e, !!msg && (!eOk || (!pv && !ev)));
    return !msg;
  }
  /* save one row to the office quote inbox. onDone(ok) */
  function saveRow(row, onDone) {
    var tries = 0;
    (function once() {
      var retry = tries > 0; tries++;
      var ctl = root.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
      fetch(API.base + "/rest/v1/quote_requests", {
        method: "POST", mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined,
        headers: { "Content-Type": "application/json", apikey: API.key, Prefer: "return=minimal" }, body: JSON.stringify(row)
      }).then(function (r) {
        clearTimeout(timer);
        if (r.ok || (r.status === 409 && retry)) { onDone(true); return; }
        if (r.status === 409) { row.reference = root.DoorSpec.newRef(); tries = 0; once(); return; }
        throw new Error("HTTP " + r.status);
      }).catch(function () { clearTimeout(timer); onDone(false); });
    })();
  }
  /* "My requests": on this device only */
  var KEY = "bgd-my-requests";
  function list() { try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function remember(item) {
    try { var l = list().filter(function (x) { return x.ref !== item.ref; }); l.unshift(item); localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30))); } catch (e) { /* storage blocked: nothing kept */ }
  }
  function forget(ref) { try { localStorage.setItem(KEY, JSON.stringify(list().filter(function (x) { return x.ref !== ref; }))); } catch (e) { /* ignore */ } }

  root.BGDPro = { PHONE: PHONE, EMAIL: EMAIL, API: API, $: $, $$: $$, esc: esc, track: track, session: session, fieldErr: fieldErr, reachOk: reachOk, saveRow: saveRow, myList: list, remember: remember, forget: forget };
})(window);
