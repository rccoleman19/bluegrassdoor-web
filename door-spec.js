/*!
 * Bluegrass Commercial Door & More: door catalog + build spec.
 * One place for the builder's choices (types, materials, sizes, hardware), the plain-English spec of a
 * finished door, the quote email text, and the link format that carries a build:
 *   index.html#build=<base64url JSON>      reopens the builder with the same doors
 *   request.html#b=<base64url JSON>        the quote request as the office sees it (also accepts ?b=)
 * Everything a link shows comes from the link itself. Values are checked against this catalog and the
 * hardware rules (builder-rules.js) on the way in, so a link can only ever open a door the builder allows.
 */
(function (root) {
  "use strict";
  var R = root.BuilderRules;

  var TYPES = [
    { v: "storefront", t: "Storefront / Entrance", s: "Aluminum & glass commercial entry", i: "storefront" },
    { v: "hollow", t: "Hollow Metal / Steel", s: "Back doors, stairwells, utility rooms", i: "steel" },
    { v: "fire", t: "Fire-Rated Door", s: "Code-compliant door & frame", i: "fire" },
    { v: "security", t: "Security / Safe Room", s: "Heavy-duty protection", i: "shield" },
    { v: "swing", t: "Interior / Exterior Swing", s: "Residential or commercial", i: "door" },
    { v: "barn", t: "Sliding Barn Door", s: "Interior sliding on track", i: "barn" }
  ];
  var MATERIALS = {
    storefront: [["alglass", "Aluminum & glass", "Classic storefront framing", "storefront"], ["fullglass", "All-glass entrance", "Frameless look", "glass"]],
    hollow: [["steel", "Hollow metal steel", "Durable, paintable", "steel"], ["steellite", "Steel with vision lite", "Steel door with a glass window", "glass"]],
    fire: [["steel", "Hollow metal steel", "Labeled steel door & frame", "steel"], ["wood", "Wood", "Labeled wood door", "wood"]],
    security: [["steel", "Heavy-gauge steel", "Maximum strength", "steel"], ["steellite", "Steel with security glass", "Visibility with protection", "glass"]],
    swing: [["wood", "Wood", "Paint- or stain-grade", "wood"], ["steel", "Steel", "Tough and low maintenance", "steel"], ["fiberglass", "Fiberglass", "Weather-resistant exterior", "door"], ["glasslite", "Glass panel", "Full or half lite", "glass"]],
    barn: [["woodpanel", "Wood panel", "Shaker or plank style", "wood"], ["frosted", "Frosted glass", "Light through, privacy kept", "glass"]]
  };
  var RECOMMEND_MAT = ["recommend", "Recommend for me", "We'll suggest the right fit", "star"];
  var SIZES = [
    ["single", "Single door, 3' × 7'", "Standard 36\" × 84\" opening", "single"],
    ["single8", "Single door, 3' × 8'", "Taller 36\" × 96\" opening", "single"],
    ["pair", "Pair of doors, 6' × 7'", "Double door, 72\" × 84\"", "pair"],
    ["custom", "Custom size", "Enter width and height", "ruler"],
    ["measure", "Not sure", "Please measure for me", "tape"]
  ];
  var HW_STD = [
    ["Lever lockset", "Keyed or passage lever", "lever"], ["Deadbolt", "Added security", "lock"], ["Panic / exit device", "Push bar for egress", "panic"],
    ["Door closer", "Controlled self-closing", "closer"], ["Keypad / access control", "Code or card entry", "keypad"], ["Hinges / pivots", "Heavy-duty or continuous", "hinge"],
    ["Kick plate & accessories", "Protection plates, stops, seals", "plate"], ["Recommend for me", "We'll spec the hardware", "help"]
  ];
  var HW_BARN = [
    ["Barn track hardware", "Black flat track & rollers", "track"], ["Door pull / handle", "Pulls and flush pulls", "lever"], ["Privacy latch", "Simple lock for bed/bath", "lock"],
    ["Soft-close", "Gentle stop at each end", "closer"], ["Recommend for me", "We'll pick matching hardware", "help"]
  ];
  var TIMELINES = ["As soon as possible", "Within 1 month", "1–3 months", "Planning / bidding"];

  function find(list, v) { for (var i = 0; i < list.length; i++) { var k = Array.isArray(list[i]) ? list[i][0] : list[i].v; if (k === v) return list[i]; } return null; }
  function typeOf(v) { return find(TYPES, v); }
  function materialsFor(type) { return (MATERIALS[type] || []).concat([RECOMMEND_MAT]); }
  function hwListFor(type) { return type === "barn" ? HW_BARN : HW_STD; }
  function typeLabel(v) { var t = typeOf(v); return t ? t.t : ""; }
  function materialLabel(type, v) { var m = find(materialsFor(type), v); return m ? m[1] : ""; }

  /* door = { type, material, size, hardware: [default labels], cw, ch, qty, loc } */
  function sel(d) {
    return { type: d.type, material: d.material, size: d.size, hardware: R ? R.hwKeys(d) : [], customW: d.size === "custom" ? String(d.cw || "") : "", customH: d.size === "custom" ? String(d.ch || "") : "" };
  }
  function hwTitle(d, label) { return R ? R.label(sel(d), R.KEY_OF[label] || label).title : label; }
  function hwTitles(d) { return (d.hardware || []).map(function (h) { return hwTitle(d, h); }); }
  function sizeText(d) {
    if (d.size === "custom") return "Custom: " + (d.cw || "?") + "\" W × " + (d.ch || "?") + "\" H";
    var z = find(SIZES, d.size); return z ? z[1] : "";
  }
  function notes(d) { return R && d.type ? R.notes(sel(d)) : []; }
  /* spec rows: [label, value, notes[]?] (the same labels the builder has always used) */
  function rows(d) {
    var r = [
      ["Door type", typeLabel(d.type)],
      ["Material", materialLabel(d.type, d.material)],
      ["Size", sizeText(d)],
      ["Hardware", d.hardware && d.hardware.length ? hwTitles(d).join(", ") : "None selected"]
    ];
    var n = notes(d); if (n.length) r.push(["Good to know", n.join(" "), n]);
    return r;
  }
  function oneLine(d) { return [materialLabel(d.type, d.material), sizeText(d)].filter(Boolean).join(" · "); }
  function customOk(d) { return !d || d.size !== "custom" || !!(inch(d.cw) && inch(d.ch)); }
  function isComplete(d) { return !!(d && d.type && d.material && d.size && d.hardware && d.hardware.length && customOk(d)); }
  function isValid(d) { return isComplete(d) && (!R || R.evaluate(sel(d)).blocking.length === 0); }
  function totalCount(doors) { return doors.reduce(function (a, d) { return a + (d.qty || 1); }, 0); }

  /* selection for DoorPreview.buildConfig (door-preview.js) */
  function previewSel(d) {
    var labels = hwTitles(d);
    return {
      site: "a",
      type: d.type ? { id: d.type, label: typeLabel(d.type) } : null,
      material: d.material ? { id: d.material, label: materialLabel(d.type, d.material) } : null,
      size: d.size ? { id: d.size, label: sizeText(d), w: d.cw, h: d.ch, qty: 1 } : null,
      hardware: (d.hardware || []).map(function (x, i) { return { id: x, label: labels[i] || x }; })
    };
  }

  /* ---------- links ---------- */
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = String(s || "").replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function cleanText(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max || 80); }
  function inch(v) { var n = Math.round(+v); return isFinite(n) && n >= 12 && n <= 240 ? n : null; }

  function packDoor(d) {
    var o = { t: d.type, m: d.material, s: d.size, h: (d.hardware || []).map(function (l) { return R ? R.KEY_OF[l] || l : l; }) };
    if (d.size === "custom") { o.cw = +d.cw; o.ch = +d.ch; }
    if ((d.qty || 1) > 1) o.q = d.qty;
    if (d.loc) o.l = d.loc;
    return o;
  }
  /* returns a valid door or null */
  function unpackDoor(o) {
    if (!o || typeof o !== "object") return null;
    var type = typeOf(o.t) ? o.t : null; if (!type) return null;
    var material = find(materialsFor(type), o.m) ? o.m : null; if (!material) return null;
    var size = find(SIZES, o.s) ? o.s : null; if (!size) return null;
    var d = { type: type, material: material, size: size, hardware: [], cw: "", ch: "", qty: 1, loc: "" };
    if (size === "custom") { d.cw = inch(o.cw); d.ch = inch(o.ch); if (!d.cw || !d.ch) return null; d.cw = String(d.cw); d.ch = String(d.ch); }
    var allowed = hwListFor(type).map(function (h) { return h[0]; });
    (Array.isArray(o.h) ? o.h : []).forEach(function (k) {
      var label = R ? R.HW[k] : k;
      if (label && allowed.indexOf(label) > -1 && d.hardware.indexOf(label) < 0) d.hardware.push(label);
    });
    if (d.hardware.indexOf("Recommend for me") > -1) d.hardware = ["Recommend for me"];
    if (R) { // bring it back in line with the rules (adds required items), then refuse anything still invalid
      var res = R.normalize(sel(d), { atHardware: true });
      d.hardware = res.sel.hardware.map(function (k) { return R.HW[k] || k; });
    }
    if (!isValid(d)) return null;
    var q = parseInt(o.q, 10); d.qty = isFinite(q) && q >= 1 && q <= 500 ? q : 1;
    d.loc = cleanText(o.l, 60);
    return d;
  }
  function packContact(c) {
    var o = {}; ["n", "co", "p", "e", "a", "tl", "x"].forEach(function (k) { if (c && c[k]) o[k] = c[k]; }); return o;
  }
  function unpackContact(o) {
    o = o && typeof o === "object" ? o : {};
    var c = { n: cleanText(o.n, 80), co: cleanText(o.co, 80), p: cleanText(o.p, 40), e: cleanText(o.e, 120), a: cleanText(o.a, 160), tl: TIMELINES.indexOf(o.tl) > -1 ? o.tl : "", x: String(o.x == null ? "" : o.x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 1000).trim() };
    if (c.e && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(c.e)) c.e = "";
    return c;
  }
  function validRef(r) { return typeof r === "string" && /^BGD-[A-Z2-9]{6}$/.test(r) ? r : ""; }
  function encode(payload) { return b64urlEncode(JSON.stringify(payload)); }
  /* decode any link payload: { ref, time, doors[], contact, dropped } */
  function decode(str) {
    var raw; try { raw = JSON.parse(b64urlDecode(str)); } catch (e) { return null; }
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.d)) return null;
    var doors = [], dropped = 0;
    raw.d.slice(0, 40).forEach(function (o) { var d = unpackDoor(o); if (d) doors.push(d); else dropped++; });
    var t = +raw.ts; var time = isFinite(t) && t > 1.6e9 && t < 4.1e9 ? new Date(t * 1000) : null;
    return { ref: validRef(raw.r), time: time, doors: doors, contact: raw.c ? unpackContact(raw.c) : null, dropped: dropped,
      juris: typeof raw.j === "string" && /^[a-z]{2,8}$/.test(raw.j) ? raw.j : "", use: raw.u === "business" || raw.u === "home" ? raw.u : "",
      place: typeof raw.p === "string" ? cleanText(raw.p, 80) : "" };
  }
  function buildPayload(doors, ref) { var p = { v: 1, d: doors.map(packDoor) }; if (ref) p.r = ref; return p; }
  /* extra: { j: job location id, u: "business" | "home" } for the local & state code suggestions (code-checks.js) */
  function requestPayload(doors, contact, ref, time, extra) {
    var p = buildPayload(doors, ref); p.ts = Math.round((time || new Date()).getTime() / 1000); p.c = packContact(contact);
    if (extra && /^[a-z]{2,8}$/.test(extra.j || "")) p.j = extra.j;
    if (extra && (extra.u === "business" || extra.u === "home")) p.u = extra.u;
    if (extra && typeof extra.p === "string" && extra.p.trim()) p.p = cleanText(extra.p, 80);
    return p;
  }
  function newRef() {
    var A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", out = "", buf = new Uint32Array(6);
    (root.crypto || root.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) out += A[buf[i] % A.length];
    return "BGD-" + out;
  }

  /* ---------- one door as saved with a quote request (the office's copy of the full spec) ---------- */
  var SIZE_IN = { single: [36, 84], single8: [36, 96], pair: [72, 84] };
  function ftIn(n) { if (!n) return ""; var f = Math.floor(n / 12); return f + "' " + (n - f * 12) + '"'; }
  function record(d, i) {
    var wh = d.size === "custom" ? [inch(d.cw), inch(d.ch)] : SIZE_IN[d.size] || [null, null];
    return {
      door: i + 1, location: d.loc || "", quantity: d.qty || 1,
      type: typeLabel(d.type), type_id: d.type, material: materialLabel(d.type, d.material), material_id: d.material,
      size: sizeText(d), size_id: d.size, custom_size: d.size === "custom",
      width_in: wh[0], height_in: wh[1], width: ftIn(wh[0]), height: ftIn(wh[1]),
      hardware: hwTitles(d), good_to_know: notes(d)
    };
  }

  /* ---------- the quote email ---------- */
  function doorHeading(d, i, n) {
    return "DOOR " + (i + 1) + " OF " + n + (d.loc ? ": " + d.loc.toUpperCase() : "") + ((d.qty || 1) > 1 ? " (QUANTITY " + d.qty + ")" : "");
  }
  function doorText(d) {
    var r = rows(d), out = [];
    r.forEach(function (row) {
      if (row[2]) { out.push("Good to know:"); row[2].forEach(function (t) { out.push("- " + t); }); }
      else out.push(row[0] + ": " + row[1]);
    });
    out.push("Quantity: " + (d.qty || 1));
    return out.join("\n");
  }
  function subject(doors, contact, ref) {
    var n = totalCount(doors);
    var what = doors.length === 1 && n === 1 ? typeLabel(doors[0].type) : n + " doors";
    return "Door quote request " + ref + ": " + what + (contact.n ? " (" + contact.n + ")" : "");
  }
  function emailBody(doors, contact, ref, requestUrl, extras) {
    extras = extras || {};
    var n = totalCount(doors), L = [];
    L.push("Door quote request " + ref);
    L.push(doors.length === 1 ? (n === 1 ? "1 door" : n + " doors, all the same") : n === doors.length ? n + " different doors" : doors.length + " different doors, " + n + " in total");
    L.push("");
    L.push("CONTACT");
    L.push("Name: " + contact.n);
    if (contact.co) L.push("Company: " + contact.co);
    if (contact.p) L.push("Phone: " + contact.p);
    if (contact.e) L.push("Email: " + contact.e);
    if (contact.a) L.push("Project address: " + contact.a);
    if (contact.tl) L.push("Timeline: " + contact.tl);
    doors.forEach(function (d, i) { L.push(""); L.push(doorHeading(d, i, doors.length)); L.push(doorText(d)); });
    if (contact.x) { L.push(""); L.push("NOTES"); L.push(contact.x); }
    if (extras.photo) { L.push(""); L.push("PHOTO"); L.push("I'm attaching a photo that shows the door on my building."); }
    L.push("");
    L.push("See this request with drawings of each door:");
    L.push(requestUrl);
    if (extras.buildUrl) { L.push(""); L.push("Open " + (doors.length === 1 ? "this door" : "these doors") + " in the door builder:"); L.push(extras.buildUrl); }
    L.push("");
    L.push("Sent from the door builder on the Bluegrass Commercial Door & More website");
    return L.join("\n");
  }

  root.DoorSpec = {
    TYPES: TYPES, MATERIALS: MATERIALS, SIZES: SIZES, HW_STD: HW_STD, HW_BARN: HW_BARN, TIMELINES: TIMELINES,
    materialsFor: materialsFor, hwListFor: hwListFor, typeLabel: typeLabel, materialLabel: materialLabel, find: find,
    sel: sel, hwTitle: hwTitle, hwTitles: hwTitles, sizeText: sizeText, notes: notes, rows: rows, oneLine: oneLine,
    isComplete: isComplete, isValid: isValid, customOk: customOk, totalCount: totalCount, previewSel: previewSel,
    encode: encode, decode: decode, buildPayload: buildPayload, requestPayload: requestPayload, unpackContact: unpackContact,
    newRef: newRef, record: record, subject: subject, emailBody: emailBody, doorText: doorText, doorHeading: doorHeading, cleanText: cleanText
  };
})(window);
