/* After-hours voice line. The browser listens and speaks. Questions use the same chat
   function as typed chat, in call mode. A quote uses the same quote inbox as the forms.
   A name and a callback number are sent only on that quote request. */
(function () {
  "use strict";
  var PHONE = "270-780-3235";
  var EMAIL = "sonya@bluegrassdoor.com";
  var CHAT_URL = "https://esrwugfaqlwttxmfkpkx.supabase.co/functions/v1/chat";
  var QUOTE_API = { url: "https://esrwugfaqlwttxmfkpkx.supabase.co/rest/v1/quote_requests", key: "sb_publishable_aOUQv3tbsDOP4eTDjbyA6w_RKZBxx8K" };
  var GREETING = "Hi, this is Dory on the after-hours line for Bluegrass Commercial Door and More. I can help with doors, frames, and hardware, and I can take a quote request. What do you need?";
  var URGENT_LINE = "For a broken or urgent door, please call 270-780-3235 now.";
  var PERSON_LINE = "You can reach the office at 270-780-3235. I can log a callback request. Would you like me to take your name and number?";
  var ASK = {
    name: "What's your name?",
    phone: "What's the best callback number?",
    type: "What kind of door is it? For example, storefront, hollow metal, fire-rated, security, a swing door, or a barn door.",
    size: "Do you know the size? If not, say not sure.",
    city: "What city is the job in?",
    when: "When do you need it? As soon as possible, within a month, one to three months, or planning and bidding?"
  };
  var S = window.DoorSpec;
  var $ = function (s) { return document.querySelector(s); };
  var root, kicker, status, rings, captions, fallback, typeBtn, muteBtn, endBtn;
  var rec, stage, kind, offerKind, bag, muted, ended, speaking, startedAt;
  var ref = "", tries = 0, sending = false, voiceLog = [], turn = 0;

  function blank() { return { name: "", phone: "", type: "", typeId: "", size: "", city: "", when: "", whenRaw: "" }; }
  function canHear() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !!(window.speechSynthesis && window.SpeechSynthesisUtterance); }
  function track(name, props) { if (window.BGD_CALL_EVENT) window.BGD_CALL_EVENT(name, props); }
  function clean(s) { return String(s || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim(); }

  function maskUtterance(s) {
    var t = clean(s);
    t = t.replace(/[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}/gi, "[email]");
    t = t.replace(/(?:\d[\s().-]*){7,}/g, "[number]");
    t = t.replace(/\bmy name is\s+[A-Za-z][A-Za-z' -]{0,60}/gi, "my name is [name]");
    if (bag && bag.name && bag.name.length > 1) {
      t = t.replace(new RegExp(bag.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "[name]");
    }
    return t;
  }

  function sayPhone(p) {
    var d = String(p || "").replace(/\D/g, "");
    if (d.length === 10) return d.slice(0, 3) + ", " + d.slice(3, 6) + ", " + d.slice(6);
    if (d.length === 11 && d.charAt(0) === "1") return sayPhone(d.slice(1));
    return d.split("").join(", ");
  }
  function spellRef(r) {
    return String(r || "").split("").map(function (ch) { return ch === "-" ? "dash" : ch; }).join(", ");
  }

  function line(who, text) {
    if (!captions) return;
    var p = document.createElement("p");
    p.className = "vline__line vline__line--" + who;
    p.textContent = text;
    captions.appendChild(p);
    while (captions.children.length > 8) captions.removeChild(captions.firstChild);
    captions.scrollTop = captions.scrollHeight;
  }

  function speak(text, done) {
    line("dory", text);
    speaking = true;
    if (rec) { try { rec.stop(); } catch (e) {} }
    var synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance || ended) { speaking = false; if (done) done(); return; }
    try { synth.cancel(); } catch (e2) {}
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1;
    var finished = false;
    function fin() {
      if (finished) return;
      finished = true;
      speaking = false;
      if (done) done();
    }
    u.onstart = function () {
      if (kicker) kicker.textContent = "On the line";
      if (rings) rings.hidden = true;
    };
    u.onend = fin;
    u.onerror = fin;
    try { synth.speak(u); } catch (e3) { fin(); }
  }

  function listen() {
    if (!rec || muted || ended || speaking || stage === "done") return;
    try { rec.start(); } catch (e) {}
  }

  function setupRec() {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    var r = new Ctor();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = function (ev) {
      var i, res, text = "";
      for (i = ev.resultIndex; i < ev.results.length; i++) {
        res = ev.results[i];
        text = res[0] && res[0].transcript ? res[0].transcript : "";
        if (res.isFinal && clean(text)) hear(text);
      }
    };
    r.onerror = function (ev) {
      if (ev && (ev.error === "not-allowed" || ev.error === "service-not-allowed")) showFallback("The microphone is blocked. You can type to Dory instead.");
    };
    r.onend = function () { if (!speaking && !muted && !ended) listen(); };
    return r;
  }

  function urgent(text) {
    return /(broken|break[- ]?in|won'?t (close|lock|latch)|can'?t (close|lock|latch)|doesn'?t (close|lock|latch)|stuck|damag|urgent|smash|kicked|unsecur)/i.test(text);
  }
  function wantsPerson(text) {
    return /talk to (a |the )?(person|human|someone|somebody)|speak (to|with) (a |the )?(person|human|someone)|real person|someone from the office|talk to the office/i.test(text);
  }
  function wantsQuote(text) {
    return /\b(quote request|a quote|an estimate)\b|\b(need|want|get|take|send) (me |us )?a quote\b|request a quote/i.test(text);
  }
  function isYes(text) { return /^(yes|yeah|yep|yup|sure|please|ok|okay|correct|right|go ahead|send it|do it|that'?s right|sounds good)\b/i.test(clean(text)); }
  function isNo(text) { return /^(no|nope|nah|wrong|change|wait|hold on|not yet|don'?t)\b/i.test(clean(text)); }

  function doorType(s) {
    var t = s.toLowerCase();
    if (/flag ?pole/.test(t)) return { id: "flagpole", label: "Flagpole" };
    if (/storefront|entrance/.test(t)) return { id: "storefront", label: "Storefront / Entrance" };
    if (/fire/.test(t)) return { id: "fire", label: "Fire-Rated Door" };
    if (/safe room|security/.test(t)) return { id: "security", label: "Security / Safe Room" };
    if (/barn|sliding/.test(t)) return { id: "barn", label: "Sliding Barn Door" };
    if (/swing/.test(t)) return { id: "swing", label: "Interior / Exterior Swing" };
    if (/hollow|steel|metal/.test(t)) return { id: "hollow", label: "Hollow Metal / Steel" };
    return { id: "quote-request", label: clean(s).slice(0, 80) || "Quote request" };
  }
  function sizeOf(s) {
    if (/not sure|don'?t know|do not know|no idea|unknown|unsure|no size/i.test(s)) return "Not sure";
    return clean(s).slice(0, 80);
  }
  function timeline(s) {
    var t = s.toLowerCase();
    if (/plan|bid/.test(t)) return "Planning / bidding";
    if (/one to three|1\s*[-–to]{1,3}\s*3|three month/.test(t)) return "1\u20133 months";
    if (/month/.test(t)) return "Within 1 month";
    if (/soon|asap|as soon|right away/.test(t)) return "As soon as possible";
    return "";
  }
  function fieldOf(s) {
    var t = s.toLowerCase();
    if (/\bname\b/.test(t)) return "name";
    if (/phone|number|callback/.test(t)) return "phone";
    if (/\bsize\b/.test(t)) return "size";
    if (/city|town|location/.test(t)) return "city";
    if (/timeline|when|month|soon|bidding/.test(t)) return "when";
    if (/door|type|flagpole|storefront|hollow|barn/.test(t)) return "type";
    return "";
  }

  function ask(step) {
    stage = step;
    speak(ASK[step], listen);
  }
  function beginIntake(nextKind) {
    kind = nextKind;
    bag = blank();
    ref = "";
    tries = 0;
    ask("name");
  }
  function readback() {
    var text;
    stage = "confirm";
    if (kind === "callback") text = "Here's the callback. " + bag.name + ", at " + sayPhone(bag.phone) + ". Should I send this to the office?";
    else text = "Here's what I have. " + bag.name + ". Callback " + sayPhone(bag.phone) + ". " + bag.type + ". Size " + bag.size + ". Job in " + bag.city + ". Timeline " + (bag.when || bag.whenRaw) + ". Should I send this quote request?";
    speak(text, listen);
  }
  function takeField(step, text) {
    var t = clean(text), door, digits;
    if (!t) { speak("I didn't catch that. " + ASK[step], listen); return; }
    if (step === "name") {
      if (!/[A-Za-z]/.test(t) || t.length > 80) { speak("Please say the name we should put on the request. " + ASK.name, listen); return; }
      bag.name = t.slice(0, 80);
    } else if (step === "phone") {
      digits = t.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) { speak("I need a callback number with at least 7 digits. " + ASK.phone, listen); return; }
      bag.phone = t.slice(0, 40);
    } else if (step === "type") {
      door = doorType(t);
      bag.type = door.label;
      bag.typeId = door.id;
    } else if (step === "size") {
      bag.size = sizeOf(t);
    } else if (step === "city") {
      bag.city = (/not sure|don'?t know/i.test(t) ? "Not sure" : t.slice(0, 80));
    } else if (step === "when") {
      bag.whenRaw = t.slice(0, 80);
      bag.when = timeline(t);
    }
    advance(step);
  }
  function advance(step) {
    if (kind === "callback") {
      if (step === "name") ask("phone");
      else readback();
      return;
    }
    var order = ["name", "phone", "type", "size", "city", "when"];
    var i = order.indexOf(step);
    if (i < order.length - 1) ask(order[i + 1]);
    else readback();
  }

  function notes() {
    var parts = ["Phone (Dory)."];
    if (kind === "callback") {
      parts.push("Callback request. The caller asked to talk with a person.");
      return parts.join(" ");
    }
    if (bag.typeId === "flagpole") parts.push("Flagpole quote.");
    parts.push("Door: " + bag.type + ".");
    parts.push("Size: " + bag.size + ".");
    parts.push("City: " + bag.city + ".");
    if (bag.whenRaw) parts.push("Timeline: " + bag.whenRaw + ".");
    return parts.join(" ");
  }
  function submit() {
    if (sending || !S || !S.newRef || !S.unpackContact) {
      speak("I couldn't send that just now. Please call " + PHONE + ".", listen);
      return;
    }
    if (!ref) ref = S.newRef();
    var contact = S.unpackContact({ n: bag.name, p: bag.phone, a: bag.city, tl: bag.when, x: notes() });
    var page = location.href.split("#")[0];
    var base = page.split("?")[0].replace(/[^/]*$/, "");
    var row = {
      reference: ref,
      name: contact.n,
      company: null,
      phone: contact.p || null,
      email: null,
      project_location: contact.a || null,
      timeline: contact.tl || null,
      notes: contact.x || notes(),
      doors: [{
        door: 1, location: "", quantity: 1,
        type: bag.type || "Quote request",
        type_id: bag.typeId || "quote-request",
        material: "", material_id: "",
        size: bag.size || "", size_id: "", custom_size: false,
        width_in: null, height_in: null, width: "", height: "",
        hardware: [],
        good_to_know: ["Phone (Dory) request."]
      }],
      door_count: 1,
      total_quantity: 1,
      build_link: base + "index.html#builder",
      office_link: page,
      user_agent: String(navigator.userAgent || "").slice(0, 400)
    };
    sending = true;
    var retry = tries > 0;
    tries++;
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    fetch(QUOTE_API.url, {
      method: "POST", mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined,
      headers: { "Content-Type": "application/json", apikey: QUOTE_API.key, Prefer: "return=minimal" },
      body: JSON.stringify(row)
    }).then(function (r) {
      clearTimeout(timer);
      sending = false;
      if (r.ok || (r.status === 409 && retry)) {
        stage = "done";
        track("quote_from_call", { kind: kind === "callback" ? "callback" : "quote" });
        if (!ended) speak("Your " + (kind === "callback" ? "callback request" : "quote request") + " is in. The reference is " + spellRef(row.reference) + ". The office will follow up.", listen);
        return;
      }
      if (r.status === 409) { ref = S.newRef(); submit(); return; }
      throw new Error("HTTP " + r.status);
    }).catch(function () {
      clearTimeout(timer);
      sending = false;
      stage = "confirm";
      speak("I couldn't send that just now. Please call " + PHONE + ", or say yes and I will try again.", listen);
    });
  }

  function sessionId() {
    var k = "";
    try { k = sessionStorage.getItem("bgd-voice") || ""; } catch (e) { k = ""; }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(k)) {
      k = ("v" + Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      try { sessionStorage.setItem("bgd-voice", k); } catch (e2) {}
    }
    return k;
  }
  function localAnswer(text) {
    var t = text.toLowerCase();
    if (/flag ?pole|\bflags?\b/.test(t)) return "Yes, we install flagpoles. They're built for tough weather, for American and state flags. I can take a quote request on this line.";
    if (/closer/.test(t)) return "A door closer is hardware we offer, controlled self-closing. It is not an automatic or power operator. I can take a quote request if you want one on a door.";
    if (/hour|schedul|appointment|\bopen\b/.test(t)) return "Our hours aren't listed online. For a person, call " + PHONE + ". I can also take a quote request on this line.";
    if (/where|address|bowling|warren|service area|\barea\b/.test(t)) return "The shop is at 930 Gordon Avenue in Bowling Green, Kentucky. We serve Warren County and the surrounding area. I can take a quote request if you'd like.";
    if (/partition/.test(t)) return "We do partitions. Call " + PHONE + " or email " + EMAIL + " about those. I can still take a door quote request on this line.";
    if (/price|cost|how much|estimate|\bbid\b/.test(t)) return "We don't give prices on this line. Every opening is quoted on its own. I can take a quote request, and the office follows up.";
    if (/fire|\bcode\b/.test(t)) return "We provide code-compliant fire-rated doors, plus hollow metal doors and frames. These are general notes, not legal advice. Your local inspector has the final say.";
    if (/hardware|frame|service|door|what do you/.test(t)) return "We do doors, frames, hardware, partitions, and flagpoles, for commercial and residential work. I can take a quote request on this line.";
    return "I can help with doors, frames, and hardware. For anything else, call " + PHONE + ". I can also take a quote request.";
  }
  function withOffer(reply) {
    if (/callback request/i.test(reply)) offerKind = "callback";
    else if (/quote request/i.test(reply) || reply.length <= 240) offerKind = "quote";
    if (/quote request|callback request/i.test(reply) || reply.length > 240) return reply;
    return reply.replace(/\s+$/, "") + " I can take a quote request on this line if you'd like.";
  }
  function remember(role, text) {
    text = maskUtterance(text).slice(0, role === "user" ? 600 : 400);
    if (!text) return;
    voiceLog.push({ role: role, content: text });
    if (voiceLog.length > 8) voiceLog = voiceLog.slice(-8);
  }
  function askBrain(text) {
    var mine = turn;
    var masked = maskUtterance(text);
    remember("user", masked);
    function sayLocal() {
      if (mine !== turn || ended || stage !== "talk") return;
      speak(withOffer(localAnswer(text)), listen);
    }
    if (!window.fetch || !window.AbortController) { sayLocal(); return; }
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 8000);
    var msgs = voiceLog.filter(function (m) { return m && m.content; }).slice(-8);
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    fetch(CHAT_URL, {
      method: "POST", mode: "cors", credentials: "omit", signal: ctl.signal,
      headers: { "Content-Type": "application/json", apikey: QUOTE_API.key },
      body: JSON.stringify({ messages: msgs, sessionId: sessionId(), mode: "call" })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      clearTimeout(timer);
      if (mine !== turn || ended || stage !== "talk") return;
      var reply = d && !d.fallback && typeof d.reply === "string" ? clean(d.reply) : "";
      if (!reply) { sayLocal(); return; }
      reply = withOffer(reply);
      remember("assistant", reply);
      speak(reply, listen);
    }).catch(function () {
      clearTimeout(timer);
      sayLocal();
    });
  }

  function hear(text) {
    turn++;
    var t = clean(text);
    if (!t || ended || sending) return;
    line("you", t);
    if (urgent(t) && stage !== "phone") {
      speak(URGENT_LINE + (stage === "talk" || stage === "done" ? "" : " " + (ASK[stage] || "")), listen);
      return;
    }
    if (stage === "name" || stage === "phone" || stage === "type" || stage === "size" || stage === "city" || stage === "when") {
      if (stage !== "phone" && wantsPerson(t)) { offerKind = "callback"; stage = "talk"; speak(PERSON_LINE, listen); return; }
      takeField(stage, t);
      return;
    }
    if (stage === "fix") {
      var which = fieldOf(t);
      if (kind === "callback" && which !== "name" && which !== "phone") which = "";
      if (!which) { speak(kind === "callback" ? "You can change the name or the number." : "You can change the name, the number, the door, the size, the city, or the timeline.", listen); return; }
      ask(which);
      return;
    }
    if (stage === "confirm") {
      var jump = fieldOf(t);
      if (isNo(t) || (jump && !isYes(t))) {
        if (jump && (kind !== "callback" || jump === "name" || jump === "phone")) { ask(jump); return; }
        stage = "fix";
        speak(kind === "callback" ? "What should I change, the name or the number?" : "What should I change?", listen);
        return;
      }
      if (isYes(t)) { submit(); return; }
      speak("Should I send it? Say yes, or tell me what to change.", listen);
      return;
    }
    if (wantsPerson(t)) { offerKind = "callback"; speak(PERSON_LINE, listen); return; }
    if (wantsQuote(t)) { beginIntake("quote"); return; }
    if (isYes(t) && offerKind) { beginIntake(offerKind === "callback" ? "callback" : "quote"); return; }
    askBrain(t);
  }

  function showFallback(msg) {
    if (fallback) { fallback.hidden = false; fallback.textContent = msg || "Voice isn't available in this browser. You can type to Dory instead."; }
    if (typeBtn) typeBtn.hidden = false;
    if (muteBtn) muteBtn.hidden = true;
    if (rings) rings.hidden = true;
    if (kicker) kicker.textContent = "Dory";
    if (status) status.textContent = "Typed chat is available";
  }
  function openCall() {
    if (!root || !root.hidden) return;
    ended = false;
    muted = false;
    speaking = false;
    sending = false;
    stage = "talk";
    kind = "quote";
    offerKind = "";
    bag = blank();
    ref = "";
    tries = 0;
    voiceLog = [];
    startedAt = Date.now();
    root.hidden = false;
    document.body.classList.add("vline-open");
    captions.textContent = "";
    if (muteBtn) { muteBtn.hidden = false; muteBtn.textContent = "Mute"; muteBtn.setAttribute("aria-pressed", "false"); }
    if (typeBtn) typeBtn.hidden = true;
    if (fallback) fallback.hidden = true;
    if (!canHear()) {
      showFallback();
      track("call_start", { voice: false });
      if (endBtn) endBtn.focus();
      return;
    }
    if (kicker) kicker.textContent = "Calling";
    if (status) status.textContent = "Bluegrass Commercial Door & More";
    if (rings) rings.hidden = false;
    track("call_start", { voice: true });
    if (!rec) rec = setupRec();
    speak(GREETING, listen);
    if (endBtn) endBtn.focus();
  }
  function endCall() {
    if (!root || root.hidden) return;
    ended = true;
    if (rec) { try { rec.stop(); } catch (e) {} }
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e2) {} }
    track("call_end", { seconds: Math.max(0, Math.round((Date.now() - (startedAt || Date.now())) / 1000)) });
    root.hidden = true;
    document.body.classList.remove("vline-open");
  }
  function typeInstead() {
    endCall();
    var btn = $("#chat-open");
    if (btn) btn.click();
  }

  function boot() {
    root = $("#vline");
    if (!root) return;
    kicker = $("#vline-kicker");
    status = $("#vline-status");
    rings = $("#vline-rings");
    captions = $("#vline-captions");
    fallback = $("#vline-fallback");
    typeBtn = $("#vline-type");
    muteBtn = $("#vline-mute");
    endBtn = $("#vline-end");
    document.querySelectorAll("[data-open-call]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); openCall(); });
    });
    if (muteBtn) muteBtn.addEventListener("click", function () {
      muted = !muted;
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn.textContent = muted ? "Unmute" : "Mute";
      if (muted && rec) { try { rec.stop(); } catch (e) {} }
      else listen();
    });
    if (endBtn) endBtn.addEventListener("click", endCall);
    if (typeBtn) typeBtn.addEventListener("click", typeInstead);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && root && !root.hidden) endCall();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.BGD_CALL = { open: openCall, end: endCall, hear: hear };
})();
