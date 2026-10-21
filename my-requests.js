/* My requests: the references this browser has sent (kept in localStorage only). */
(function () {
  "use strict";
  var P = window.BGDPro, $ = P.$, esc = P.esc;
  function draw() {
    var l = P.myList(), box = $("#my-list");
    if (!l.length) {
      box.innerHTML = '<div class="pro-card my-empty"><p>No requests from this browser yet.</p><p><a class="btn btn--primary" href="index.html#builder">Build a door</a> <a class="btn btn--outline" href="service.html">Fix my door</a> <a class="btn btn--outline" href="contractors.html">Contractor fast lane</a></p></div>';
      return;
    }
    box.innerHTML = l.map(function (x) {
      var when = new Date(x.when), ok = !isNaN(when);
      var subj = encodeURIComponent("About request " + x.ref);
      return '<article class="pro-card my-item"><div class="my-item__top"><span class="tag">' + esc(x.kind) + "</span>" + (x.urgent ? ' <span class="tag tag--hot">Urgent</span>' : "") +
        '<span class="my-item__when">' + (ok ? esc(when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ", " + when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })) : "") + "</span></div>" +
        "<h2>" + esc(x.ref) + "</h2><p>" + esc(x.summary || "") + "</p>" +
        '<ol class="my-track"><li class="is-done">Sent</li><li>Office follows up</li><li>Measure / visit</li><li>Quote or repair</li></ol>' +
        '<p class="my-item__act"><a class="btn btn--primary" href="tel:+12707803235">Call about ' + esc(x.ref) + '</a> <a class="btn btn--outline" href="mailto:sonya@bluegrassdoor.com?subject=' + subj + '">Email about it</a>' +
        (x.link ? ' <a class="btn btn--text" href="' + esc(x.link) + '">' + (x.kind === "Door quote" ? "Reopen these doors" : "Open") + "</a>" : "") +
        ' <button class="btn btn--text my-del" type="button" data-ref="' + esc(x.ref) + '">Remove from this device</button></p></article>';
    }).join("");
  }
  $("#my-list").addEventListener("click", function (e) { var b = e.target.closest(".my-del"); if (!b) return; P.forget(b.getAttribute("data-ref")); draw(); });
  draw();
  P.track("myrequests_view", { count: P.myList().length });
})();
