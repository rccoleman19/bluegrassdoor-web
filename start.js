/* Short quote request and the flagpole form. Saved the same way as the door builder. */
(function () {
  "use strict";
  var PHONE = "270-780-3235";
  var QUOTE_API = { url: "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/quote_requests", key: "sb_publishable_aOUQv3tbsDOP4eTDjbyA6w_RKZBxx8K" };
  var S = window.DoorSpec;
  var $ = function (s, root) { return (root || document).querySelector(s); };

  var year = $("#year"); if (year) year.textContent = String(new Date().getFullYear());
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

  function fieldErr(el, bad) {
    var f = el.closest(".field"); if (f) f.classList.toggle("is-invalid", bad);
    el.setAttribute("aria-invalid", bad ? "true" : "false");
  }
  function reachOk(phoneEl, emailEl, setEl, errEl) {
    var pv = phoneEl.value.trim(), ev = emailEl.value.trim(), msg = "";
    var pOk = !pv || pv.replace(/\D/g, "").length >= 7;
    var eOk = !ev || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(ev);
    if (!pv && !ev) msg = "Please give us a phone number or an email address.";
    else if (!pOk) msg = "Please check the phone number (at least 7 digits).";
    else if (!eOk) msg = "That email address doesn't look quite right.";
    setEl.classList.toggle("is-invalid", !!msg);
    errEl.textContent = msg || "Please give us a phone number or an email address.";
    fieldErr(phoneEl, !!msg && (!pOk || (!pv && !ev)));
    fieldErr(emailEl, !!msg && (!eOk || (!pv && !ev)));
    return !msg;
  }
  function sendErr(id, msg) {
    var box = $(id);
    if (!msg) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = msg; box.hidden = false;
  }
  function postRow(btn, label, row, onOk) {
    if (btn.disabled) return;
    btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = "Sending\u2026";
    var tries = 0;
    function once() {
      var retry = tries > 0; tries++;
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
      fetch(QUOTE_API.url, {
        method: "POST", mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined,
        headers: { "Content-Type": "application/json", apikey: QUOTE_API.key, Prefer: "return=minimal" },
        body: JSON.stringify(row)
      }).then(function (r) {
        clearTimeout(timer);
        if (r.ok || (r.status === 409 && retry)) { onOk(); return; }
        if (r.status === 409) { row.reference = S.newRef(); tries = 0; once(); return; }
        throw new Error("HTTP " + r.status);
      }).catch(function () {
        clearTimeout(timer);
        btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = label;
        sendErr(btn.id === "flag-submit" ? "#flag-send-err" : "#door-send-err",
          "<strong>We couldn't send your quote request just now.</strong> Please try again, or call <a href=\"tel:+12707803235\">" + PHONE + "</a>.");
      });
    }
    once();
  }

  $("#door-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var nameEl = $("#door-name");
    var nameOk = !!nameEl.value.trim();
    fieldErr(nameEl, !nameOk);
    var reach = reachOk($("#door-phone"), $("#door-email"), $("#door-reach"), $("#door-reach-err"));
    if (!nameOk) { nameEl.focus(); return; }
    if (!reach) { $("#door-phone").focus(); return; }
    var contact = S.unpackContact({
      n: nameEl.value, co: $("#door-company").value, p: $("#door-phone").value, e: $("#door-email").value,
      a: $("#door-addr").value, tl: $("#door-when").value, x: $("#door-notes").value
    });
    var ref = S.newRef();
    var page = location.href.split("#")[0];
    var base = page.split("?")[0].replace(/[^/]*$/, "");
    var extra = contact.x ? "\n\n" + contact.x : "";
    var row = {
      reference: ref, name: contact.n, company: contact.co || null, phone: contact.p || null, email: contact.e || null,
      project_location: contact.a || null, timeline: contact.tl || null,
      notes: "Quote request sent without the door builder." + extra,
      doors: [{
        door: 1, location: "", quantity: 1, type: "Quote request", type_id: "quote-request",
        material: "", material_id: "", size: "", size_id: "", custom_size: false,
        width_in: null, height_in: null, width: "", height: "", hardware: [],
        good_to_know: ["Sent without the door builder."]
      }],
      door_count: 1, total_quantity: 1,
      build_link: base + "index.html#builder",
      office_link: page + "#manual",
      user_agent: String(navigator.userAgent || "").slice(0, 400)
    };
    postRow($("#door-submit"), "Send my quote request", row, function () {
      $("#door-ref").textContent = row.reference;
      $("#door-ask").hidden = true;
      var done = $("#door-done"); done.hidden = false; done.focus();
    });
  });

  $("#flagpole-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var nameEl = $("#flag-name");
    var nameOk = !!nameEl.value.trim();
    fieldErr(nameEl, !nameOk);
    var reach = reachOk($("#flag-phone"), $("#flag-email"), $("#flag-reach"), $("#flag-reach-err"));
    if (!nameOk) { nameEl.focus(); return; }
    if (!reach) { $("#flag-phone").focus(); return; }
    var contact = S.unpackContact({
      n: nameEl.value, co: $("#flag-company").value, p: $("#flag-phone").value, e: $("#flag-email").value,
      a: $("#flag-addr").value, tl: $("#flag-when").value, x: $("#flag-notes").value
    });
    var ref = S.newRef();
    var page = location.href.split("#")[0];
    var extra = contact.x ? "\n\n" + contact.x : "";
    var row = {
      reference: ref, name: contact.n, company: contact.co || null, phone: contact.p || null, email: contact.e || null,
      project_location: contact.a || null, timeline: contact.tl || null,
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
    postRow($("#flag-submit"), "Send my flagpole quote", row, function () {
      $("#flag-ref").textContent = row.reference;
      $("#flag-ask").hidden = true;
      var done = $("#flag-done"); done.hidden = false; done.focus();
    });
  });
})();
