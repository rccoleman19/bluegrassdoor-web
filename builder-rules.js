/*!
 * Bluegrass Commercial Door & More: door builder hardware rules.
 * One place for every compatibility rule the door builder follows.
 * Sources: IBC 2021/2024 (1010.1.2, 1010.2.1, 1010.2.4, 1010.2.9), NFPA 80, 2010 ADA Standards,
 * and manufacturer requirements for narrow-stile aluminum and frameless glass doors.
 *
 * To change a rule, edit RULES below. Each rule has:
 *   id        short name
 *   severity  "invalid"     the combination never works: the option is disabled (or removed if the
 *                           door changes underneath it) and the reason is shown next to it
 *             "missing"     a required item is missing: it is added automatically (fix.add) or the
 *                           customer is asked to pick one of fix.oneOf before continuing
 *             "conditional" works only as a specific product: the option is renamed (relabel) and/or
 *                           a short note is shown and passed along with the quote request
 *             "note"        a helpful reminder passed along with the quote request
 *   when      conditions (all must hold): type, typeNot, material, size, hwAny, hwAll, hwNone,
 *             hwChosen (hardware picked and not "Recommend for me"), customOver (inches)
 *   say       the plain-English reason shown to the customer; sayFor overrides it per option
 *
 * Works in the browser (window.BuilderRules) and in Node (module.exports) so the same rules can be checked outside the browser.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BuilderRules = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Hardware keys <-> the labels the builder shows by default */
  var HW = {
    lever: "Lever lockset", deadbolt: "Deadbolt", panic: "Panic / exit device", closer: "Door closer",
    keypad: "Keypad / access control", hinges: "Hinges / pivots", kick: "Kick plate & accessories",
    barntrack: "Barn track hardware", pull: "Door pull / handle", privacy: "Privacy latch", softclose: "Soft-close",
    recommend: "Recommend for me"
  };
  var KEY_OF = {}; Object.keys(HW).forEach(function (k) { KEY_OF[HW[k]] = k; });

  var RULES = [
    /* ---------- never works: disable ---------- */
    { id: "allglass-lever", severity: "invalid",
      when: { material: ["fullglass"], hwAny: ["lever"] },
      say: "Not for frameless glass: tempered glass can't be drilled for a lever lock. A patch lock works instead." },
    { id: "panic-plus-deadbolt", severity: "invalid",
      when: { hwAll: ["panic", "deadbolt"] },
      say: "A panic bar has to open the door in one push, so it can't be combined with a separate deadbolt.",
      sayFor: {
        deadbolt: "Not with a panic bar: code requires one push to get out, so no separate deadbolt.",
        panic: "Not with a deadbolt: a panic bar has to open the door in one push. Unselect the deadbolt to use this."
      } },

    /* ---------- required items ---------- */
    { id: "fire-needs-closer", severity: "missing",
      when: { type: ["fire"], hwChosen: true, withRecommend: true, hwNone: ["closer"] },
      fix: { add: "closer" },
      say: "Fire-rated doors need a closer, so we added one.",
      locked: "Fire-rated doors must close on their own, so the closer stays on." },
    { id: "fire-needs-latch", severity: "missing",
      when: { type: ["fire"], hwChosen: true, hwNone: ["lever", "panic", "keypad"] },
      fix: { oneOf: ["lever", "panic", "keypad"] },
      say: "Fire-rated doors must latch shut. Add a lever lockset, fire exit hardware or a keypad lock (a deadbolt doesn't count as the latch), or choose Recommend for me." },
    { id: "barn-needs-track", severity: "missing",
      when: { type: ["barn"], hwChosen: true, withRecommend: true, hwNone: ["barntrack"] },
      fix: { add: "barntrack" },
      say: "Barn doors hang from a track, so we added one.",
      locked: "Every barn door hangs from a track, so it stays on." },

    /* ---------- works only as a specific product: rename and/or note ---------- */
    { id: "fire-panic", severity: "conditional",
      when: { type: ["fire"], hwAny: ["panic"] },
      relabel: { hw: "panic", title: "Fire exit hardware", sub: "Panic bar listed for fire doors" },
      say: "Fire doors take fire exit hardware: a panic bar listed for fire doors, with no hold-open." },
    { id: "fire-keypad", severity: "conditional",
      when: { type: ["fire"], hwAny: ["keypad"] },
      note: "keypad",
      say: "On a fire door, access control has to keep the door latched (a listed fail-secure lock or strike)." },
    { id: "fire-deadbolt", severity: "conditional",
      when: { type: ["fire"], hwAny: ["deadbolt"] },
      note: "deadbolt",
      say: "Extra security only: on a fire door a deadbolt doesn't count as the latch, and it must be fire-listed." },
    { id: "fire-kick", severity: "conditional",
      when: { type: ["fire"], hwAny: ["kick"] },
      note: "kick",
      say: "On a fire door, protection plates taller than 16 in. must be fire-labeled." },
    { id: "fire-pair", severity: "conditional",
      when: { type: ["fire"], size: ["pair"] },
      note: "size:pair",
      say: "Fire-rated pairs also need automatic flush bolts and a coordinator, or exit devices on both doors. We've noted this for your quote." },
    { id: "storefront-lever", severity: "conditional",
      when: { type: ["storefront"], material: ["alglass"], hwAny: ["lever"] },
      relabel: { hw: "lever", title: "Narrow-stile lever latch", sub: "Slim lever latch made for aluminum doors" },
      say: "A standard lever lock doesn't fit a narrow aluminum door, so this is a narrow-stile lever latch." },
    { id: "storefront-deadbolt", severity: "conditional",
      when: { type: ["storefront"], material: ["alglass"], hwAny: ["deadbolt"] },
      relabel: { hw: "deadbolt", title: "Narrow-stile deadlock", sub: "Slim deadlock made for aluminum doors" }, noteInSummary: true,
      say: "On a main entrance, a key-locked deadlock also needs a sign saying the door stays unlocked while the space is occupied." },
    { id: "allglass-closer", severity: "conditional",
      when: { material: ["fullglass"], hwAny: ["closer"] },
      relabel: { hw: "closer", title: "Floor or concealed closer", sub: "Glass doors have no top rail for a surface closer" },
      say: "Frameless glass doors use a floor closer or a concealed overhead closer." },
    { id: "allglass-hinges", severity: "conditional",
      when: { material: ["fullglass"], hwAny: ["hinges"] },
      relabel: { hw: "hinges", title: "Pivots / patch fittings", sub: "Glass doors hang on pivots, not hinges" },
      say: "Frameless glass doors hang on pivots and patch fittings, not butt hinges." },
    { id: "allglass-panic", severity: "conditional",
      when: { material: ["fullglass"], hwAny: ["panic"] },
      relabel: { hw: "panic", title: "Glass-door exit device", sub: "Push bar made for frameless glass" },
      say: "Frameless glass needs an exit device made for glass doors." },
    { id: "allglass-keypad", severity: "conditional",
      when: { material: ["fullglass"], hwAny: ["keypad"] },
      relabel: { hw: "keypad", title: "Glass-door access control", sub: "Electric patch lock, wiring hidden" },
      say: "Frameless glass needs an electric patch lock or strike made for glass doors." },
    { id: "allglass-deadbolt", severity: "conditional",
      when: { material: ["fullglass"], hwAny: ["deadbolt"] },
      relabel: { hw: "deadbolt", title: "Patch lock", sub: "Keyed lock made for glass doors" },
      say: "Frameless glass takes a patch lock instead of a drilled deadbolt." },
    { id: "allglass-kick", severity: "conditional",
      when: { material: ["fullglass"], hwAny: ["kick"] },
      relabel: { hw: "kick", title: "Stops & seals", sub: "Frameless glass has no kick plate" },
      say: "Frameless glass has no kick plate, so this covers stops and seals." },
    { id: "lever-plus-panic", severity: "conditional",
      when: { typeNot: ["barn"], hwAll: ["lever", "panic"] },
      note: "lever",
      say: "With a panic bar, the lever is the panic bar's outside trim rather than a second lock. On a pair, we'll set up each door." },
    { id: "lever-plus-deadbolt", severity: "conditional",
      when: { hwAll: ["lever", "deadbolt"], hwNone: ["panic"] },
      note: "deadbolt",
      say: "So one turn opens the door, this will be an interconnected lever and deadbolt. Separate locks are only allowed in homes and sleeping rooms." },
    { id: "pair-panic", severity: "conditional",
      when: { typeNot: ["barn"], size: ["pair"], hwAny: ["panic"] },
      note: "panic",
      say: "On a pair, exit devices use vertical rods or a removable center post." },
    { id: "pair-lever-only", severity: "conditional",
      when: { typeNot: ["barn", "fire"], size: ["pair"], hwAny: ["lever"], hwNone: ["panic"] },
      note: "lever",
      say: "The second door of a pair gets flush bolts, and usually an astragal, to hold it shut. We've noted this for your quote." },
    { id: "panic-on-wood-fiberglass", severity: "conditional",
      when: { material: ["wood", "fiberglass"], hwAny: ["panic"] },
      note: "panic",
      say: "On wood and fiberglass doors, exit devices are through-bolted or mounted on factory blocking." },

    /* ---------- reminders ---------- */
    { id: "barn-egress", severity: "note",
      when: { type: ["barn"] },
      say: "Sliding barn doors aren't fire doors, and on an exit path they're only allowed for small rooms (10 people or fewer)." },
    { id: "keypad-power", severity: "note",
      when: { hwAny: ["keypad"] },
      note: "keypad",
      say: "Access control needs power and an electrified lock or strike. We'll plan the wiring with you." },
    { id: "security-tested", severity: "note",
      when: { type: ["security"] },
      say: "Safe-room doors are tested as a complete unit, so the hardware has to match the tested door." },
    { id: "custom-size-review", severity: "note",
      when: { size: ["custom"], customOver: 120 },
      note: "size:custom",
      say: "That's larger than a typical door opening. We'll confirm the right product when we measure." }
  ];

  /* ---------- core ---------- */
  function hwKeys(sel) { return (sel.hardware || []).map(function (h) { return KEY_OF[h] || h; }); }
  function has(list, v) { return list.indexOf(v) > -1; }

  // sel = { type, material, size, hardware: [keys], customW, customH }
  function matches(rule, sel, assumeChosen) {
    var w = rule.when, hw = sel.hardware || [];
    if (w.type && !has(w.type, sel.type)) return false;
    if (w.typeNot && has(w.typeNot, sel.type)) return false;
    if (w.material && !has(w.material, sel.material)) return false;
    if (w.size && !has(w.size, sel.size)) return false;
    if (w.hwAny && !w.hwAny.some(function (h) { return has(hw, h); })) return false;
    if (w.hwAll && !w.hwAll.every(function (h) { return has(hw, h); })) return false;
    if (w.hwNone && w.hwNone.some(function (h) { return has(hw, h); })) return false;
    if (w.hwChosen && ((!hw.length && !assumeChosen) || (has(hw, "recommend") && !w.withRecommend))) return false;
    if (w.customOver && !((+sel.customW || 0) > w.customOver || (+sel.customH || 0) > w.customOver)) return false;
    return true;
  }
  function evaluate(sel, assumeChosen) {
    var hits = RULES.filter(function (r) { return matches(r, sel, assumeChosen); });
    return {
      hits: hits,
      invalid: hits.filter(function (r) { return r.severity === "invalid"; }),
      missing: hits.filter(function (r) { return r.severity === "missing"; }),
      blocking: hits.filter(function (r) { return r.severity === "invalid" || r.severity === "missing"; }),
      conditional: hits.filter(function (r) { return r.severity === "conditional"; }),
      notes: hits.filter(function (r) { return r.severity === "conditional" || r.severity === "note"; })
    };
  }
  function isValid(sel) { return evaluate(sel).blocking.length === 0; }
  function clone(sel) { var o = {}; for (var k in sel) o[k] = sel[k]; o.hardware = (sel.hardware || []).slice(); return o; }
  function withHw(sel, key) {
    var s = clone(sel);
    if (key === "recommend") s.hardware = ["recommend"];
    else { s.hardware = s.hardware.filter(function (h) { return h !== "recommend"; }); if (!has(s.hardware, key)) s.hardware.push(key); }
    return s;
  }
  function withoutHw(sel, key) { var s = clone(sel); s.hardware = s.hardware.filter(function (h) { return h !== key; }); return s; }
  function ids(list) { return list.map(function (r) { return r.id; }); }

  /* Display label for a hardware option in the current context (relabels depend on type/material only) */
  function label(sel, key) {
    var t = { title: HW[key] || key, sub: null, rule: null };
    var s = withHw(sel, key);
    RULES.forEach(function (r) { if (r.relabel && r.relabel.hw === key && matches(r, s)) { t.title = r.relabel.title; t.sub = r.relabel.sub; t.rule = r.id; } });
    return t;
  }

  /* Status of one hardware option: disabled (+reason), locked (+reason), note, label */
  function option(sel, key, atHardware) {
    var chosen = has(sel.hardware, key), lab = label(sel, key);
    var st = { key: key, title: lab.title, sub: lab.sub, relabeled: lab.rule, chosen: chosen, disabled: false, locked: false, reason: "", note: "" };
    if (key === "recommend") return st;
    if (!chosen) {
      var before = ids(evaluate(sel).invalid);
      var added = evaluate(withHw(sel, key)).invalid.filter(function (r) { return before.indexOf(r.id) < 0; });
      if (added.length) { st.disabled = true; st.reason = (added[0].sayFor && added[0].sayFor[key]) || added[0].say; st.rule = added[0].id; }
    } else {
      var miss0 = ids(evaluate(sel, atHardware).missing);
      var lost = evaluate(withoutHw(sel, key), atHardware).missing.filter(function (r) { return r.fix && r.fix.add === key && miss0.indexOf(r.id) < 0; });
      if (lost.length) { st.locked = true; st.reason = lost[0].say; st.lockReason = lost[0].locked || lost[0].say; st.rule = lost[0].id; }
      var notes = evaluate(sel).notes.filter(function (r) { return r.note === key; });
      if (notes.length) st.note = notes.map(function (r) { return r.say; }).join(" ");
    }
    return st;
  }
  /* Notes attached to a size choice (e.g. fire-rated pair) */
  function sizeNote(sel, size) {
    var s = clone(sel); s.size = size;
    return RULES.filter(function (r) { return r.note === "size:" + size && matches(r, s); }).map(function (r) { return r.say; }).join(" ");
  }
  function byId(id) { for (var i = 0; i < RULES.length; i++) if (RULES[i].id === id) return RULES[i]; return null; }

  /* Bring a selection back to a valid state after any change.
     Removes items that no longer work (e.g. the door became frameless glass) and adds required ones.
     Returns { sel, changes: [{ action: "removed"|"added", key, rule, say }] } */
  function normalize(sel, opts) {
    opts = opts || {};
    var s = clone(sel), changes = [], guard = 0;
    s.hardware = s.hardware.map(function (h) { return KEY_OF[h] || h; });
    for (;;) {
      if (++guard > 20) break;
      var ev = evaluate(s);
      if (ev.invalid.length) {
        var r = ev.invalid[0], keys = (r.when.hwAny || r.when.hwAll || []).filter(function (h) { return has(s.hardware, h); });
        var drop = r.when.hwAll ? s.hardware.filter(function (h) { return has(keys, h); }).pop() : keys[0];
        if (!drop) break;
        s.hardware = s.hardware.filter(function (h) { return h !== drop; });
        changes.push({ action: "removed", key: drop, rule: r.id, say: (r.sayFor && r.sayFor[drop]) || r.say });
        continue;
      }
      var add = evaluate(s, !!opts.atHardware && !s.hardware.length).missing.filter(function (m) { return m.fix && m.fix.add; });
      if (opts.atHardware && add.length) {
        s.hardware.unshift(add[0].fix.add);
        changes.push({ action: "added", key: add[0].fix.add, rule: add[0].id, say: add[0].say });
        continue;
      }
      break;
    }
    return { sel: s, changes: changes };
  }

  /* Plain-English notes for the summary / quote request */
  function notes(sel) {
    var seen = {}, out = [];
    evaluate(sel).notes.forEach(function (r) { if (r.relabel && !r.noteInSummary) return; if (!seen[r.say]) { seen[r.say] = 1; out.push(r.say); } });
    return out;
  }

  return { RULES: RULES, HW: HW, KEY_OF: KEY_OF, hwKeys: hwKeys, matches: matches, evaluate: evaluate, isValid: isValid,
    label: label, option: option, sizeNote: sizeNote, normalize: normalize, notes: notes, byId: byId, withHw: withHw };
});
