/* Renders a door quote request from this page's own link (#b=... or ?b=...).
   Nothing is fetched or stored: the whole request travels inside the URL. */
(function () {
  "use strict";
  var S = window.DoorSpec, DP = window.DoorPreview, root = document.getElementById("rq-root");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function param() {
    var h = (location.hash || "").replace(/^#/, ""), m = /(?:^|&)b=([A-Za-z0-9_\-]+)/.exec(h);
    if (m) return m[1];
    var q = /[?&]b=([A-Za-z0-9_\-]+)/.exec(location.search || "");
    return q ? q[1] : "";
  }
  function telHref(p) { var d = String(p).replace(/[^\d+]/g, ""); if (/^\d{10}$/.test(d)) d = "+1" + d; return /^\+?\d{7,15}$/.test(d) ? "tel:" + d : ""; }
  function when(t) {
    try { return t.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return t.toString(); }
  }
  function drawing(d, i) {
    try { var cfg = DP.buildConfig(S.previewSel(d)); return DP.svgMarkup(cfg, "rq" + i, "Drawing of door " + (i + 1) + ": " + S.typeLabel(d.type) + ", " + S.oneLine(d)); } catch (e) { return ""; }
  }
  function empty() {
    document.title = "Door quote request | Bluegrass Commercial Door & More";
    root.innerHTML = '<section class="rq-empty"><h1>We couldn\u2019t read this request</h1>' +
      "<p>The link may have been cut off when it was copied. Try opening it straight from the email, or build the door again on our website.</p>" +
      '<p class="rq-acts"><a class="rq-btn rq-btn--primary" href="./">Back to our website</a> <a class="rq-btn" href="tel:+12707803235">Call 270-780-3235</a></p></section>';
  }
  function render() {
    var raw = param(), data = raw ? S.decode(raw) : null;
    if (!data || !data.doors.length) return empty();
    var doors = data.doors, c = data.contact, n = doors.length, total = S.totalCount(doors);
    var ref = data.ref, open = "./#build=" + S.encode(S.buildPayload(doors, ref));
    document.title = (ref ? ref + " \u00b7 " : "") + "Door quote request | Bluegrass Commercial Door & More";
    var count = n === 1 ? (total === 1 ? "1 door" : total + " doors, all the same") : total === n ? n + " different doors" : n + " different doors, " + total + " in total";
    var h = [];
    h.push('<section class="rq-head">');
    h.push('<p class="rq-eyebrow">Door quote request</p>');
    h.push("<h1>" + (ref ? '<span class="rq-ref">' + esc(ref) + "</span>" : "Door quote request") + "</h1>");
    h.push('<p class="rq-meta">' + esc(count) + (data.time ? ' <span aria-hidden="true">&middot;</span> <span>Sent ' + esc(when(data.time)) + "</span>" : "") + (c && c.n ? ' <span aria-hidden="true">&middot;</span> <span>From ' + esc(c.n) + (c.co ? ", " + esc(c.co) : "") + "</span>" : "") + "</p>");
    h.push('<div class="rq-acts"><a class="rq-btn rq-btn--primary" id="rq-open" href="' + esc(open) + '">Open this build in the door builder <span aria-hidden="true">&rarr;</span></a>' +
      '<button class="rq-btn" type="button" id="rq-print"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>Print</button></div>');
    h.push("</section>");

    h.push('<div class="rq-grid">');
    if (c && (c.n || c.p || c.e)) {
      var rows = [];
      if (c.n) rows.push(["Name", esc(c.n)]);
      if (c.co) rows.push(["Company", esc(c.co)]);
      if (c.p) { var t = telHref(c.p); rows.push(["Phone", t ? '<a href="' + esc(t) + '">' + esc(c.p) + "</a>" : esc(c.p)]); }
      if (c.e) rows.push(["Email", '<a href="mailto:' + esc(encodeURIComponent(c.e).replace(/%40/g, "@")) + '">' + esc(c.e) + "</a>"]);
      if (c.a) rows.push(["Project", esc(c.a)]);
      if (c.tl) rows.push(["Timeline", esc(c.tl)]);
      h.push('<aside class="rq-card rq-contact" aria-labelledby="rq-contact-h"><h2 id="rq-contact-h">Contact</h2><dl class="rq-dl">' +
        rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>" +
        (c.x ? '<div class="rq-notes"><h3>Notes</h3><p>' + esc(c.x).replace(/\n/g, "<br>") + "</p></div>" : "") + "</aside>");
    }
    h.push('<section class="rq-doors" aria-labelledby="rq-doors-h"><h2 id="rq-doors-h" class="rq-sr">Doors</h2><ol class="rq-list">');
    doors.forEach(function (d, i) {
      var spec = S.rows(d).map(function (r) {
        return '<div class="rq-row' + (r[2] ? " rq-row--notes" : "") + '"><dt>' + esc(r[0]) + "</dt><dd>" + (r[2] ? "<ul>" + r[2].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : esc(r[1])) + "</dd></div>";
      }).join("");
      h.push('<li class="rq-card rq-door">' +
        '<div class="rq-draw">' + drawing(d, i) + "</div>" +
        '<div class="rq-door__body">' +
          '<div class="rq-door__top"><h3><span class="rq-num">Door ' + (i + 1) + " of " + n + "</span>" + esc(S.typeLabel(d.type)) + "</h3>" +
          '<span class="rq-qty">Qty ' + (d.qty || 1) + "</span></div>" +
          '<dl class="rq-spec">' + spec + (d.loc ? '<div class="rq-row"><dt>Location</dt><dd>' + esc(d.loc) + "</dd></div>" : "") + "</dl>" +
        "</div></li>");
    });
    h.push("</ol>");
    if (data.dropped) h.push('<p class="rq-warn">' + data.dropped + " door" + (data.dropped > 1 ? "s" : "") + " in this link couldn\u2019t be read. Please call the customer to confirm.</p>");
    h.push("</section></div>");
    var CC = window.CodeChecks;
    if (CC && data.juris && CC.jurisOf(data.juris)) {
      var res = CC.evaluate(doors, { juris: data.juris, use: data.use || null, place: data.place || "" });
      var note = esc(res.note) + " Location: <strong>" + esc(res.jurisLabel) + "</strong>";
      if (!res.needPlace && !res.unavailable) note += " &middot; Building: <strong>" + esc(CC.useText(res)) + "</strong>";
      var body = "";
      if (res.unavailable || res.needPlace) {
        var why = res.unavailable || "A zip code or the place the door will be installed was not given, so code notes were not added. Call 270-780-3235.";
        body = '<p class="rq-codes__note">' + esc(why).replace(/270-780-3235/g, '<a href="tel:+12707803235">270-780-3235</a>') + "</p>";
      } else if (res.items.length) {
        body = "<ul>" + res.items.map(function (it) {
          var dl = CC.doorsLabel(it, n);
          return '<li data-code="' + esc(it.id) + '">' + (dl ? '<span class="rq-codes__doors">' + esc(dl) + "</span> " : "") + esc(it.text) +
            '<span class="rq-codes__src">Source: ' + it.sources.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.cite) + "</a>"; }).join(" &middot; ") + "</span></li>";
        }).join("") + "</ul>";
      }
      if (body) {
        h.push('<section class="rq-card rq-codes" aria-labelledby="rq-codes-h"><h2 id="rq-codes-h">Local &amp; state code: worth checking</h2>' +
          '<p class="rq-codes__note">' + note + "</p>" + body + "</section>");
      }
    }
    root.innerHTML = h.join("");
    document.getElementById("rq-print").addEventListener("click", function () { window.print(); });
  }
  render();
  window.addEventListener("hashchange", render);
})();
