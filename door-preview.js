/*!
 * Bluegrass Commercial Door & More: live door preview.
 * Draws a simple front elevation (inline SVG) of the opening as the customer
 * makes choices in the door builder. No dependencies.
 *
 * Data flow:  builder state --(site adapter)--> selection --buildConfig()--> config --render()--> SVG
 * The config object is renderer-neutral (inches, keys, colors) so a future 3D
 * renderer can consume exactly the same object (see DoorPreview.buildConfig).
 */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* 1. Normalisation tables (builder labels / ids -> canonical keys)    */
  /* ------------------------------------------------------------------ */
  var TYPE_KEYS = {
    // Site A ids
    storefront: "storefront", hollow: "hollow-metal", fire: "fire-rated", security: "security", swing: "swing", barn: "barn",
    // Site C ids
    "hollow-metal": "hollow-metal", "fire-rated": "fire-rated", "interior-swing": "interior-swing", "sliding-barn": "barn", flagpole: "flagpole",
    // Site B values (lower-cased)
    "storefront / entrance": "storefront", "hollow metal / steel": "hollow-metal", "fire-rated": "fire-rated",
    "security / safe room": "security", "interior swing": "interior-swing", "sliding barn": "barn"
  };
  var MATERIAL_KEYS = {
    alglass: "alglass", fullglass: "fullglass", steel: "steel", steellite: "steellite", wood: "wood", fiberglass: "fiberglass",
    glasslite: "glasslite", woodpanel: "woodpanel", frosted: "frosted", recommend: "unsure",
    "alum-glass": "alglass", "hollow-steel": "steel", glass: "glass", "material-unsure": "unsure",
    "aluminum and glass": "alglass", "hollow metal steel": "steel", "not sure": "unsure"
  };
  var HW_KEYS = {
    "lever lockset": "lever", "deadbolt": "deadbolt", "panic / exit device": "panic", "door closer": "closer", "closer": "closer",
    "keypad / access control": "keypad", "hinges / pivots": "hinges", "kick plate & accessories": "kickplate",
    "barn track hardware": "barnTrack", "barn track": "barnTrack", "door pull / handle": "pull", "privacy latch": "privacyLatch",
    "soft-close": "softClose", "recommend for me": "recommend", "not sure": "recommend", "not sure yet": "recommend",
    lever: "lever", panic: "panic", keypad: "keypad", hinges: "hinges", "barn-track": "barnTrack", "hw-unsure": "recommend"
  };
  function key(map, v) { if (v == null || v === "") return null; var s = String(v); return map[s] || map[s.toLowerCase()] || null; }

  /* Finishes (hex colours are product colours, not site colours) */
  var FINISH = {
    "aluminum-glass":       { name: "Clear anodized aluminum", face: "#b7bec7", edge: "#8a939e", glass: "#cfe4f2" },
    "frameless-glass":      { name: "Tempered glass",          face: "#d7eaf5", edge: "#9fb9c9", glass: "#d7eaf5" },
    "steel":                { name: "Painted steel",           face: "#9aa4b1", edge: "#6f7986" },
    "steel-vision":         { name: "Painted steel",           face: "#9aa4b1", edge: "#6f7986", glass: "#cfe4f2" },
    "steel-heavy":          { name: "Charcoal heavy-gauge steel", face: "#40464f", edge: "#262a30" },
    "steel-security-glass": { name: "Charcoal steel",          face: "#4a515b", edge: "#2b3037", glass: "#bcd3e2" },
    "wood":                 { name: "Stained wood",            face: "#b07a46", edge: "#7d532c" },
    "fiberglass":           { name: "Fiberglass",              face: "#ece4d3", edge: "#b9ad95" },
    "glass-panel":          { name: "Painted frame, glass",    face: "#f2f2ef", edge: "#b7b9bd", glass: "#cfe4f2" },
    "wood-panel":           { name: "Wood shaker panel",       face: "#c49365", edge: "#8d623a" },
    "frosted-glass":        { name: "White frame, frosted glass", face: "#f6f6f4", edge: "#bfc3c8", glass: "#e6ecf1" },
    "unspecified":          { name: "To be recommended",       face: "#e3e7ed", edge: "#a9b2bf", glass: "#e9f1f7" },
    "pole-aluminum":        { name: "Satin aluminum",          face: "#c9cfd6", edge: "#8c96a1" },
    "pole-steel":           { name: "Painted steel",           face: "#a3acb8", edge: "#6f7986" },
    "pole-wood":            { name: "Wood",                    face: "#b07a46", edge: "#7d532c" },
    "pole-fiberglass":      { name: "White fiberglass",        face: "#f3f3f1", edge: "#b9bdc3" }
  };

  var TYPE_DEFAULT = {
    storefront: "aluminum-glass", "hollow-metal": "steel", "fire-rated": "steel", security: "steel-heavy",
    swing: "wood", "interior-swing": "wood", barn: "wood-panel", flagpole: "pole-aluminum"
  };

  function resolveMaterial(type, m) {
    if (type === "flagpole") {
      return { steel: "pole-steel", wood: "pole-wood", fiberglass: "pole-fiberglass" }[m] || "pole-aluminum";
    }
    switch (m) {
      case "alglass": return "aluminum-glass";
      case "fullglass": return "frameless-glass";
      case "glass": return type === "storefront" ? "frameless-glass" : type === "security" ? "steel-security-glass" : "glass-panel";
      case "steel": return type === "security" ? "steel-heavy" : "steel";
      case "steellite": return type === "security" ? "steel-security-glass" : "steel-vision";
      case "wood": return type === "barn" ? "wood-panel" : "wood";
      case "woodpanel": return "wood-panel";
      case "frosted": return "frosted-glass";
      case "glasslite": return "glass-panel";
      case "fiberglass": return "fiberglass";
      default: return TYPE_DEFAULT[type] || "wood";
    }
  }

  /* Length parser for free-text sizes: 36, 36", 3', 3 ft, 6' 2", 7 feet 0 inches. Returns inches or null. */
  function parseLength(txt) {
    if (txt == null) return null;
    var s = String(txt).toLowerCase().replace(/,/g, ".").replace(/[′’]/g, "'").replace(/[″”]/g, '"').trim();
    if (!s) return null;
    var ft = /(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)/.exec(s), inch = /(\d+(?:\.\d+)?)\s*(?:"|in\b|inch|inches)/.exec(s);
    var v = null;
    if (ft || inch) {
      v = (ft ? parseFloat(ft[1]) * 12 : 0) + (inch ? parseFloat(inch[1]) : 0);
      if (ft && !inch) { var rest = /(?:'|ft|feet|foot)\s*(\d+(?:\.\d+)?)\s*$/.exec(s); if (rest) v += parseFloat(rest[1]); }
    } else {
      var n = /(\d+(?:\.\d+)?)/.exec(s); if (!n) return null;
      v = parseFloat(n[1]); if (v <= 12) v *= 12; // bare small numbers are feet
    }
    if (!isFinite(v) || v <= 0) return null;
    return Math.max(12, Math.min(240, Math.round(v)));
  }

  /* The custom width/height boxes are in inches: a plain number there is inches (12 is 12", not 12'); anything else goes through parseLength. */
  function inchField(v) { var t = String(v == null ? "" : v).trim(); return /^\d+(?:\.\d+)?$/.test(t) ? Math.max(12, Math.min(240, Math.round(+t))) : parseLength(t); }
  function clean(label) { return String(label || "").replace(/\s+/g, " ").trim(); }

  /* ------------------------------------------------------------------ */
  /* 2. Config builder: selection -> renderer-neutral config             */
  /* ------------------------------------------------------------------ */
  /* selection = { site, step, type:{id,label}, material:{id,label}, size:{id,label,w,h,qty}, hardware:[{id,label}] } */
  function buildConfig(sel, opts) {
    opts = opts || {};
    sel = sel || {};
    var typeKey = sel.type && key(TYPE_KEYS, sel.type.id);
    var matRaw = sel.material && key(MATERIAL_KEYS, sel.material.id);
    var cfg = {
      version: 1,
      site: sel.site || "",
      stage: 0,
      empty: !typeKey,
      product: typeKey === "flagpole" ? "flagpole" : "door",
      type: typeKey ? { key: typeKey, label: clean(sel.type.label) } : null,
      setting: null,
      material: null,
      opening: { widthIn: 36, heightIn: 84, leaves: 1, sizeChosen: false, sizeKnown: false, label: "", qty: 1 },
      operation: typeKey === "flagpole" ? "pole" : "swing",
      glazing: "none",
      hardware: { items: [], noted: [], has: {} },
      photo: null,
      summary: ""
    };
    if (!typeKey) { cfg.summary = ""; return cfg; }
    cfg.stage = 1;

    /* material */
    var mKey = resolveMaterial(typeKey, matRaw);
    cfg.material = {
      key: mKey,
      raw: matRaw,
      chosen: !!matRaw,
      specified: !!matRaw && matRaw !== "unsure",
      label: matRaw ? clean(sel.material.label) : "",
      finish: FINISH[(matRaw && matRaw !== "unsure") ? mKey : "unspecified"],
      look: mKey
    };
    if (matRaw) cfg.stage = 2;
    cfg.glazing = { "aluminum-glass": "framed", "frameless-glass": "frameless", "steel-vision": "vision", "steel-security-glass": "security",
      "glass-panel": "full", "frosted-glass": "frosted" }[mKey] || "none";

    /* setting (drawn as wall context only) */
    cfg.setting = { storefront: "exterior", "hollow-metal": "exterior", security: "exterior", "fire-rated": "interior",
      "interior-swing": "interior", barn: "interior", flagpole: "outdoor" }[typeKey] ||
      (matRaw === "fiberglass" ? "exterior" : "interior-or-exterior");

    /* size */
    var z = sel.size || null, o = cfg.opening;
    if (z && z.id) {
      o.sizeChosen = true; cfg.stage = Math.max(cfg.stage, 3);
      o.label = clean(z.label);
      var id = String(z.id).toLowerCase();
      if (/^single8$/.test(id)) { o.widthIn = 36; o.heightIn = 96; o.sizeKnown = true; }
      else if (/^pair|pair\b/.test(id)) { o.widthIn = 72; o.heightIn = 84; o.leaves = 2; o.sizeKnown = true; }
      else if (/^single/.test(id)) { o.widthIn = 36; o.heightIn = 84; o.sizeKnown = true; }
      else if (/custom/.test(id)) {
        var w = inchField(z.w), h = inchField(z.h);
        if (w) o.widthIn = w; if (h) o.heightIn = h;
        o.sizeKnown = !!(w && h);
        o.leaves = o.widthIn > 54 ? 2 : 1;
        o.qty = Math.max(1, parseInt(z.qty, 10) || 1);
      } else { o.sizeKnown = false; } // not sure / measure
    }

    /* hardware */
    var hw = (sel.hardware || []).map(function (h) { return { key: key(HW_KEYS, h.id) || key(HW_KEYS, h.label), label: clean(h.label) }; })
      .filter(function (h) { return h.key; });
    if (hw.length) cfg.stage = 4;
    var has = {}; hw.forEach(function (h) { has[h.key] = true; });
    if (typeKey === "barn" || has.barnTrack) cfg.operation = typeKey === "flagpole" ? "pole" : "slide";
    hw.forEach(function (h) {
      var drawn = true, why = "";
      if (cfg.operation === "pole" && h.key !== "recommend") { drawn = false; why = "not part of a flagpole drawing"; }
      else if (cfg.operation === "slide" && h.key === "hinges") { drawn = false; why = "a sliding door hangs from its track"; }
      var item = { key: h.key, label: h.label, drawn: drawn };
      cfg.hardware.items.push(item);
      if (!drawn) cfg.hardware.noted.push({ key: h.key, label: h.label, reason: why });
    });
    cfg.hardware.has = has;

    /* photo: only where a real bluegrassdoor.com photo of an installed door genuinely matches (no stock images) */
    var P = opts.photos || {};
    if (typeKey === "barn" && o.leaves === 1 && (matRaw === "woodpanel" || matRaw === "wood") && P.barnWood) cfg.photo = P.barnWood;
    else if (typeKey === "barn" && o.leaves === 1 && matRaw === "frosted" && P.barnFrosted) cfg.photo = P.barnFrosted;
    else if (typeKey === "security" && mKey === "steel-heavy" && cfg.material.specified && o.leaves === 1 && P.securitySteel) cfg.photo = P.securitySteel;

    cfg.summary = summaryText(cfg);
    return cfg;
  }

  function summaryText(cfg) {
    if (cfg.empty) return "";
    var parts = [cfg.type.label];
    if (cfg.material && cfg.material.chosen) parts.push(cfg.material.label);
    if (cfg.opening.sizeChosen) parts.push(cfg.opening.label + (cfg.opening.qty > 1 ? " (qty " + cfg.opening.qty + ")" : ""));
    var s = parts.join(", ");
    if (cfg.hardware.items.length) s += ". Hardware: " + cfg.hardware.items.map(function (h) { return h.label; }).join(", ");
    return s + ".";
  }

  /* ------------------------------------------------------------------ */
  /* 3. SVG renderer (units = inches, y grows downward, floor at y = H)  */
  /* ------------------------------------------------------------------ */
  var METAL = { fill: "#c7ccd3", stroke: "#646c78" }, BLACK = { fill: "#26292e", stroke: "#111317" };
  function r1(n) { return Math.round(n * 10) / 10; }
  function rect(x, y, w, h, fill, stroke, sw, extra) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(Math.max(0, w)) + '" height="' + r1(Math.max(0, h)) + '" fill="' + fill + '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 0.35) + '"' : ' stroke="none"') + (extra || "") + "/>";
  }
  function line(x1, y1, x2, y2, stroke, sw, extra) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" stroke="' + stroke + '" stroke-width="' + (sw || 0.35) + '"' + (extra || "") + "/>";
  }
  function circ(cx, cy, r, fill, stroke, sw) { return '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(r) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 0.35) + '"' : ' stroke="none"') + "/>"; }
  function grp(k, body, dim) { return '<g class="dp-part' + (dim ? " dp-dim" : "") + '" data-k="' + k + '">' + body + "</g>"; }

  function render(cfg) {
    if (cfg.empty) return renderEmpty();
    if (cfg.product === "flagpole") return renderFlagpole(cfg);
    return renderDoor(cfg);
  }

  function renderEmpty() {
    var W = 36, H = 84;
    var s = rect(-22, -16, W + 44, H + 16, "none") +
      line(-22, H, W + 22, H, "#b6bfcc", 0.5) +
      rect(-2, -2, W + 4, H + 2, "none", "#aab4c2", 0.6, ' stroke-dasharray="2 1.5"') +
      rect(0.5, 0.5, W - 1, H - 1, "none", "#c3cad5", 0.5, ' stroke-dasharray="2 1.5"') +
      circ(W - 3, 38, 1.1, "none", "#c3cad5", 0.5);
    return { viewBox: [-22, -16, W + 44, H + 30], body: grp("outline", s) };
  }

  function wallContext(cfg, x0, x1, top, H) {
    var s = "", ext = cfg.setting === "exterior";
    if (ext) {
      s += rect(x0, top, x1 - x0, H - top, "#efe7e1");
      for (var y = H - 2.6, row = 0; y > top; y -= 2.6, row++) {
        s += line(x0, y, x1, y, "#e2d4ca", 0.25);
        for (var x = x0 + (row % 2 ? 4 : 0); x < x1; x += 8) s += line(x, y, x, y + 2.6, "#e2d4ca", 0.25);
      }
      s += rect(x0, H, x1 - x0, 4, "#d9dce1") + line(x0, H, x1, H, "#9aa1ab", 0.4);
    } else {
      s += rect(x0, top, x1 - x0, H - top, cfg.setting === "interior" ? "#f4f1ec" : "#f1f3f6");
      s += rect(x0, H - 4, x1 - x0, 4, "#e4e0d9") + line(x0, H - 4, x1, H - 4, "#cfc9bf", 0.25);
      s += rect(x0, H, x1 - x0, 4, "#e8e3dc") + line(x0, H, x1, H, "#a8a196", 0.4);
    }
    return s;
  }

  function renderDoor(cfg, bare) {
    var o = cfg.opening, W = o.widthIn, H = o.heightIn, n = o.leaves;
    var slide = cfg.operation === "slide", has = cfg.hardware.has, look = cfg.material.look, fin = cfg.material.finish;
    var F = look === "frameless-glass" ? 1.2 : look === "aluminum-glass" ? 1.75 : 2;
    var ml = 10, mr = 10 + (has.keypad ? 8 : 0), mt = 9;
    if (slide) { if (n === 1) { ml = 10 + (has.keypad ? 2 : 0); mr = W + 9; } else { ml = W / 2 + 9 + (has.keypad ? 4 : 0); mr = W / 2 + 9; } mt = 13; }
    var x0 = -ml, x1 = W + mr, top = -mt, bottom = H + (o.sizeChosen ? 14 : 6), left = x0;
    var out = [];
    if (!bare) out.push(grp("wall", wallContext(cfg, x0, x1, top, H)));

    /* frame / casing */
    var frameCol = look === "aluminum-glass" || look === "frameless-glass" ? FINISH["aluminum-glass"].face : cfg.setting === "exterior" ? "#8c96a3" : "#f7f5f0";
    var frameStroke = cfg.setting === "exterior" || look === "aluminum-glass" ? "#5f6875" : "#b9b2a6";
    var fr = rect(-F, -F, W + 2 * F, H + F, frameCol, frameStroke, 0.4) + rect(0, 0, W, H, "#2d333c", null);
    if (look === "frameless-glass") fr = rect(-F, -F, W + 2 * F, F, frameCol, frameStroke, 0.4) + rect(0, 0, W, H, "#3a4350", null);
    out.push(grp("frame", fr));

    /* leaves */
    var leaves = [];
    for (var i = 0; i < n; i++) {
      var L = n === 1 ? { x: 0.15, y: 0.15, w: W - 0.3, h: H - 0.65, idx: 0 } : { x: i * W / 2 + (i ? 0.1 : 0.15), y: 0.15, w: W / 2 - 0.25, h: H - 0.65, idx: i };
      if (slide) {
        L = n === 1 ? { x: -2, y: -1.5, w: W + 4, h: H + 1, idx: 0 } : { x: i === 0 ? -2 : W / 2 + 0.1, y: -1.5, w: W / 2 + 1.9, h: H + 1, idx: i };
      }
      // hinge side: single = left; pair = outer edges. Latch side toward the meeting stile.
      L.hingeLeft = n === 1 ? true : i === 0;
      L.active = n === 1 || i === 1;
      leaves.push(L);
      out.push(grp("leaf" + i, drawLeaf(L, look, fin, cfg)));
    }
    if (n === 2 && !slide && look !== "frameless-glass") out.push(grp("astragal", rect(W / 2 - 0.35, 0.3, 0.7, H - 0.9, fin.edge, null)));

    /* hardware */
    var hw = [];
    var implied = function (k) { return !has[k] && cfg.stage >= 1; };
    // hinges / pivots (drawn lightly until chosen)
    if (!slide) leaves.forEach(function (L) { hw.push(grp("hinges", drawHinges(L, look, H, W), implied("hinges"))); });
    // barn track (lightly until chosen, on sliding doors)
    if (slide) hw.push(grp("barnTrack", drawTrack(cfg, W, n, leaves), !has.barnTrack));
    leaves.forEach(function (L) {
      var edge = L.hingeLeft ? L.x + L.w : L.x; // latch edge x
      var dir = L.hingeLeft ? -1 : 1;           // direction from latch edge into the leaf
      var backset = look === "aluminum-glass" ? 1.6 : look === "frameless-glass" ? 3.5 : 2.75;
      var bx = edge + dir * backset;
      var leverY = has.panic ? 35.5 : 38;
      if (has.kickplate && look !== "frameless-glass") hw.push(grp("kickplate", rect(L.x + 1, H - 10.5, L.w - 2, 10, "url(#dpSteel)", "#7d8591", 0.3)));
      if (has.panic && !slide) hw.push(grp("panic", drawPanic(L, n, H)));
      if (has.panic && slide) hw.push(grp("panic", rect(L.x + 4, 38, L.w - 8, 2.4, METAL.fill, METAL.stroke, 0.35)));
      if (has.lever) {
        var lx2 = slide ? edge + dir * 3 : bx;
        hw.push(grp("lever", drawLever(lx2, leverY, dir, L.active ? 1 : 0.8)));
      }
      if (has.deadbolt && L.active) {
        hw.push(grp("deadbolt", look === "frameless-glass" ? drawPatchLock(L, H) : drawDeadbolt(bx, has.panic ? 46 : 44)));
      }
      if (has.pull) hw.push(grp("pull", drawPull(edge + dir * 3, 40)));
      if (has.privacyLatch && L.active) hw.push(grp("privacyLatch", rect(edge + dir * 1.2 - 0.9, 46, 1.8, 2.6, BLACK.fill, BLACK.stroke, 0.2) + rect(edge + dir * 1.2 - (dir > 0 ? 3.2 : -1.4), 46.8, 1.8, 1, BLACK.fill)));
      if (has.closer && !slide) hw.push(grp("closer", drawCloser(L, look, H)));
      if (has.recommend && !has.lever && !has.panic && !has.pull) hw.push(grp("recommend", drawGhostLever(slide ? edge + dir * 3 : bx, 38, dir)));
    });
    if (has.closer && slide) hw.push(grp("closer", drawDampers(W, n)));
    if (has.softClose) hw.push(grp("softClose", drawDampers(W, n)));
    if (has.keypad && !bare) {
      var kx = !slide ? W + F + 2.5 : n === 1 ? -8.5 : -W / 2 - 8;
      hw.push(grp("keypad", rect(kx, 41, 3.2, 5.6, "#2b3038", "#14171b", 0.3) + rect(kx + 0.5, 41.6, 2.2, 1.3, "#6fd28a") +
        [0, 1, 2].map(function (r) { return [0, 1].map(function (c) { return circ(kx + 1 + c * 1.2, 43.7 + r * 0.8, 0.28, "#aeb6c1"); }).join(""); }).join("")));
    }
    if (cfg.type.key === "fire-rated" && !slide) leaves.forEach(function (L) {
      var ex = L.hingeLeft ? L.x + 0.4 : L.x + L.w - 1.6;
      hw.push(grp("firelabel", rect(ex, 30, 1.2, 2.6, "#c8372d", "#8f1f17", 0.2)));
    });
    out = out.concat(hw);

    if (bare) { // just the opening: the frame's outside edge (a sliding door: the leaf and its track)
      var vb = slide ? [-2, -10.6, W + 4, H + 10.1] : [-F, -F, W + 2 * F, H + F];
      return { viewBox: vb, body: out.join("") };
    }
    /* dimensions, drawn like an elevation: width on a horizontal line under the door, height on a vertical
       line beside the wall (text turned to read bottom-to-top). Sizes are in inches, so text and gaps scale with the drawing. */
    if (o.sizeChosen) {
      var fs = Math.max(5.6, (x1 - x0) / 26, (H + mt) / 20), cap = 0.72 * fs, tk = Math.max(1.5, fs * 0.28), sw = r1(0.35 * Math.max(1, fs / 5.6));
      var dimTxt = function (x, y, cls, txt, extra) { return '<text x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="middle" class="dp-dimtext ' + cls + '" font-size="' + r1(fs) + '"' + (extra || "") + ">" + txt + "</text>"; };
      var qty = o.qty > 1 ? "  (qty " + o.qty + ")" : "", dimS = "";
      if (o.sizeKnown) {
        var ty = H + 5 + cap, dy = ty + 1.4;                       // width: text sits just above its line
        dimS += line(0, dy, W, dy, "currentColor", sw) + line(0, dy - tk, 0, dy + tk, "currentColor", sw) + line(W, dy - tk, W, dy + tk, "currentColor", sw);
        dimS += dimTxt(W / 2, ty, "dp-dimtext--w", fmtFtIn(W) + qty, ' data-dim="width"');
        var vx = x0 - tk - 2, tx = vx - 1.4, cy = H / 2;           // height: line outside the wall, floor to the head of the opening
        dimS += line(vx, 0, vx, H, "currentColor", sw) + line(vx - tk, 0, vx + tk, 0, "currentColor", sw) + line(vx - tk, H, vx + tk, H, "currentColor", sw);
        dimS += dimTxt(tx, cy, "dp-dimtext--h", fmtFtIn(H), ' data-dim="height" transform="rotate(-90 ' + r1(tx) + " " + r1(cy) + ')"');
        left = tx - 1.15 * fs - 2.2; bottom = Math.max(bottom, dy + tk + 1.5);
      } else {
        dimS += '<text x="' + r1(W / 2) + '" y="' + r1(H + 10.5) + '" text-anchor="middle" class="dp-dimtext" font-size="' + r1(Math.max(4.2, (x1 - x0) / 26)) + '">Size to be measured' + qty + "</text>";
      }
      out.push(grp("dim", dimS));
    }
    return { viewBox: [left, top, x1 - left, bottom - top], body: out.join("") };
  }

  function fmtFtIn(inches) { var f = Math.floor(inches / 12), i = Math.round(inches - f * 12); return f + "' " + i + '"'; }

  function drawLeaf(L, look, fin, cfg) {
    var s = "", x = L.x, y = L.y, w = L.w, h = L.h, unspec = !cfg.material.specified;
    var face = fin.face, edge = fin.edge, glass = fin.glass || "#cfe4f2";
    var glassFill = "url(#dpGlass)";
    switch (look) {
      case "aluminum-glass":
        s += rect(x, y, w, h, face, edge, 0.35);
        s += rect(x + 2, y + 2.5, w - 4, h - 2.5 - 10, unspec ? glass : glassFill, edge, 0.3);
        break;
      case "frameless-glass":
        s += rect(x, y, w, h, unspec ? glass : glassFill, "#8fb0c3", 0.35, ' fill-opacity="0.9"');
        s += line(x + w * 0.2, y + h * 0.15, x + w * 0.45, y + h * 0.05, "#ffffff", 0.5, ' stroke-opacity="0.8"');
        break;
      case "steel-vision":
        s += rect(x, y, w, h, face, edge, 0.35);
        var vx = L.hingeLeft ? x + w - 4 - 5 - 2 : x + 4 + 2; if (w < 20) vx = x + w / 2 - 2.5;
        s += rect(vx, y + 14, 5, 20, glassFill, edge, 0.4);
        break;
      case "steel-security-glass":
        s += rect(x, y, w, h, face, edge, 0.35);
        var gw = Math.min(10, w - 10), gx = x + (w - gw) / 2;
        s += rect(gx - 0.6, y + 11.4, gw + 1.2, 31.2, edge, null) + rect(gx, y + 12, gw, 30, glassFill, null);
        for (var gy = y + 16; gy < y + 42; gy += 4) s += line(gx, gy, gx + gw, gy, "#ffffff", 0.15, ' stroke-opacity=".6"');
        break;
      case "glass-panel":
        s += rect(x, y, w, h, face, edge, 0.35);
        s += rect(x + 4, y + 5, w - 8, h - 5 - 12, glassFill, edge, 0.35);
        break;
      case "frosted-glass":
        s += rect(x, y, w, h, face, edge, 0.35);
        s += rect(x + 4, y + 4, w - 8, h - 8, "url(#dpFrost)", edge, 0.35);
        break;
      case "wood-panel": {
        s += rect(x, y, w, h, face, edge, 0.35);
        var ph = (h - 4 * 4) / 3;
        for (var p = 0; p < 3; p++) s += rect(x + 4, y + 4 + p * (ph + 4), w - 8, ph, shade(face, -0.08), edge, 0.3);
        if (!unspec) s += woodGrain(x, y, w, h, edge);
        break;
      }
      case "wood":
        s += rect(x, y, w, h, face, edge, 0.35);
        if (!unspec) s += woodGrain(x, y, w, h, edge);
        break;
      case "fiberglass":
        s += rect(x, y, w, h, face, edge, 0.35);
        var pw = (w - 3 * 3) / 2, pr = [[5, 14], [22, 26], [51, h - 51 - 5]];
        if (w < 20) pw = w - 6;
        pr.forEach(function (r) { for (var c = 0; c < (w < 20 ? 1 : 2); c++) s += rect(x + 3 + c * (pw + 3), y + r[0], pw, r[1], shade(face, -0.04), edge, 0.3); });
        break;
      case "steel-heavy":
        s += rect(x, y, w, h, face, edge, 0.5) + rect(x + 1, y + 1, w - 2, h - 2, "none", shade(face, 0.12), 0.25);
        break;
      default: // steel
        s += rect(x, y, w, h, face, edge, 0.35) + line(x + 1.2, y + 1, x + 1.2, y + h - 1, shade(face, 0.1), 0.25);
    }
    if (unspec) s += rect(x, y, w, h, "none", "#8793a3", 0.35, ' stroke-dasharray="1.6 1.2"');
    return s;
  }

  function woodGrain(x, y, w, h, edge) {
    var s = "";
    for (var gx = x + 3; gx < x + w - 1; gx += 3.4) s += '<path d="M' + r1(gx) + " " + r1(y + 1) + " q 0.8 " + r1(h * 0.25) + " 0 " + r1(h * 0.5) + " t 0 " + r1(h * 0.5 - 2) + '" fill="none" stroke="' + edge + '" stroke-width="0.18" stroke-opacity="0.45"/>';
    return s;
  }
  function shade(hex, amt) {
    var c = parseInt(hex.slice(1), 16), r = c >> 16, g = (c >> 8) & 255, b = c & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); };
    return "#" + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  function drawHinges(L, look, H) {
    var s = "", hx = L.hingeLeft ? L.x - 0.5 : L.x + L.w - 0.5;
    if (look === "aluminum-glass") { // offset pivots top + bottom
      s += rect(hx - 0.4, -1.2, 2, 1.8, METAL.fill, METAL.stroke, 0.3) + rect(hx - 0.4, H - 1.2, 2, 1.4, METAL.fill, METAL.stroke, 0.3);
      return s;
    }
    if (look === "frameless-glass") { // top and bottom patch fittings
      var px = L.hingeLeft ? L.x : L.x + L.w - 7;
      return rect(px, L.y, 7, 2.6, METAL.fill, METAL.stroke, 0.3) + rect(px, L.y + L.h - 3.6, 7, 3.6, METAL.fill, METAL.stroke, 0.3);
    }
    var count = Math.max(3, Math.ceil(H / 30)), topY = 5, botY = H - 10 - 4.5;
    for (var i = 0; i < count; i++) {
      var y = topY + (botY - topY) * (i / (count - 1));
      s += rect(hx, y, 1, 4.5, METAL.fill, METAL.stroke, 0.3) + line(hx + 0.5, y, hx + 0.5, y + 4.5, METAL.stroke, 0.15);
    }
    return s;
  }

  function drawLever(x, y, dirSign, op) {
    // dirSign: +1 lever points right, -1 points left (always toward the leaf centre). Drawn ~1.2x for legibility.
    var len = 5.6 * (dirSign > 0 ? 1 : -1), t = 0.6, tip = dirSign > 0 ? 0.8 : -0.8;
    return '<g opacity="' + op + '">' + circ(x, y, 1.7, METAL.fill, METAL.stroke, 0.3) +
      '<path d="M' + r1(x) + " " + r1(y - t) + " L" + r1(x + len) + " " + r1(y - t * 0.8) + " Q" + r1(x + len + tip) + " " + r1(y) + " " + r1(x + len) + " " + r1(y + t) + " L" + r1(x) + " " + r1(y + t) + ' Z" fill="' + METAL.fill + '" stroke="' + METAL.stroke + '" stroke-width="0.3"/>' + circ(x, y, 0.7, shade(METAL.fill, -0.1)) + "</g>";
  }
  function drawGhostLever(x, y, dir) {
    var len = 5.6 * (dir > 0 ? 1 : -1);
    return circ(x, y, 1.7, "none", "#7d8898", 0.3) + line(x, y, x + len, y, "#7d8898", 0.9, ' stroke-dasharray="0.8 0.6" stroke-linecap="round"');
  }
  function drawDeadbolt(x, y) { return circ(x, y, 1.5, METAL.fill, METAL.stroke, 0.3) + circ(x, y, 0.8, shade(METAL.fill, -0.08), METAL.stroke, 0.2) + line(x, y - 0.5, x, y + 0.5, METAL.stroke, 0.3); }
  function drawPatchLock(L, H) {
    var px = L.hingeLeft ? L.x + L.w - 7 : L.x;
    return rect(px, L.y + L.h - 3.6, 7, 3.6, METAL.fill, METAL.stroke, 0.3) + circ(px + 3.5, L.y + L.h - 1.8, 0.7, "#8a929d");
  }
  function drawPanic(L, n, H) {
    var x = L.x + 2.5, w = L.w - 5, y = 38.8, s = "";
    var chassisX = L.hingeLeft ? x + w - 7 : x;
    s += rect(x, y, w, 2.5, METAL.fill, METAL.stroke, 0.35) + rect(chassisX, y - 0.6, 7, 3.7, shade(METAL.fill, -0.08), METAL.stroke, 0.35);
    s += rect(L.hingeLeft ? x - 0.2 : x + w - 1.4, y - 0.4, 1.6, 3.3, shade(METAL.fill, -0.12), METAL.stroke, 0.3);
    if (n === 2) { // vertical rod device on pairs
      var rx = L.hingeLeft ? x + w - 3.5 : x + 3.5;
      s += line(rx, 1.2, rx, y - 0.6, METAL.stroke, 0.35) + line(rx, y + 3.1, rx, H - 1, METAL.stroke, 0.35) +
        rect(rx - 0.8, 0.4, 1.6, 1.4, METAL.fill, METAL.stroke, 0.25);
    }
    return s;
  }
  function drawPull(x, cy) { return rect(x - 0.45, cy - 6, 0.9, 12, BLACK.fill, BLACK.stroke, 0.2) + rect(x - 0.9, cy - 6.3, 1.8, 0.8, BLACK.fill) + rect(x - 0.9, cy + 5.5, 1.8, 0.8, BLACK.fill); }
  function drawCloser(L, look, H) {
    if (look === "frameless-glass") { // concealed floor closer at the bottom pivot
      var fx = L.hingeLeft ? L.x - 1 : L.x + L.w - 13;
      return rect(fx, H + 0.4, 14, 1.6, "#b8bec6", "#6d7581", 0.25, ' stroke-dasharray="0.8 0.5"');
    }
    var bx = L.hingeLeft ? L.x + 2 : L.x + L.w - 2 - 11;
    var armStart = L.hingeLeft ? bx + 11 : bx, armEnd = L.hingeLeft ? bx + 18 : bx - 7;
    return rect(bx, 1.6, 11, 2.6, METAL.fill, METAL.stroke, 0.35) + rect(L.hingeLeft ? bx + 9.6 : bx - 0.2, 1.3, 1.6, 3.2, shade(METAL.fill, -0.1), METAL.stroke, 0.25) +
      '<path d="M' + r1(armStart) + " 2.9 L" + r1((armStart + armEnd) / 2) + " 4.6 L" + r1(armEnd) + ' -1.1" fill="none" stroke="' + METAL.stroke + '" stroke-width="0.55" stroke-linejoin="round"/>' +
      rect(armEnd - 1.2, -1.9, 2.4, 1.2, METAL.fill, METAL.stroke, 0.25);
  }
  function drawTrack(cfg, W, n, leaves) {
    var ty = -8.5, s = "", x0 = n === 1 ? -6 : -W / 2 - 6, x1 = n === 1 ? 2 * W + 6 : W + W / 2 + 6;
    s += rect(x0, ty, x1 - x0, 1.3, BLACK.fill, BLACK.stroke, 0.2);
    s += rect(x0 - 0.8, ty - 0.4, 1, 2.1, BLACK.fill) + rect(x1 - 0.2, ty - 0.4, 1, 2.1, BLACK.fill);
    for (var bx = x0 + 6; bx < x1 - 3; bx += 16) s += circ(bx, ty + 0.65, 0.35, "#6b717b");
    leaves.forEach(function (L) {
      [L.x + 4, L.x + L.w - 4].forEach(function (hx) {
        s += circ(hx, ty - 0.2, 1.6, BLACK.fill, BLACK.stroke, 0.2) + rect(hx - 0.55, ty - 0.2, 1.1, L.y - ty + 6, BLACK.fill) + circ(hx, L.y + 4.6, 0.35, "#6b717b");
      });
    });
    return s;
  }
  function drawDampers(W, n) {
    var ty = -8.5, x0 = n === 1 ? -6 : -W / 2 - 6, x1 = n === 1 ? 2 * W + 6 : W + W / 2 + 6;
    return rect(x0 + 2, ty + 1.3, 4.5, 1, "#4b5059", "#111317", 0.15) + rect(x1 - 6.5, ty + 1.3, 4.5, 1, "#4b5059", "#111317", 0.15);
  }

  function renderFlagpole(cfg) {
    var count = cfg.opening.leaves === 2 ? 2 : 1, fin = cfg.material.finish, H = 240, s = "";
    var spacing = 70, x0 = -40, x1 = (count - 1) * spacing + 70;
    s += grp("sky", rect(x0, -20, x1 - x0, H + 20, "#eef4fb") + rect(x0, H, x1 - x0, 14, "#dfe6d6") + line(x0, H, x1, H, "#a8b39a", 0.6));
    for (var i = 0; i < count; i++) {
      var px = i * spacing;
      var p = rect(px - 6, H - 1.5, 12, 3, "#c9ccd0", "#8e949b", 0.4) +
        '<path d="M' + (px - 2.6) + " " + H + " L" + (px - 1.4) + " 0 L" + (px + 1.4) + " 0 L" + (px + 2.6) + " " + H + ' Z" fill="' + fin.face + '" stroke="' + fin.edge + '" stroke-width="0.5"/>' +
        rect(px - 2.2, -3, 4.4, 3, fin.edge) + circ(px, -5.2, 2.4, "#d9b44a", "#a8862c", 0.4);
      // halyard + cleat: the pole's own hardware, drawn lightly until a hardware choice is made
      var fit = line(px + 1.6, 0, px + 2.4, H - 40, "#5b636e", 0.45) + rect(px + 1.6, H - 44, 2.6, 6, "#5b636e", "#343a42", 0.3) + rect(px + 1.2, H - 43, 3.4, 1.1, "#343a42");
      // flag
      var fx = px + 1.2, fy = 1.5, fw = 48, fh = 26, flag = "";
      for (var r = 0; r < 7; r++) flag += rect(fx, fy + r * (fh / 6.5), fw, fh / 13, "#b3261e");
      flag = rect(fx, fy, fw, fh, "#ffffff", "#9aa3ad", 0.25) + flag + rect(fx, fy, fw * 0.42, fh * 0.54, "#233a7a");
      for (var sy = 0; sy < 4; sy++) for (var sx = 0; sx < 5; sx++) flag += circ(fx + 2.2 + sx * 3.8, fy + 2.2 + sy * 3.4, 0.45, "#ffffff");
      p += '<g class="dp-flag">' + flag + "</g>";
      s += grp("pole" + i, p) + grp("poleFittings" + i, fit, !cfg.hardware.items.length);
    }
    if (cfg.opening.sizeChosen) s += grp("dim", '<text x="' + r1((count - 1) * spacing / 2 + 15) + '" y="' + (H + 13) + '" text-anchor="middle" class="dp-dimtext" font-size="' + r1((x1 - x0) / 16) + '">' + (count === 2 ? "Two flagpoles" : "One flagpole") + "</text>");
    return { viewBox: [x0, -20, x1 - x0, H + 36], body: s };
  }

  /* The door alone (no wall, no dimension line) as a standalone SVG file, for the "See it on your building" photo step.
     Same config, same drawing code as the preview panel. Returns null for flagpoles or when no door type is chosen. */
  function openingSVG(cfg, pxHeight) {
    if (!cfg || cfg.empty || cfg.product !== "door") return null;
    var r = renderDoor(cfg, true), vb = r.viewBox, h = Math.round(pxHeight || 1200), w = Math.round(h * vb[2] / vb[3]);
    var body = r.body.replace(/class="dp-part dp-dim"/g, 'class="dp-part dp-dim" opacity="0.55"');
    return {
      width: w, height: h, aspect: vb[2] / vb[3],
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="' + vb.map(r1).join(" ") + '" preserveAspectRatio="none">' + DEFS + body + "</svg>"
    };
  }

  /* The full drawing (wall, door, hardware, dimension) as one self-contained <svg> string, for build cards,
     quote summaries and the office view. Gradient ids get a suffix so several drawings can share a page. */
  function svgMarkup(cfg, uid, label, cls) {
    if (!cfg) return "";
    var r = render(cfg), sfx = uid ? "-" + String(uid).replace(/[^\w-]/g, "") : "";
    var defs = DEFS.replace(/id="(dp\w+)"/g, 'id="$1' + sfx + '"');
    var body = r.body.replace(/url\(#(dp\w+)\)/g, "url(#$1" + sfx + ")");
    return '<svg class="dp-svg' + (cls ? " " + cls : "") + '" role="img" aria-label="' + esc(label || ("Drawing of " + cfg.summary)) + '" viewBox="' + r.viewBox.map(r1).join(" ") +
      '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + defs + '<g class="dp-scene">' + body + "</g></svg>";
  }

  var DEFS = '<defs>' +
    '<linearGradient id="dpGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4f1fa"/><stop offset=".55" stop-color="#bcd8ea"/><stop offset="1" stop-color="#a9c9de"/></linearGradient>' +
    '<linearGradient id="dpFrost" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f4f7"/><stop offset="1" stop-color="#dde4ea"/></linearGradient>' +
    '<linearGradient id="dpSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9dde2"/><stop offset=".5" stop-color="#b9c0c8"/><stop offset="1" stop-color="#dfe3e8"/></linearGradient>' +
    "</defs>";

  /* ------------------------------------------------------------------ */
  /* 4. Panel controller (DOM, animation, a11y)                          */
  /* ------------------------------------------------------------------ */
  var EMPTY_TEXT = "Your door will appear here as you choose.";

  function Panel(el, opts) {
    this.el = el; this.opts = opts || {};
    this.mq = window.matchMedia ? window.matchMedia("(min-width: 1024px)") : { matches: true, addListener: function () {} };
    this.reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    this.svg = el.querySelector("svg.dp-svg");
    this.cap = el.querySelector(".dp-caption");
    this.live = el.querySelector(".dp-live");
    this.fig = el.querySelector(".dp-photo");
    this.lastKeys = {}; this.lastSummary = null; this.pending = null; this.config = null; this.liveTimer = 0; this.lastLive = 0;
    var self = this;
    var onMq = function () { if (self.mq.matches && self.config) self.draw(self.config, true); self.placeTop(); };
    if (this.mq.addEventListener) this.mq.addEventListener("change", onMq); else this.mq.addListener(onMq);
    var raf = 0, onScroll = function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; self.placeTop(); }); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    this.placeTop();
  }
  Panel.prototype.placeTop = function () {
    if (!this.mq.matches) return;
    var hd = document.querySelector(this.opts.header || "header");
    var b = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0;
    this.el.style.setProperty("--dp-top", Math.round(b + 16) + "px");
  };
  Panel.prototype.update = function (selection) {
    var cfg = buildConfig(selection, this.opts);
    this.config = cfg;
    root.DoorPreview.current = cfg;
    this.el.setAttribute("data-stage", String(cfg.stage));
    // Always keep text + label current (cheap); only redraw artwork when visible.
    this.caption(cfg);
    var label = cfg.empty ? EMPTY_TEXT : "Door preview: " + cfg.summary;
    this.svg.setAttribute("aria-label", label);
    if (this.mq.matches) this.draw(cfg, false);
    else this.dirty = true;
    this.announce(cfg);
  };
  Panel.prototype.draw = function (cfg, force) {
    var r = render(cfg);
    var sig = r.viewBox.join(",") + r.body + "|" + cfg.summary; // redraw on every configuration change
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;
    this.svg.setAttribute("viewBox", r.viewBox.map(r1).join(" "));
    this.svg.innerHTML = DEFS + '<g class="dp-scene">' + r.body + "</g>";
    // animate: whole scene settles in, newly added parts pop
    var keys = {}, parts = this.svg.querySelectorAll(".dp-part"), self = this, anim = !this.reduce.matches && !force;
    for (var i = 0; i < parts.length; i++) {
      var k = parts[i].getAttribute("data-k") + (parts[i].classList.contains("dp-dim") ? ":dim" : "");
      keys[k] = true;
      if (anim && !self.lastKeys[k] && Object.keys(self.lastKeys).length && !/^(wall|frame|sky)/.test(k)) parts[i].classList.add("dp-new");
    }
    this.lastKeys = keys;
    this.el.setAttribute("data-rev", String((+this.el.getAttribute("data-rev") || 0) + 1));
    if (anim) { this.svg.classList.remove("dp-anim"); void this.svg.getBoundingClientRect(); this.svg.classList.add("dp-anim"); }
    // photo
    if (this.fig) {
      if (cfg.photo) {
        var img = this.fig.querySelector("img");
        if (img.getAttribute("src") !== cfg.photo.src) { img.src = cfg.photo.src; img.alt = cfg.photo.alt; }
        this.fig.querySelector("figcaption").textContent = cfg.photo.caption || "A similar door we've installed";
        this.fig.hidden = false;
      } else this.fig.hidden = true;
    }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  Panel.prototype.caption = function (cfg) {
    if (cfg.empty) { this.cap.innerHTML = '<p class="dp-empty">' + EMPTY_TEXT + "</p>"; return; }
    var pend = '<span class="dp-pending">Not chosen yet</span>';
    var rows = [
      ["Type", esc(cfg.type.label)],
      ["Material", cfg.material.chosen ? esc(cfg.material.label) : pend],
      [cfg.product === "flagpole" ? "Size" : "Size", cfg.opening.sizeChosen ? esc(cfg.opening.label) + (cfg.opening.qty > 1 ? " (qty " + cfg.opening.qty + ")" : "") : pend],
      ["Hardware", cfg.hardware.items.length ? esc(cfg.hardware.items.map(function (h) { return h.label; }).join(", ")) : pend]
    ];
    var html = "<dl>" + rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl>";
    if (cfg.hardware.noted.length) html += '<p class="dp-note">Listed for our team, not drawn: ' + esc(cfg.hardware.noted.map(function (h) { return h.label; }).join(", ")) + ".</p>";
    this.cap.innerHTML = html;
  };
  Panel.prototype.announce = function (cfg) {
    if (!this.live) return;
    var msg = cfg.empty ? "" : "Preview updated: " + cfg.summary;
    if (msg === this.lastSummary) return;
    this.lastSummary = msg; this.pending = msg;
    var self = this, wait = Math.max(0, 1200 - (Date.now() - this.lastLive));
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(function () { self.live.textContent = self.pending; self.lastLive = Date.now(); }, Math.max(wait, 400));
  };

  /* ------------------------------------------------------------------ */
  /* 5. Site adapters (read builder state; never change it)              */
  /* ------------------------------------------------------------------ */
  var ADAPTERS = {
    // Site A: app.js dispatches "doorbuilder:change" with { step, state, rows } from renderStep()
    a: function (panel, start) {
      var last = null;
      function toSel(d) {
        var st = d.state, rows = {}; (d.rows || []).forEach(function (r) { rows[r[0]] = r[1]; });
        var w = document.getElementById("size-w"), h = document.getElementById("size-h"), q = document.getElementById("size-q");
        return {
          site: "a", step: d.step,
          type: st.type ? { id: st.type, label: rows["Door type"] } : null,
          material: st.material ? { id: st.material, label: rows["Material"] } : null,
          size: st.size ? { id: st.size, label: st.size === "custom" ? customLabel() : rows["Size"], w: w && w.value, h: h && h.value, qty: q && q.value } : null,
          hardware: (st.hardware || []).map(function (x, i) { return { id: x, label: (d.hwLabels && d.hwLabels[i]) || x }; })
        };
      }
      function customLabel() {
        var w = document.getElementById("size-w").value, h = document.getElementById("size-h").value, qe = document.getElementById("size-q"), q = (qe && qe.value) || 1;
        return "Custom: " + (w || "?") + "\" W × " + (h || "?") + "\" H" + (q > 1 ? " (qty " + q + ")" : "");
      }
      document.addEventListener("doorbuilder:change", function (e) { last = e.detail; panel.update(toSel(last)); });
      ["size-w", "size-h", "size-q"].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.addEventListener("input", function () { if (last) panel.update(toSel(last)); });
      });
    },
    // Site B: the form's radio/checkbox inputs are the builder state; listen only.
    b: function (panel, start) {
      var form = document.getElementById("door-builder-form"); if (!form) return;
      function picked(name) {
        var i = form.querySelector('[name="' + name + '"]:checked'); if (!i) return null;
        var b = i.parentElement.querySelector("b"); return { id: i.value, label: b ? b.textContent : i.value };
      }
      function read() {
        var size = picked("size");
        if (size) { size.w = (document.getElementById("custom-width") || {}).value; size.h = (document.getElementById("custom-height") || {}).value;
          if (size.id === "Custom") size.label = "Custom: " + (size.w || "?") + " W × " + (size.h || "?") + " H"; }
        panel.update({
          site: "b", type: picked("doorType"), material: picked("material"), size: size,
          hardware: Array.prototype.map.call(form.querySelectorAll('[name="hardware"]:checked'), function (i) { var b = i.parentElement.querySelector("b"); return { id: i.value, label: b ? b.textContent : i.value }; })
        });
      }
      form.addEventListener("change", read);
      form.addEventListener("input", read);
      form.addEventListener("reset", function () { setTimeout(read, 0); });
      var first = form.querySelector('.builder-step[data-step="1"]');
      if (start && first && window.MutationObserver) {
        var sync = function () { start.hidden = first.hidden; };
        new MutationObserver(sync).observe(first, { attributes: true, attributeFilter: ["hidden"] }); sync();
      }
      read();
    },
    // Site C: app.js dispatches "doorbuilder:change" with { step, state, labels } from renderBuilder()
    c: function (panel, start) {
      var last = null;
      function toSel(d) {
        var st = d.state, L = d.labels || {};
        var w = document.getElementById("custom-w"), h = document.getElementById("custom-h");
        var cw = w ? w.value.trim() : st.customW, ch = h ? h.value.trim() : st.customH;
        return {
          site: "c", step: d.step,
          type: st.type ? { id: st.type, label: L.type } : null,
          material: st.material ? { id: st.material, label: L.material } : null,
          size: st.size ? { id: st.size, label: st.size === "custom" ? "Custom " + (cw || "—") + " × " + (ch || "—") : L.size, w: cw, h: ch } : null,
          hardware: (st.hardware || []).map(function (id, i) { return { id: id, label: String(L.hardware || "").split(", ")[i] || id }; })
        };
      }
      document.addEventListener("doorbuilder:change", function (e) {
        last = e.detail; if (start) start.hidden = e.detail.step !== 0; panel.update(toSel(last));
      });
      document.addEventListener("input", function (e) { if (last && e.target && /^custom-[wh]$/.test(e.target.id)) panel.update(toSel(last)); });
    }
  };

  function init() {
    var el = document.querySelector("[data-door-preview]");
    if (!el || el.__dp) return; el.__dp = true;
    var site = el.getAttribute("data-door-preview");
    var base = el.getAttribute("data-photo-base") || "images/";
    var photos = {
      barnWood: { src: base + "barn-door-white-shaker.jpg", alt: "White shaker-style sliding barn door on black flat track", caption: "A similar barn door we've installed" },
      barnFrosted: { src: base + "barn-door-frosted-glass-closet.jpg", alt: "White sliding barn door with a frosted glass panel across a closet opening", caption: "A similar barn door we've installed" },
      securitySteel: { src: base + "dark-steel-door-installed.jpg", alt: "Charcoal steel security door with a satin lever, installed in a home", caption: "A similar steel door we've installed" }
    };
    var panel = new Panel(el, { photos: photos, header: el.getAttribute("data-header") || "header" });
    panel.update({ site: site });
    var start = document.querySelector("[data-door-start]");
    if (ADAPTERS[site]) ADAPTERS[site](panel, start);
    root.DoorPreview.panel = panel;
  }

  root.DoorPreview = { buildConfig: buildConfig, render: render, openingSVG: openingSVG, svgMarkup: svgMarkup, parseLength: parseLength, init: init, current: null };
  // Scripts sit at the end of <body>, so the panel usually exists already: start at once so the
  // builder's first "doorbuilder:change" event is not missed. Otherwise wait for the DOM.
  if (document.querySelector("[data-door-preview]")) init(); else document.addEventListener("DOMContentLoaded", init);
})(window);
