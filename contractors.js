/* Contractor fast lane: a pasted door schedule -> doors the door builder can open (index.html#build=...), a CSV, and a print sheet. */
(function () {
  "use strict";
  var P = window.BGDPro, S = window.DoorSpec, R = window.BuilderRules, $ = P.$, esc = P.esc;
  var SAMPLE = ["101  (2) 3070 HM door, closer, lever", "102  6070 pair aluminum storefront, panic, closer", "Stair A  3070 90 min fire rated, panic, closer, hinges",
    "104 3070 hollow metal with vision lite, lever, kick plate", "Office 3x7 wood interior lever", "Safe room 36x84 security door deadbolt", "Closet  barn door frosted glass soft close", "Mech room ?? see plans"].join("\n");
  var rows = [], skipped = [];

  function has(t, re) { return re.test(t); }
  function parseLine(line) {
    var t = " " + line.toLowerCase().replace(/[–—]/g, "-") + " ";
    var d = { mark: "", qty: 1, type: "", material: "recommend", size: "measure", cw: "", ch: "", hw: [], raw: line.trim() };
    var m = /\((\d{1,3})\)|\bqty\.?\s*(\d{1,3})\b|\bx\s?(\d{1,3})\b(?!\s*["'x\d])|\b(\d{1,3})\s?(?:ea|each|pcs?)\b|^\s*x\s?(\d{1,3})\b/.exec(t);
    if (m) d.qty = +(m[1] || m[2] || m[3] || m[4] || m[5]) || 1;
    // size
    var pair = has(t, /\bpair\b|\bdouble\b|\bdbl\b/);
    if ((m = /\b([2-8])0?([6-9]|1[0-2])0\b/.exec(t)) && /\b\d{4}\b/.test(m[0])) { // 3070, 3080, 6070
      var w = +m[1] * 12, h = +m[2] * 12;
      if (w >= 60) pair = true;
      d.size = w === 36 && h === 84 ? "single" : w === 36 && h === 96 ? "single8" : w === 72 && h === 84 ? "pair" : "custom";
      if (d.size === "custom") { d.cw = w; d.ch = h; }
    } else if ((m = /\b(\d{1,2})\s*'\s*(?:-?\s*(\d{1,2})\s*"?)?\s*x\s*(\d{1,2})\s*'\s*(?:-?\s*(\d{1,2})\s*"?)?/.exec(t)) || (m = /\b(\d)\s*x\s*(\d)\b(?!\d)/.exec(t))) {
      var W, H;
      if (m.length > 3) { W = +m[1] * 12 + (+m[2] || 0); H = +m[3] * 12 + (+m[4] || 0); } else { W = +m[1] * 12; H = +m[2] * 12; }
      d.size = W === 36 && H === 84 ? "single" : W === 36 && H === 96 ? "single8" : W === 72 && H === 84 ? "pair" : "custom"; if (d.size === "custom") { d.cw = W; d.ch = H; }
    } else if ((m = /\b(\d{2,3})\s*"?\s*x\s*(\d{2,3})\s*"?/.exec(t))) {
      var a = +m[1], b = +m[2];
      d.size = a === 36 && b === 84 ? "single" : a === 36 && b === 96 ? "single8" : a === 72 && b === 84 ? "pair" : "custom"; if (d.size === "custom") { d.cw = a; d.ch = b; }
    }
    if (pair && d.size === "single") d.size = "pair";
    if (d.size === "custom" && (d.cw < 12 || d.cw > 240 || d.ch < 12 || d.ch > 240)) { d.size = "measure"; d.cw = d.ch = ""; }
    // type + material
    if (has(t, /\bbarn\b|\bslid/)) { d.type = "barn"; d.material = has(t, /frost|glass/) ? "frosted" : has(t, /wood|plank|shaker/) ? "woodpanel" : "recommend"; }
    else if (has(t, /fire|rated|\b(20|45|60|90)\s?min|\b[1-3]\s?(hr|hour)\b|label/)) { d.type = "fire"; d.material = has(t, /\bwood\b|\bwd\b/) ? "wood" : has(t, /\bhm\b|hollow|steel|metal/) ? "steel" : "recommend"; }
    else if (has(t, /security|safe ?room|storm shelter|bullet|ballistic/)) { d.type = "security"; d.material = has(t, /glass|lite|vision/) ? "steellite" : has(t, /steel|hm\b|metal/) ? "steel" : "recommend"; }
    else if (has(t, /storefront|alum|\balum\b|entrance|frameless|all-?glass|herculite/)) { d.type = "storefront"; d.material = has(t, /frameless|all-?glass|herculite/) ? "fullglass" : has(t, /alum/) ? "alglass" : "recommend"; }
    else if (has(t, /\bhm\b|hollow|steel|metal/)) { d.type = "hollow"; d.material = has(t, /lite|vision|glass|window/) ? "steellite" : "steel"; }
    else if (has(t, /wood|\bwd\b|interior|exterior|fiberglass|swing|solid core|\bscw\b/)) { d.type = "swing"; d.material = has(t, /fiberglass/) ? "fiberglass" : has(t, /glass|lite/) ? "glasslite" : has(t, /wood|\bwd\b|scw|solid core/) ? "wood" : "recommend"; }
    // hardware
    var std = [["lever", /lever|lockset|passage|privacy lever|storeroom|classroom|office lock/], ["deadbolt", /deadbolt|dead bolt/], ["panic", /panic|exit device|crash ?bar|push ?bar|rim device/],
      ["closer", /closer/], ["keypad", /keypad|card|access|fob|electric strike|mag ?lock/], ["hinges", /hinge|pivot|continuous/], ["kick", /kick|armor plate|push plate|pull plate|stop|silencer/]];
    var barn = [["barntrack", /track/], ["pull", /pull|handle/], ["privacy", /privacy|latch/], ["softclose", /soft.?close/]];
    (d.type === "barn" ? barn : std).forEach(function (h) { if (h[1].test(t)) d.hw.push(h[0]); });
    if (!d.hw.length) d.hw = ["recommend"];
    // mark: a leading token like 101, 101A, Stair A, Office
    var mk = /^\s*([A-Za-z]{0,3}-?\d{1,4}[A-Za-z]?(?=[\s,:-])|[A-Za-z][A-Za-z ]{1,14}?(?=\s{2,}|\s*[-:]|\s+\(?\d))/.exec(line);
    if (mk && !/^\s*\(?\d{4}\b/.test(line) && !/^\s*\(\d/.test(line) && !/^\s*(\d{1,3}\s*(ea|each|pcs?|x)\b|x\s?\d)/i.test(line)) d.mark = mk[1].trim().slice(0, 20);
    return d.type ? d : null;
  }
  function toDoor(r) {
    var o = { t: r.type, m: r.material, s: r.size, h: r.hw.slice(), q: r.qty, l: r.mark };
    if (r.size === "custom") { o.cw = r.cw; o.ch = r.ch; }
    var got = S.decode(S.encode({ v: 1, d: [o] }));
    return got && got.doors[0] ? got.doors[0] : null;
  }
  function read() {
    var lines = $("#fl-text").value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 60);
    rows = []; skipped = [];
    lines.forEach(function (l) { var r = parseLine(l); if (r && toDoor(r)) rows.push(r); else skipped.push(l); });
    render();
    P.track("fastlane_parse", { count: rows.length, result: skipped.length ? "partial" : "all" });
  }
  function opt(list, v) { return list.map(function (x) { var k = Array.isArray(x) ? x[0] : x.v, l = Array.isArray(x) ? x[1] : x.t; return '<option value="' + k + '"' + (k === v ? " selected" : "") + ">" + esc(l) + "</option>"; }).join(""); }
  function render() {
    var out = $("#fl-out"); out.hidden = false;
    var docs = rows.map(toDoor);
    var total = docs.reduce(function (a, d) { return a + (d ? d.qty || 1 : 0); }, 0);
    $("#fl-sum").textContent = rows.length + (rows.length === 1 ? " opening" : " openings") + " · " + total + (total === 1 ? " door" : " doors");
    $("#fl-table tbody").innerHTML = rows.map(function (r, i) {
      var d = docs[i];
      return '<tr data-i="' + i + '"><td><input class="fl-mark" value="' + esc(r.mark) + '" aria-label="Mark" maxlength="20"></td>' +
        '<td><input class="fl-qty" type="number" min="1" max="500" value="' + r.qty + '" aria-label="Quantity"></td>' +
        '<td><select class="fl-type" aria-label="Type">' + opt(S.TYPES, r.type) + "</select></td>" +
        '<td><select class="fl-mat" aria-label="Material">' + opt(S.materialsFor(r.type), r.material) + "</select></td>" +
        '<td><select class="fl-size" aria-label="Size">' + opt(S.SIZES.filter(function (z) { return z[0] !== "custom" || r.size === "custom"; }).map(function (z) { return z[0] === "custom" ? ["custom", r.cw + '" × ' + r.ch + '"'] : z; }), r.size) + "</select></td>" +
        '<td class="fl-hw">' + esc(d ? S.hwTitles(d).join(", ") : "") + '<small>' + esc(r.raw) + "</small></td>" +
        '<td><button type="button" class="fl-del" aria-label="Remove this line">&times;</button></td></tr>';
    }).join("") || '<tr><td colspan="7">No openings read yet.</td></tr>';
    var sk = $("#fl-skipped");
    sk.hidden = !skipped.length;
    sk.innerHTML = skipped.length ? "<strong>We couldn't read " + skipped.length + (skipped.length === 1 ? " line" : " lines") + ".</strong> They'll go to the office as a note so nothing is lost:<ul>" + skipped.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" : "";
    var good = docs.filter(Boolean);
    $("#fl-go").href = "index.html?from=fastlane" + "#build=" + S.encode(S.buildPayload(good));
    $("#fl-go").classList.toggle("is-off", !good.length);
    try { sessionStorage.setItem("bgd-fastlane-skipped", skipped.join("\n").slice(0, 900)); } catch (e) { /* ignore */ }
    sheet(good);
  }
  $("#fl-table").addEventListener("change", function (e) {
    var tr = e.target.closest("tr[data-i]"); if (!tr) return; var r = rows[+tr.getAttribute("data-i")];
    if (e.target.classList.contains("fl-type")) { r.type = e.target.value; r.material = "recommend"; r.hw = r.type === "barn" ? ["recommend"] : r.hw.filter(function (h) { return ["barntrack", "pull", "privacy", "softclose"].indexOf(h) < 0; }); if (!r.hw.length) r.hw = ["recommend"]; }
    if (e.target.classList.contains("fl-mat")) r.material = e.target.value;
    if (e.target.classList.contains("fl-size")) r.size = e.target.value;
    if (e.target.classList.contains("fl-qty")) r.qty = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1));
    if (e.target.classList.contains("fl-mark")) r.mark = e.target.value.slice(0, 20);
    render();
  });
  $("#fl-table").addEventListener("click", function (e) { var b = e.target.closest(".fl-del"); if (!b) return; rows.splice(+b.closest("tr").getAttribute("data-i"), 1); render(); });
  $("#fl-read").addEventListener("click", read);
  $("#fl-sample").addEventListener("click", function () { $("#fl-text").value = SAMPLE; read(); });
  $("#fl-go").addEventListener("click", function (e) { if (this.classList.contains("is-off")) { e.preventDefault(); return; } P.track("fastlane_open", { count: rows.length }); });

  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  $("#fl-csv").addEventListener("click", function () {
    var lines = [["Mark", "Qty", "Type", "Material", "Size", "Width (in)", "Height (in)", "Hardware", "As written"].join(",")];
    rows.forEach(function (r) { var d = toDoor(r); if (!d) return; var z = S.SIZES.filter(function (x) { return x[0] === d.size; })[0];
      lines.push([r.mark, d.qty || 1, S.typeLabel(d.type), S.materialLabel(d.type, d.material), d.size === "custom" ? "Custom" : z ? z[1] : "", d.cw || "", d.ch || "", S.hwTitles(d).join("; "), r.raw].map(csvCell).join(",")); });
    skipped.forEach(function (s) { lines.push(["", "", "Not read", "", "", "", "", "", s].map(csvCell).join(",")); });
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv" })); a.download = "door-schedule-bluegrass-door.csv";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    P.track("fastlane_export", { kind: "csv", count: rows.length });
  });
  function sheet(docs) {
    var today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    $("#fl-sheet").innerHTML = '<div class="ps-head"><img src="images/logo.png" alt="" width="135" height="72"><div><strong>Bluegrass Commercial Door &amp; More</strong><br>930 Gordon Avenue, Bowling Green, KY 42101 · 270-780-3235 · sonya@bluegrassdoor.com</div></div>' +
      "<h2>Door schedule for quote</h2><p>Prepared " + esc(today) + ". For a quote request only. Not an approved submittal; our office confirms code, hardware and sizes with you.</p>" +
      "<table><thead><tr><th>Mark</th><th>Qty</th><th>Type</th><th>Material</th><th>Size</th><th>Hardware</th></tr></thead><tbody>" +
      docs.map(function (d, i) { return "<tr><td>" + esc(d.loc) + "</td><td>" + (d.qty || 1) + "</td><td>" + esc(S.typeLabel(d.type)) + "</td><td>" + esc(S.materialLabel(d.type, d.material)) + "</td><td>" + esc(S.sizeText(d)) + "</td><td>" + esc(S.hwTitles(d).join(", ")) + "</td></tr>"; }).join("") +
      "</tbody></table>" + (skipped.length ? "<p><strong>Lines to review with the office:</strong> " + skipped.map(esc).join(" · ") + "</p>" : "");
  }
  $("#fl-print").addEventListener("click", function () { P.track("fastlane_export", { kind: "print", count: rows.length }); window.print(); });
})();
