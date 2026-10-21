/*!
 * Bluegrass Commercial Door & More: local & state code suggestions for the door builder.
 * Short, plain-English things worth checking with the inspector for the doors a customer built,
 * each with the code section and a link to the source. Suggestions only: nothing here blocks a
 * choice or a quote request, and the local inspector (authority having jurisdiction) has the final say.
 *
 * Codes these notes are based on (checked Sep 2026):
 *   Kentucky, commercial   815 KAR 7:120 = 2018 Kentucky Building Code (KBC) 4th Ed., based on the 2015 IBC.
 *                          Uniform statewide: local governments can't adopt a different building code.
 *   Kentucky, homes        815 KAR 7:125 = 2018 Kentucky Residential Code (KRC) 3rd Ed., based on the 2015 IRC.
 *   Kentucky, existing     815 KAR 10:060 Kentucky Standards of Safety (NFPA 1 and NFPA 101), State Fire Marshal.
 *   Tennessee, commercial  Rule 0780-02-02-.01: 2021 IBC with changes (Chapter 11 removed, Section 423 not required);
 *                          local jurisdictions that enforce their own current codes are exempt.
 *   Tennessee, homes       State Fire Marshal residential program: 2018 IRC (new homes and additions; local opt-out).
 *   Everywhere             2010 ADA Standards for Accessible Design; NFPA 80 (fire doors); FEMA P-361 / P-320 and ICC 500 (safe rooms).
 *
 * Each rule: id, where (jurisdiction groups), use ("business" | "home" | "both"), when(door, ctx) for door rules
 * (project rules have no when), and say(ctx, doorInfo) returning the text; src(ctx) returns [{cite, url}].
 * Works in the browser (window.CodeChecks) and in Node (module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CodeChecks = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NOTE = "Suggestions only. Your local inspector has the final say. This isn't legal advice.";
  var PHONE = "270-780-3235";

  /* where the job is */
  var JURIS = [
    { v: "warren", t: "Warren County, KY", g: "ky" },
    { v: "bg", t: "Bowling Green (inside city limits)", g: "ky" },
    { v: "county", t: "Warren County, outside Bowling Green", g: "ky" },
    { v: "ky", t: "Elsewhere in Kentucky", g: "ky" },
    { v: "tn", t: "Tennessee", g: "tn" },
    { v: "other", t: "Somewhere else", g: "other" }
  ];
  var DEFAULT_JURIS = "warren";
  var USES = [{ v: "business", t: "Business" }, { v: "home", t: "Home" }];

  /* sources */
  var U = {
    kbcReg: "https://apps.legislature.ky.gov/law/kar/titles/815/007/120/",
    kbc: "https://dhbc.ky.gov/Documents/2018%20Kentucky%20Building%20Code%204th%20Ed.pdf",
    krcReg: "https://apps.legislature.ky.gov/law/kar/titles/815/007/125/",
    krc: "https://dhbc.ky.gov/Documents/2018%20Kentucky%20Residential%20Code%203d%20Ed.pdf",
    dhbc: "https://dhbc.ky.gov/newstatic_info.aspx?static_id=297",
    dhbcList: "https://dhbc.ky.gov/Documents/Find%20Currently%20Enforced%20Code.pdf",
    kyFire: "https://apps.legislature.ky.gov/law/kar/titles/815/010/060/",
    bg: "https://www.bgky.org/ncs/building",
    bgPermits: "https://www.bgky.org/ncs/building/permits",
    warren: "https://www.warrencountyky.gov/departments/public-works/building-services/",
    hpb: "https://www.warrenpc.org/historic-preservation-board/",
    tnRule: "https://publications.tnsosfiles.com/rules/0780/0780-02/0780-02-02.20250417.pdf",
    tnRes: "https://www.tn.gov/commerce/fire/residential-permits/fire-residential-faqs.html",
    ibc15eg: "https://codes.iccsafe.org/content/IBC2015/chapter-10-means-of-egress",
    ibc15fire: "https://codes.iccsafe.org/content/IBC2015/chapter-7-fire-and-smoke-protection-features",
    ibc15glass: "https://codes.iccsafe.org/content/IBC2015/chapter-24-glass-and-glazing",
    irc15: "https://codes.iccsafe.org/content/IRC2015/chapter-3-building-planning",
    irc18: "https://codes.iccsafe.org/content/IRC2018/chapter-3-building-planning",
    ibc21eg: "https://codes.iccsafe.org/content/IBC2021P1/chapter-10-means-of-egress",
    ibc21fire: "https://codes.iccsafe.org/content/IBC2021P1/chapter-7-fire-and-smoke-protection-features",
    ibc21glass: "https://codes.iccsafe.org/content/IBC2021P1/chapter-24-glass-and-glazing",
    ada: "https://www.ada.gov/law-and-regs/design-standards/2010-stds/#404-doors-doorways-and-gates",
    nfpa80: "https://www.nfpa.org/news-blogs-and-articles/blogs/2025/04/11/fire-doors-faqs",
    fema: "https://www.fema.gov/emergency-managers/risk-management/safe-rooms/resources"
  };
  function s(cite, url) { return { cite: cite, url: url }; }

  var GLASS = ["alglass", "fullglass", "steellite", "glasslite", "frosted"];
  function has(d, label) { return (d.hardware || []).indexOf(label) > -1; }
  function isPair(d) { return d.size === "pair" || (d.size === "custom" && +d.cw >= 60); }
  function garageLoc(d) { return /garage/i.test(d.loc || ""); }
  // model-code set by state: Kentucky = 2015 IBC/IRC (as amended), Tennessee = 2021 IBC / 2018 IRC, elsewhere = 2021 IBC / 2018 IRC as the model
  function ibcEd(c) { return c.g === "ky" ? "2015" : "2021"; }
  function ibcName(c) { return c.g === "ky" ? "Kentucky Building Code (2015 IBC)" : c.g === "tn" ? "2021 IBC (Tennessee)" : "2021 IBC (model code)"; }
  function egressSrc(c) { return c.g === "ky" ? [s("KBC / 2015 IBC Chapter 10", U.ibc15eg), s("2018 Kentucky Building Code", U.kbc)] : c.g === "tn" ? [s("2021 IBC Chapter 10", U.ibc21eg), s("Tenn. Rule 0780-02-02", U.tnRule)] : [s("2021 IBC Chapter 10", U.ibc21eg)]; }

  var RULES = [
    /* ---------- project-wide: which code and who issues permits ---------- */
    { id: "ky-code", where: ["ky"], use: "both",
      say: function (c) {
        var b = "Kentucky uses one statewide building code for commercial work: the 2018 Kentucky Building Code, based on the 2015 International Building Code. Cities and counties can't adopt a different one.";
        var h = "Homes fall under the 2018 Kentucky Residential Code, based on the 2015 International Residential Code.";
        return c.use === "business" ? b : c.use === "home" ? h.replace("Homes fall", "Homes in Kentucky fall") : b + " " + h;
      },
      src: function (c) { var o = []; if (c.use !== "home") o.push(s("815 KAR 7:120", U.kbcReg)); if (c.use !== "business") o.push(s("815 KAR 7:125", U.krcReg)); o.push(s("Ky. Dept. of Housing, Buildings & Construction", U.dhbc)); return o; } },
    { id: "bg-permit", where: ["bg", "warren"], use: "both",
      say: function (c) { return (c.juris === "warren" ? "If the job is inside Bowling Green city limits: the" : "The") + " Bowling Green Building Division issues building permits, reviews plans and does inspections. The city says a permit is needed to build, enlarge, alter, repair or tear down a structure, or to change a building's use. Worth checking with them whether your door job needs one."; },
      src: function () { return [s("City of Bowling Green: building permits", U.bgPermits), s("Bowling Green Building Division", U.bg)]; } },
    { id: "warren-permit", where: ["county", "warren"], use: "both",
      say: function (c) { return (c.juris === "warren" ? "If the job is in Warren County outside Bowling Green (and Oakland): " : "") + "Warren County Public Works Building Services enforces the Kentucky codes for new construction, alterations and changes of occupancy in the county outside Bowling Green and Oakland. Worth a call to see whether your job needs a permit."; },
      src: function () { return [s("Warren County Building Services", U.warren)]; } },
    { id: "ky-plan-review", where: ["ky"], use: "business",
      say: function () { return "For commercial buildings, the Kentucky Building Code requires a permit to construct, alter or repair (105.1). Plans for business, mercantile, assembly and factory buildings up to 100 occupants are reviewed by the local program where there is one (104.15); larger buildings, schools, and institutional and high-hazard buildings go to the state (104.16)."; },
      src: function () { return [s("KBC 104.15, 104.16, 105.1", U.kbc)]; } },
    { id: "ky-home-permit", where: ["ky"], use: "home",
      say: function () { return "Kentucky doesn't require a state permit, inspection or certificate of occupancy for a single-family home unless a local ordinance does. Worth asking your city or county whether they require one."; },
      src: function () { return [s("815 KAR 7:125 Section 2(2)(a)", U.krcReg)]; } },
    { id: "tn-code", where: ["tn"], use: "both",
      say: function (c) {
        var b = "For commercial work, Tennessee's State Fire Marshal enforces the 2021 International Building Code with state changes, but cities and counties that enforce their own current codes are exempt. Check with the local building department first.";
        var h = "For homes, the state program uses the 2018 International Residential Code for new homes and additions (not renovations), and cities and counties can opt out or run their own codes.";
        return c.use === "business" ? b : c.use === "home" ? h : b + " " + h;
      },
      src: function (c) { var o = []; if (c.use !== "home") o.push(s("Tenn. Rule 0780-02-02-.01", U.tnRule)); if (c.use !== "business") o.push(s("Tenn. State Fire Marshal: residential permits", U.tnRes)); return o; } },
    { id: "other-code", where: ["other"], use: "both",
      say: function () { return "Most places in the U.S. base their rules on the International Building Code and International Residential Code, but the edition and local changes vary. Your local building department can tell you which apply and whether the job needs a permit."; },
      src: function () { return [s("2021 IBC Chapter 10 (model code)", U.ibc21eg), s("2018 IRC Chapter 3 (model code)", U.irc18)]; } },
    { id: "bg-historic", where: ["bg", "warren"], use: "both", door: true,
      when: function (d) { return d.type === "storefront" || d.type === "swing"; },
      say: function () { return "If the building has a local historic designation (for example in the Downtown Commercial Local Historic District), exterior changes such as a new entrance door need a Certificate of Appropriateness application to the City-County Planning Commission before the work."; },
      src: function () { return [s("CCPC Historic Preservation Board", U.hpb)]; } },

    /* ---------- fire doors ---------- */
    { id: "fire-close-latch-label", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return d.type === "fire"; },
      say: function (c, x) {
        var sec = c.g === "ky" ? "716.5, 716.5.7, 716.5.9" : "716.2.6.1, 716.2.6.2, 716.2.9";
        return "Fire doors are installed to NFPA 80, need a permanent label from an approved agency, and must be self- or automatic-closing with an active latch bolt" + (x.pair ? " (both leaves of a pair)" : "") + " (" + ibcName(c) + " " + sec + ").";
      },
      src: function (c) { return c.g === "ky" ? [s("KBC / 2015 IBC 716.5", U.ibc15fire)] : [s("2021 IBC 716.2", U.ibc21fire)]; } },
    { id: "nfpa80-annual", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return d.type === "fire"; },
      say: function () { return "NFPA 80 calls for fire doors to be inspected and tested right after installation and at least once a year after that, and the labels have to stay legible."; },
      src: function () { return [s("NFPA: fire door FAQs (NFPA 80)", U.nfpa80)]; } },
    { id: "ky-fire-marshal", where: ["ky"], use: "business", door: true,
      when: function (d) { return d.type === "fire"; },
      say: function () { return "In existing buildings, the State Fire Marshal and the local fire official enforce the Kentucky Standards of Safety (based on NFPA 1 and NFPA 101) for continued fire safety, so they may look at fire doors too."; },
      src: function () { return [s("815 KAR 10:060", U.kyFire), s("KBC 101.5", U.kbc)]; } },

    /* ---------- exits (commercial) ---------- */
    { id: "egress-panic-swing", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return isPair(d) || has(d, "Panic / exit device") || d.type === "storefront"; },
      say: function (c) {
        var ed = c.g === "ky" ? { swing: "1010.1.2.1", panic: "1010.1.10" } : { swing: "1010.1.2.1", panic: "1010.2.9" };
        return "If the space holds 50 or more people (or is high-hazard), exit doors must swing in the direction people leave (" + ed.swing + "). In assembly and school spaces with 50 or more people, and high-hazard spaces, a door with a latch or lock must use panic or fire exit hardware (" + ed.panic + ").";
      },
      src: egressSrc },
    { id: "egress-size", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return d.size === "custom" || isPair(d); },
      say: function (c, x) {
        var t = "Exit doors need at least 32\" of clear width with the door open 90\u00b0, no leaf wider than 48\", and at least 80\" of height; in a pair, one leaf on its own must give the 32\" (" + ibcName(c) + " 1010.1.1).";
        if (x.short) t += " Your custom height is under 80\".";
        if (x.narrow) t += " Your custom width is under 32\".";
        return t;
      },
      src: egressSrc },
    { id: "egress-no-key", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return has(d, "Deadbolt") || has(d, "Keypad / access control"); },
      say: function (c) {
        var sec = c.g === "ky" ? ["1010.1.9", "1010.1.9.3"] : ["1010.2", "1010.2.4"];
        return "Exit doors must open from the inside without a key, special knowledge or effort (" + sec[0] + "). A key-locked main entrance is allowed in some uses (for example offices, stores and smaller assembly spaces) only with a sign reading \u201cTHIS DOOR TO REMAIN UNLOCKED WHEN THIS SPACE IS OCCUPIED\u201d (" + sec[1] + ").";
      },
      src: egressSrc },

    /* ---------- accessibility (commercial) ---------- */
    { id: "ada-hardware", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return (d.hardware || []).length > 0; },
      say: function (c) {
        var ibc = c.g === "ky" ? "IBC 1010.1.9.1, 1010.1.9.2" : "IBC 1010.2.2, 1010.2.3";
        return "Handles, pulls, latches and locks must work with one hand without tight grasping, pinching or twisting of the wrist, and sit 34\" to 48\" above the floor (2010 ADA 404.2.7 and 309.4; " + ibc + ").";
      },
      src: function (c) { return [s("2010 ADA Standards 404", U.ada)].concat(c.g === "ky" ? [s("KBC / 2015 IBC Chapter 10", U.ibc15eg)] : [s("2021 IBC Chapter 10", U.ibc21eg)]); } },
    { id: "ada-clearances", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return d.type !== "barn"; },
      say: function (c) {
        return "For accessibility: 32\" of clear width, a threshold no higher than 1/2\" (3/4\" beveled for existing or altered doors), clear floor space to open the door, and interior doors that open with 5 pounds of force or less (2010 ADA 404.2.3, 404.2.4, 404.2.5, 404.2.9)." +
          (c.g === "ky" ? " Kentucky's adopted codes also include ICC A117.1-2009 (KBC 1101.2)." : "");
      },
      src: function (c) { return [s("2010 ADA Standards 404", U.ada)].concat(c.g === "ky" ? [s("Kentucky codes currently enforced", U.dhbcList)] : []); } },
    { id: "ada-closer", where: ["ky", "tn", "other"], use: "business", door: true,
      when: function (d) { return has(d, "Door closer") || d.type === "fire"; },
      say: function () { return "With a door closer, the door should take at least 5 seconds to move from 90\u00b0 open to 12\u00b0 from the latch (2010 ADA 404.2.8.1)."; },
      src: function () { return [s("2010 ADA Standards 404.2.8.1", U.ada)]; } },

    /* ---------- glass ---------- */
    { id: "safety-glazing", where: ["ky", "tn", "other"], use: "both", door: true,
      when: function (d) { return GLASS.indexOf(d.material) > -1; },
      say: function (c) {
        var ibc = ibcName(c) + " 2406.4.1, 2406.4.2";
        var irc = (c.g === "ky" ? "Kentucky Residential Code / 2015 IRC" : "2018 IRC") + " R308.4.1, R308.4.2";
        var cite = c.use === "business" ? ibc : c.use === "home" ? irc : ibc + "; homes: " + irc;
        return "Glass in a door counts as a hazardous location, so it has to be safety glazing. The same goes for glass within 24\" of the door's edge and less than 60\" above the floor (" + cite + ").";
      },
      src: function (c) {
        var o = [];
        if (c.use !== "home") o.push(c.g === "ky" ? s("KBC / 2015 IBC 2406", U.ibc15glass) : s("2021 IBC 2406", U.ibc21glass));
        if (c.use !== "business") o.push(c.g === "ky" ? s("2015 IRC R308", U.irc15) : s("2018 IRC R308", U.irc18));
        return o;
      } },

    /* ---------- homes ---------- */
    { id: "home-egress-door", where: ["ky", "tn", "other"], use: "home", door: true,
      when: function (d) { return d.type === "swing" || d.type === "security" || d.type === "hollow"; },
      say: function (c) { return "Every home needs at least one side-hinged exit door with 32\" of clear width (door open 90\u00b0) and 78\" of clear height that opens from the inside without a key or special effort (" + (c.g === "ky" ? "Kentucky Residential Code R311.2" : "2018 IRC R311.2") + ")."; },
      src: function (c) { return c.g === "ky" ? [s("Kentucky Residential Code R311.2", U.krc)] : [s("2018 IRC R311.2", U.irc18)]; } },
    { id: "garage-to-house", where: ["ky", "tn", "other"], use: "home", door: true,
      when: function (d) { return d.type === "swing" || d.type === "hollow" || d.type === "fire" || d.type === "security"; },
      say: function (c, x) {
        var lead = x.garage ? "This door is marked as a garage door, so it's worth checking: " : "If this door goes between a garage and the house: ";
        if (c.g === "ky") return lead + "in Kentucky it must be solid wood or solid or honeycomb-core steel at least 1-3/8\" thick, or 20-minute fire-rated, and a garage can't open straight into a bedroom (Kentucky Residential Code R302.5.1). Kentucky's version leaves out the self-closing device the model code calls for.";
        return lead + "it must be solid wood or solid or honeycomb-core steel at least 1-3/8\" thick, or 20-minute fire-rated, with a self-closing or automatic-closing device, and a garage can't open straight into a bedroom (2018 IRC R302.5.1).";
      },
      src: function (c) { return c.g === "ky" ? [s("Kentucky Residential Code R302.5.1", U.krc)] : [s("2018 IRC R302.5.1", U.irc18)]; } },

    /* ---------- safe rooms ---------- */
    { id: "safe-room", where: ["ky", "tn", "other"], use: "both", door: true,
      when: function (d) { return d.type === "security"; },
      say: function (c) {
        var fema = "FEMA P-361 (community and residential safe rooms) and P-320 (home safe rooms) set the design criteria, and both reference ICC 500.";
        if (c.g === "ky" && c.use !== "home") return "If this door is for a storm shelter or safe room, the Kentucky Building Code requires it to be built to ICC 500 (KBC 423.1). " + fema;
        if (c.g === "tn" && c.use !== "home") return "If this door is for a storm shelter or safe room: Tennessee's state code doesn't require IBC Section 423 storm shelters, but " + fema.charAt(0).toLowerCase() + fema.slice(1);
        return "If this door is for a storm shelter or safe room: " + fema;
      },
      src: function (c) { return (c.g === "ky" && c.use !== "home" ? [s("KBC 423.1", U.kbc)] : c.g === "tn" && c.use !== "home" ? [s("Tenn. Rule 0780-02-02-.01", U.tnRule)] : []).concat([s("FEMA safe room resources", U.fema)]); } }
  ];

  /* short names (used where space is tight, e.g. an email link) */
  var TITLES = {
    "ky-code": "Kentucky statewide code", "bg-permit": "Bowling Green permit", "warren-permit": "Warren County permit",
    "ky-plan-review": "Kentucky plan review and permit (KBC 104.15, 104.16, 105.1)", "ky-home-permit": "Kentucky home permits (815 KAR 7:125)",
    "tn-code": "Tennessee: state or local code", "other-code": "Check with the local building department", "bg-historic": "Historic district approval (Certificate of Appropriateness)",
    "fire-close-latch-label": "Fire door closing, latching and label", "nfpa80-annual": "Fire door yearly inspection (NFPA 80)", "ky-fire-marshal": "Kentucky Standards of Safety (815 KAR 10:060)",
    "egress-panic-swing": "Exit door swing and panic hardware", "egress-size": "Exit door width and height (IBC 1010.1.1)", "egress-no-key": "Exit doors open without a key",
    "ada-hardware": "ADA hardware (404.2.7)", "ada-clearances": "ADA width, threshold and opening force", "ada-closer": "ADA closer timing (404.2.8.1)",
    "safety-glazing": "Safety glass in and near doors", "home-egress-door": "Home exit door (R311.2)", "garage-to-house": "Garage-to-house door (R302.5.1)",
    "safe-room": "Safe room or storm shelter (ICC 500, FEMA)"
  };
  function jurisOf(v) { for (var i = 0; i < JURIS.length; i++) if (JURIS[i].v === v) return JURIS[i]; return null; }
  /* elsewhere in Kentucky, Tennessee, and somewhere else need a zip or a place before notes can follow it */
  function needsPlace(v) { return v === "ky" || v === "tn" || v === "other"; }
  function cleanPlace(text) {
    return String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  }
  function placeLabel(text, juris) {
    var t = cleanPlace(text);
    if (!t) return (jurisOf(juris) || {}).t || "";
    if (juris === "ky" && !/\b(?:kentucky|ky)\b/i.test(t)) return t + ", Kentucky";
    if (juris === "tn" && !/\b(?:tennessee|tn)\b/i.test(t)) return t + ", Tennessee";
    if (juris === "warren" && !/\b(?:kentucky|ky)\b/i.test(t)) return t + ", Kentucky";
    return t;
  }
  function unavailableFor(label) {
    return "Code notes are not available for " + label + ". Call " + PHONE + ".";
  }
  /* The typed zip or place picks the notes. Kentucky and Tennessee use the codes already in this file.
     A place that does not match those, or Bowling Green / Warren County by name, is not guessed. */
  function resolvePlace(text, selected) {
    var raw = cleanPlace(text);
    if (!raw) return { juris: selected, label: (jurisOf(selected) || {}).t || "", available: false, place: "", needPlace: true, unavailable: "" };
    var guessed = guessJuris(raw);
    if (guessed === "warren" || guessed === "ky" || guessed === "tn") {
      return { juris: guessed, label: placeLabel(raw, guessed), available: true, place: raw, needPlace: false, unavailable: "" };
    }
    if (guessed === "other") {
      return { juris: "other", label: raw, available: false, place: raw, needPlace: false, unavailable: unavailableFor(raw) };
    }
    if (selected === "ky" || selected === "tn") {
      return { juris: selected, label: placeLabel(raw, selected), available: true, place: raw, needPlace: false, unavailable: "" };
    }
    return { juris: "other", label: raw, available: false, place: raw, needPlace: false, unavailable: unavailableFor(raw) };
  }
  /* a guess from the project address the customer typed; null when there's nothing to go on */
  function guessJuris(text) {
    var t = String(text || "");
    if (!t.trim()) return null;
    var state = null, z = /\b(\d{5})(?:-\d{4})?\b/.exec(t);
    if (z) { var p = +z[1].slice(0, 3); state = p >= 400 && p <= 427 ? "ky" : p >= 370 && p <= 385 ? "tn" : "other"; }
    if (!state && /\b(tn|tenn\.?|tennessee)\b/i.test(t)) state = "tn";
    if (!state && /\b(ky|kentucky)\b/i.test(t)) state = "ky";
    if (!state) { var sc = /,\s*([A-Za-z]{2})\.?\s*$/.exec(t.trim()); if (sc && /^(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|KS|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|TX|UT|V[AT]|W[AIVY])$/i.test(sc[1])) state = "other"; }
    if (state && state !== "ky") return state;
    // a Bowling Green mailing address can be inside or outside city limits, so it gets both the city and county notes
    if (/bowling\s*green|warren/i.test(t)) return "warren";
    return state;
  }
  /* storefront, hollow metal and fire-rated doors are commercial products; anything else could be either */
  function inferUse(doors) {
    for (var i = 0; i < (doors || []).length; i++) { var t = doors[i] && doors[i].type; if (t === "storefront" || t === "hollow" || t === "fire") return "business"; }
    return null;
  }
  function useOk(rule, use) { return rule.use === "both" || !use || rule.use === use; }

  function blankResult(j, extra) {
    var use = extra.use, inferred = extra.inferred;
    return {
      juris: j.v, jurisLabel: extra.label || j.t, place: extra.place || "", use: use, useInferred: inferred,
      items: [], note: NOTE, needPlace: !!extra.needPlace, unavailable: extra.unavailable || ""
    };
  }
  /* doors: [{type, material, size, hardware:[labels], cw, ch, loc}], opts: {juris, use, place}
     -> {juris, jurisLabel, place, use, useInferred, items:[{id, text, sources:[{cite,url}], doors:[1-based]}], note, needPlace, unavailable}
     Bowling Green and Warren County keep their notes. The other three follow the typed zip or place.
     A place with no verified code in this file does not get a guessed model code. */
  function evaluate(doors, opts) {
    opts = opts || {};
    doors = (doors || []).filter(function (d) { return d && d.type; });
    var selected = jurisOf(opts.juris) || jurisOf(DEFAULT_JURIS);
    var use = opts.use === "business" || opts.use === "home" ? opts.use : null, inferred = false;
    if (!use) { use = inferUse(doors); inferred = !!use; }
    var j = selected, label = selected.t, place = "";
    if (needsPlace(selected.v)) {
      var found = resolvePlace(opts.place, selected.v);
      if (!found.available) return blankResult(selected, { label: found.label, place: found.place, use: use, inferred: inferred, needPlace: found.needPlace, unavailable: found.unavailable });
      j = jurisOf(found.juris) || selected;
      label = found.label;
      place = found.place;
    }
    if (j.g === "other") return blankResult(j, { label: label, place: place, use: use, inferred: inferred, unavailable: unavailableFor(label || "that place") });
    var c = { juris: j.v, g: j.g, use: use };
    var items = [];
    RULES.forEach(function (r) {
      if (r.where.indexOf(c.juris) < 0 && r.where.indexOf(c.g) < 0) return;
      if (!useOk(r, use)) return;
      if (!r.door) { items.push({ id: r.id, title: TITLES[r.id] || r.id, text: r.say(c, {}), sources: r.src(c), doors: [] }); return; }
      var byText = {};
      doors.forEach(function (d, i) {
        if (!r.when(d, c)) return;
        var x = { pair: isPair(d), garage: garageLoc(d), short: d.size === "custom" && +d.ch > 0 && +d.ch < 80, narrow: d.size === "custom" && +d.cw > 0 && +d.cw < 32 };
        var text = r.say(c, x);
        if (!byText[text]) { byText[text] = { id: r.id, title: TITLES[r.id] || r.id, text: text, sources: r.src(c), doors: [] }; items.push(byText[text]); }
        byText[text].doors.push(i + 1);
      });
    });
    // notes about the doors themselves first, then where-the-job-is notes (permits, which code)
    items = items.filter(function (it) { return it.doors.length; }).concat(items.filter(function (it) { return !it.doors.length; }));
    return { juris: j.v, jurisLabel: label, place: place, use: use, useInferred: inferred, items: items, note: NOTE, needPlace: false, unavailable: "" };
  }
  function doorsLabel(item, total) {
    if (!item.doors.length || total < 2) return "";
    return (item.doors.length > 1 ? "Doors " : "Door ") + item.doors.join(", ");
  }
  function useText(res) { return res.use === "business" ? "Business" + (res.useInferred ? " (from the door types)" : "") : res.use === "home" ? "Home" : "Not said (business or home)"; }
  /* saved with a quote request */
  function record(res, total) {
    var items = res.items.map(function (it) {
      return { id: it.id, title: it.title, text: it.text, doors: doorsLabel(it, total) || (it.doors.length ? "All doors" : "Whole project"),
        source: it.sources.map(function (x) { return x.cite; }).join("; "), url: it.sources.length ? it.sources[0].url : "", sources: it.sources };
    });
    if (!items.length && (res.unavailable || res.needPlace)) {
      var why = res.unavailable || ("A zip code or the place the door will be installed was not given, so code notes were not added. Call " + PHONE + ".");
      items = [{ id: "place", title: "Code notes", text: why, doors: "Whole project", source: "", url: "", sources: [] }];
    }
    return { location: res.jurisLabel, place: res.place || "", use: res.use || "not said", use_inferred: res.useInferred, note: res.note, items: items };
  }
  /* plain text for an email or a copied summary */
  function text(res, total) {
    if (res.needPlace || res.unavailable) {
      var why = res.unavailable || ("A zip code or the place the door will be installed was not given, so code notes were not added. Call " + PHONE + ".");
      return ["LOCAL & STATE CODE: WORTH CHECKING (" + res.note + ")", "Location: " + (res.jurisLabel || "Not given"), why].join("\n");
    }
    var L = ["LOCAL & STATE CODE: WORTH CHECKING (" + res.note + ")", "Location: " + res.jurisLabel, "Building: " + useText(res)];
    res.items.forEach(function (it) {
      var dl = doorsLabel(it, total);
      L.push("- " + (dl ? dl + ": " : "") + it.text);
      L.push("  Source: " + it.sources.map(function (x) { return x.cite + " " + x.url; }).join(" | "));
    });
    return L.join("\n");
  }
  /* compact list for a mailto: body (mail apps cut long links): titles only */
  function shortText(res, total) {
    if (res.needPlace || res.unavailable) return text(res, total);
    var L = ["Local & state code, worth checking (" + res.note + ")", "Location: " + res.jurisLabel + ". Building: " + useText(res) + "."];
    res.items.forEach(function (it) { var dl = doorsLabel(it, total); L.push("- " + it.title + (dl ? " (" + dl + ")" : "")); });
    return L.join("\n");
  }
  function allSources() {
    var seen = {}, out = [];
    Object.keys(U).forEach(function (k) { if (!seen[U[k]]) { seen[U[k]] = 1; out.push(U[k]); } });
    return out;
  }
  return { NOTE: NOTE, JURIS: JURIS, USES: USES, DEFAULT_JURIS: DEFAULT_JURIS, RULES: RULES, URLS: U,
    evaluate: evaluate, guessJuris: guessJuris, inferUse: inferUse, jurisOf: jurisOf, needsPlace: needsPlace, resolvePlace: resolvePlace, record: record, text: text, shortText: shortText, TITLES: TITLES, doorsLabel: doorsLabel, useText: useText, allSources: allSources, PHONE: PHONE };
});
