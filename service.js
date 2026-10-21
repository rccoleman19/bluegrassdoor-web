/* Fix my door: guided repair request with a first look (rules below) and an optional photo first look (door-photo function). */
(function () {
  "use strict";
  var P = window.BGDPro, S = window.DoorSpec, $ = P.$, $$ = P.$$, esc = P.esc;
  var PHOTO_URL = P.API.base + "/functions/v1/door-photo";
  /* what each symptom usually points to (general door knowledge, worded as a first guess, never a promise) */
  var SYMPTOMS = [
    ["latch", "Won't close or latch", ["closer", "strike"], "Often the door closer needs adjusting, or the latch no longer lines up with the strike."],
    ["slam", "Slams shut", ["closer"], "Usually the door closer: its speed needs setting, or it is worn or leaking."],
    ["drag", "Drags or sticks", ["hinges", "frame"], "Often worn or loose hinges letting the door sag, or a frame that has shifted."],
    ["lock", "Won't lock / key trouble", ["lockset", "strike"], "Could be the lock or cylinder itself, or the latch not lining up with the strike."],
    ["panic", "Panic bar / exit device sticks", ["panic"], "The exit device may need adjusting or repair. Exit doors matter for safety, so let us know if it won't open."],
    ["glass", "Broken or cracked glass", ["glass"], "The glass or lite needs replacing. Keep people clear until it's safe."],
    ["gap", "Light or air around the door", ["weatherstrip", "hinges"], "Worn weatherstrip, or the door has sagged out of its frame."],
    ["sag", "Loose or sagging", ["hinges"], "Usually hinges or pivots that are loose or worn."],
    ["access", "Keypad / card reader trouble", ["access_control"], "The keypad or access control hardware needs a look."],
    ["track", "Sliding or barn door off its track", ["track"], "The track or rollers need a look."],
    ["damage", "Dented or damaged door or frame", ["door_slab", "frame"], "The door or frame may need repair or replacement."],
    ["other", "Something else", [], ""]
  ];
  var PART = { closer: "Door closer", hinges: "Hinges / pivots", lockset: "Lock / lockset", panic: "Panic / exit device", strike: "Latch & strike", frame: "Frame", door_slab: "Door itself", glass: "Glass", weatherstrip: "Weatherstrip / seals", threshold: "Threshold", track: "Track & rollers", access_control: "Access control", unknown: "Needs a look" };
  var SAFETY = { secure: "Can't lock up the building", egress: "Exit or fire door not working", glass: "Broken glass", falling: "Door loose or could fall" };
  var ai = null, sent = false, ref = "";

  $("#svc-symptoms").innerHTML = SYMPTOMS.map(function (s) { return '<label class="chip"><input type="checkbox" value="' + s[0] + '"><span>' + esc(s[1]) + "</span></label>"; }).join("");
  $("#svc-type").innerHTML = '<option value="">Not sure</option>' + S.TYPES.map(function (t) { return '<option value="' + t.v + '">' + esc(t.t) + "</option>"; }).join("") + '<option value="garage-other">Other</option>';
  try { var pre = new URLSearchParams(location.search).get("note"); if (pre) $("#svc-notes").value = pre.slice(0, 600); } catch (e) { /* ignore */ }

  function picked() { return $$("#svc-symptoms input:checked").map(function (i) { return i.value; }); }
  function safety() { return $$("#svc-safety input:checked").map(function (i) { return i.value; }); }
  function urgent() { return safety().length > 0 || !!(ai && ai.urgent); }
  function setStep() {
    var n = sent ? 4 : picked().length ? (ai ? 4 : 3) : 1;
    $$(".pro-steps li").forEach(function (li, i) { li.classList.toggle("is-on", i < n); });
  }
  function rulesLook() {
    var p = picked(), parts = [], lines = [];
    SYMPTOMS.forEach(function (s) { if (p.indexOf(s[0]) > -1) { s[2].forEach(function (x) { if (parts.indexOf(x) < 0) parts.push(x); }); if (s[3]) lines.push(s[3]); } });
    return { parts: parts, lines: lines };
  }
  function renderLook() {
    var r = rulesLook(), box = $("#svc-look");
    if (!picked().length) { box.innerHTML = '<p class="look__empty">Pick what the door is doing above and a first look shows here.</p>'; setStep(); return; }
    var parts = r.parts.slice(); if (ai) ai.parts.forEach(function (x) { if (parts.indexOf(x) < 0 && x !== "unknown") parts.push(x); });
    box.innerHTML = '<p class="look__h">Likely worth checking</p>' +
      (parts.length ? '<ul class="look__parts">' + parts.map(function (x) { return "<li>" + esc(PART[x] || x) + "</li>"; }).join("") + "</ul>" : '<p>We\'ll take a look and tell you what we find.</p>') +
      (r.lines.length ? '<ul class="look__why">' + r.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : "") +
      '<p class="look__fine">A first guess to help the office plan the visit, not a diagnosis. Our team confirms on site.</p>';
    $("#svc-urgent").hidden = !urgent();
    setStep();
  }
  $("#svc-symptoms").addEventListener("change", function () { $("#svc-step-1").classList.remove("is-invalid"); renderLook(); P.track("service_step", { step: "symptoms", count: picked().length }); });
  $("#svc-safety").addEventListener("change", function () { var u = urgent(); $("#svc-urgent").hidden = !u; if (u) P.track("service_step", { step: "safety", urgent: true }); });

  /* photo: shrink on this device, then ask door-photo for a first look */
  function shrink(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 1024, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      cb(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }
  function aiBox(html) { $("#svc-ai").innerHTML = html; }
  function noAI(why) {
    $("#svc-has-photo").checked = true;
    aiBox('<p class="snap__note">' + esc(why) + ' We checked "I have a photo" below, so the office will ask you for it.</p>');
    P.track("photo_look", { result: "fallback" });
  }
  $("#svc-photo").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { noAI("That file isn't a photo."); return; }
    $("#svc-photo-out").hidden = false;
    aiBox('<p class="snap__busy"><i></i><i></i><i></i> Taking a first look&hellip;</p>');
    shrink(f, function (data) {
      if (!data) { noAI("We couldn't open that photo."); return; }
      $("#svc-photo-img").src = data;
      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 15000);
      fetch(PHOTO_URL, {
        method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", apikey: P.API.key },
        body: JSON.stringify({ image: data.split(",")[1], mime: "image/jpeg", note: picked().map(function (k) { return SYMPTOMS.filter(function (s) { return s[0] === k; })[0][1]; }).join(", ") + ". " + $("#svc-notes").value.slice(0, 200), sessionId: P.session() })
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        clearTimeout(timer);
        if (!d || !d.look) { noAI("Our photo assistant is busy right now."); return; }
        var L = d.look;
        if (!L.is_door) { aiBox('<p class="snap__note">That photo doesn\'t look like a door to our assistant. Try one that shows the problem up close.</p>'); P.track("photo_look", { result: "not_door" }); return; }
        ai = L; $("#svc-has-photo").checked = true;
        aiBox('<p class="look__h">From your photo <span class="tag">' + esc(L.confidence) + " confidence</span></p>" +
          (L.door_kind ? "<p><strong>Door:</strong> " + esc(L.door_kind) + "</p>" : "") +
          "<p><strong>We see:</strong> " + esc(L.seen) + "</p><p><strong>Likely:</strong> " + esc(L.likely_issue) + "</p>" +
          (L.ask_next ? "<p><strong>Good to tell us:</strong> " + esc(L.ask_next) + "</p>" : "") +
          (L.urgent ? '<p class="snap__urgent">This could be urgent. Please call 270-780-3235.</p>' : ""));
        renderLook(); P.track("photo_look", { result: "ok", urgent: !!L.urgent });
      }).catch(function () { clearTimeout(timer); noAI("Our photo assistant couldn't be reached."); });
    });
  });

  $("#svc-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var p = picked(), name = $("#svc-name");
    var okSym = p.length > 0; $("#svc-step-1").classList.toggle("is-invalid", !okSym);
    var okName = !!name.value.trim(); P.fieldErr(name, !okName);
    var okReach = P.reachOk($("#svc-phone"), $("#svc-email"), $("#svc-reach"), $("#svc-reach-err"));
    if (!okSym) { $("#svc-step-1").scrollIntoView({ block: "center" }); return; }
    if (!okName) { name.focus(); return; }
    if (!okReach) { $("#svc-phone").focus(); return; }
    var labels = SYMPTOMS.filter(function (s) { return p.indexOf(s[0]) > -1; }).map(function (s) { return s[1]; });
    var t = $("#svc-type").value, typeName = t ? (S.typeLabel(t) || "Other") : "Not sure";
    var count = Math.max(1, Math.min(200, parseInt($("#svc-count").value, 10) || 1));
    var look = rulesLook(), u = urgent();
    var notes = ["REPAIR / SERVICE REQUEST" + (u ? " (URGENT: " + safety().map(function (k) { return SAFETY[k]; }).concat(ai && ai.urgent ? ["photo looked unsafe"] : []).join(", ") + ")" : ""),
      "Door: " + typeName + (count > 1 ? " x" + count : ""), "What it's doing: " + labels.join(", "),
      look.parts.length ? "First look (from symptoms): " + look.parts.map(function (x) { return PART[x]; }).join(", ") : ""];
    if (ai) notes.push("Photo first look (" + ai.confidence + "): " + ai.likely_issue + (ai.parts.length ? " Parts: " + ai.parts.map(function (x) { return PART[x] || x; }).join(", ") + "." : ""));
    if ($("#svc-has-photo").checked) notes.push("Photo: I have a photo. Please ask me for it.");
    var extra = $("#svc-notes").value.trim(); if (extra) notes.push("", extra);
    ref = ref || S.newRef();
    var row = {
      reference: ref, name: name.value.trim().slice(0, 80), company: $("#svc-company").value.trim() || null,
      phone: $("#svc-phone").value.trim() || null, email: $("#svc-email").value.trim() || null,
      project_location: $("#svc-addr").value.trim() || null, timeline: u ? "As soon as possible" : null,
      notes: notes.filter(function (x, i) { return x !== "" || i > 0; }).join("\n").slice(0, 2000),
      doors: [{ door: 1, location: "", quantity: count, type: "Repair / service request", type_id: "service-request", material: "", material_id: "", size: "", size_id: "", custom_size: false, width_in: null, height_in: null, width: "", height: "", hardware: [], good_to_know: ["Repair request: " + labels.join(", ")] }],
      door_count: 1, total_quantity: count, build_link: location.href.split("?")[0].split("#")[0], office_link: location.href.split("?")[0].split("#")[0],
      user_agent: String(navigator.userAgent || "").slice(0, 400)
    };
    var btn = $("#svc-submit"); btn.disabled = true; btn.textContent = "Sending\u2026"; $("#svc-send-err").hidden = true;
    P.saveRow(row, function (ok) {
      btn.disabled = false; btn.textContent = "Send my repair request";
      if (!ok) { var b = $("#svc-send-err"); b.innerHTML = "<strong>We couldn't send your request just now.</strong> Please try again, or call <a href=\"tel:+12707803235\">270-780-3235</a>."; b.hidden = false; return; }
      sent = true; ref = row.reference;
      P.remember({ ref: ref, kind: "Repair request", when: new Date().toISOString(), summary: typeName + ": " + labels.join(", "), urgent: u, link: "service.html" });
      $("#svc-ref").textContent = ref; $("#svc-form").hidden = true; var d = $("#svc-done"); d.hidden = false; d.focus();
      P.track("service_step", { step: "sent", urgent: u });
    });
  });
  renderLook();
})();
