/* Flagpole quote: saved to the same office inbox as a door quote, and marked as a flagpole quote. */
(function () {
  "use strict";
  var PHONE = "270-780-3235";
  var QUOTE_API = { url: "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/quote_requests", key: "sb_publishable_aOUQv3tbsDOP4eTDjbyA6w_RKZBxx8K" };
  var $ = function (s) { return document.querySelector(s); };
  var S = window.DoorSpec;

  var year = $("#year"); if (year) year.textContent = new Date().getFullYear();

  var nav = $("#site-nav"), toggle = document.querySelector(".menu-toggle");
  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  }
  if (toggle) toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  if (nav) nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  window.addEventListener("resize", function () { if (window.innerWidth >= 1024) setMenu(false); });

  var form = $("#fp-form"), sending = false, reqRef = "", reqTries = 0;
  function fieldErr(el, bad) {
    var f = el.closest(".field"); if (f) f.classList.toggle("is-invalid", bad);
    el.setAttribute("aria-invalid", bad ? "true" : "false");
  }
  function checkName() {
    var el = $("#fp-name"), bad = !el.value.trim();
    fieldErr(el, bad);
    if (bad) el.setAttribute("aria-describedby", "fp-name-err"); else el.removeAttribute("aria-describedby");
    return !bad;
  }
  function checkReach() {
    var p = $("#fp-phone"), e = $("#fp-email"), pv = p.value.trim(), ev = e.value.trim(), msg = "";
    var pOk = !pv || pv.replace(/\D/g, "").length >= 7, eOk = !ev || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(ev);
    if (!pv && !ev) msg = "Please give us a phone number or an email address.";
    else if (!pOk) msg = "Please check the phone number (at least 7 digits).";
    else if (!eOk) msg = "That email address doesn't look quite right.";
    var set = $("#fp-reach"); set.classList.toggle("is-invalid", !!msg);
    $("#fp-reach-err").textContent = msg || "Please give us a phone number or an email address.";
    fieldErr(p, !!msg && (!pOk || (!pv && !ev)));
    fieldErr(e, !!msg && (!eOk || (!pv && !ev)));
    [p, e].forEach(function (x) { if (msg) x.setAttribute("aria-describedby", "fp-reach-err"); else x.removeAttribute("aria-describedby"); });
    return !msg;
  }
  function sendErr(msg) {
    var box = $("#fp-send-err");
    if (!msg) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = msg; box.hidden = false;
  }
  function flagpoleRow(c) {
    var page = location.href.split("#")[0];
    var extra = c.x ? "\n\n" + c.x : "";
    return {
      reference: reqRef, name: c.n, company: c.co || null, phone: c.p || null, email: c.e || null,
      project_location: c.a || null, timeline: c.tl || null,
      notes: "Flagpole quote." + extra,
      doors: [{
        door: 1, location: "", quantity: 1, type: "Flagpole", type_id: "flagpole",
        material: "", material_id: "", size: "", size_id: "", custom_size: false,
        width_in: null, height_in: null, width: "", height: "", hardware: [],
        good_to_know: ["This is a flagpole quote."]
      }],
      door_count: 1, total_quantity: 1,
      build_link: page, office_link: page,
      user_agent: String(navigator.userAgent || "").slice(0, 400)
    };
  }
  function sent(c) {
    $("#fp-ref").textContent = reqRef;
    $("#fp-ask").hidden = true;
    var done = $("#fp-done"); done.hidden = false; done.focus();
  }
  function sendRequest(c) {
    if (sending) return;
    var btn = $("#fp-submit");
    sending = true; sendErr("");
    btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = "Sending\u2026";
    var retry = reqTries > 0; reqTries++;
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    var done = function () { clearTimeout(timer); sending = false; btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = "Send my flagpole quote"; };
    fetch(QUOTE_API.url, {
      method: "POST", mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined,
      headers: { "Content-Type": "application/json", apikey: QUOTE_API.key, Prefer: "return=minimal" },
      body: JSON.stringify(flagpoleRow(c))
    }).then(function (r) {
      if (r.ok || (r.status === 409 && retry)) { done(); sent(c); return; }
      if (r.status === 409) { done(); reqRef = S.newRef(); reqTries = 0; sendRequest(c); return; }
      throw new Error("HTTP " + r.status);
    }).catch(function () {
      done();
      sendErr("<strong>We couldn't send your flagpole quote just now.</strong> Please check your connection and press <strong>Send my flagpole quote</strong> again. Or call us at <a href=\"tel:+12707803235\">" + PHONE + "</a>.");
    });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var okName = checkName(), okReach = checkReach();
    if (!okName) { $("#fp-name").focus(); return; }
    if (!okReach) { var p = $("#fp-phone"); (p.getAttribute("aria-invalid") === "true" ? p : $("#fp-email")).focus(); return; }
    var c = S.unpackContact({ n: $("#fp-name").value, co: $("#fp-company").value, p: $("#fp-phone").value, e: $("#fp-email").value, a: $("#fp-addr").value, tl: $("#fp-when").value, x: $("#fp-msg").value });
    if (!reqRef) reqRef = S.newRef();
    sendRequest(c);
  });
  $("#fp-name").addEventListener("input", function () { if (this.getAttribute("aria-invalid") === "true") checkName(); });
  ["#fp-phone", "#fp-email"].forEach(function (s) {
    $(s).addEventListener("input", function () { if ($("#fp-reach").classList.contains("is-invalid")) checkReach(); });
  });
})();
