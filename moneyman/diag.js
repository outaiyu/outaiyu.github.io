/* ════════════════════════════════════════════════════════════════════════
   DIAGNOSTICS — why did the peer link fail?

   The multiplayer layer had no failure reporting at all: you clicked JOIN,
   it said "CONNECTING…", and nothing else ever happened. On a desktop that
   is merely annoying. On an iPad, where WebRTC behaves differently, it made
   the difference between "my code is broken" and "my network is blocked"
   impossible to tell. This module answers that on the actual device.

   Nothing here is used by the game itself.
   ════════════════════════════════════════════════════════════════════════ */
const Diag = (()=>{
  const rows = [];
  const add = (name, r, extra) => {
    rows.push({ name, state: r.state, detail: r.detail || extra || "" });
  };

  const ok  = d => ({ state:"ok",   detail: d || "" });
  const bad = d => ({ state:"bad",  detail: d || "" });
  const warn= d => ({ state:"warn", detail: d || "" });

  /* Can this browser do peer-to-peer at all? Build two connections inside
     this one page and push actual bytes between them. This isolates WebRTC
     from Trystero, from the network and from the other player's device. */
  async function loopback(){
    if (typeof RTCPeerConnection === "undefined")
      return bad("RTCPeerConnection is not defined in this browser");
    let a, b;
    try {
      a = new RTCPeerConnection();
      b = new RTCPeerConnection();
      a.onicecandidate = e => { if (e.candidate) b.addIceCandidate(e.candidate).catch(()=>{}); };
      b.onicecandidate = e => { if (e.candidate) a.addIceCandidate(e.candidate).catch(()=>{}); };

      const dc = a.createDataChannel("probe");
      const opened = new Promise(res => {
        dc.onopen = () => res(true);
        dc.onerror = () => res(false);
        setTimeout(() => res(false), 9000);
      });
      const offer = await a.createOffer();
      await a.setLocalDescription(offer);
      await b.setRemoteDescription(offer);
      const answer = await b.createAnswer();
      await b.setLocalDescription(answer);
      await a.setRemoteDescription(answer);

      const pass = await opened;
      if (pass) {
        let echoed = false;
        try { dc.send("ping"); echoed = dc.readyState === "open"; } catch(e){}
        return ok("two connections in this tab exchanged data" + (echoed ? " (send ok)" : ""));
      }
      return bad("handshake never completed — local WebRTC is blocked");
    } catch (err) {
      return bad(err && err.message ? err.message : String(err));
    } finally {
      try { a && a.close(); } catch(e){}
      try { b && b.close(); } catch(e){}
    }
  }

  /* Which Nostr relays did Trystero actually reach? The wrapper in index.html
     logs every socket it opens, so this is measured, not assumed. */
  function relayReport(){
    const log = window.__RELAYLOG || [];
    if (!log.length) return warn("no relay connections attempted yet");
    const open = log.filter(r => r.state === "open");
    const fail = log.filter(r => r.state !== "open");
    if (open.length)
      return ok(open.length + " of " + log.length + " relays connected — "
              + open.slice(0,3).map(r => r.url.replace(/^wss:\/\//,"")).join(", "));
    return bad("all " + log.length + " relays failed — "
             + (fail[0] && fail[0].detail ? fail[0].detail : "no detail"));
  }

  function browser(){
    const ua = navigator.userAgent;
    let name = "unknown browser";
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) name = "iPad / iOS Safari";
    else if (/iPhone/.test(ua)) name = "iPhone / iOS Safari";
    else if (/Edg/.test(ua))  name = "Edge";
    else if (/OPR/.test(ua))  name = "Opera";
    else if (/Firefox/.test(ua)) name = "Firefox";
    else if (/Chrome/.test(ua)) name = "Chrome";
    else if (/Safari/.test(ua)) name = "Safari";
    const ios = (ua.match(/OS (\d+)[_.](\d+)/) || [])[0];
    return { name, detail: name + (ios ? " · iOS " + ios.replace(/[._]/g,".") : "")
             + " · " + navigator.hardwareConcurrency + " cores" };
  }

  /* isSecureContext is the spec-correct check, but it is not implemented
     everywhere. Fall back to the protocol so we never report a secure
     origin as insecure (or the reverse) because a property is missing. */
  function secureOrigin(){
    if(typeof window.isSecureContext === "boolean"){
      return { secure: window.isSecureContext, via: "isSecureContext" };
    }
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    const secure = location.protocol === "https:" || local;
    return { secure, via: "protocol fallback" };
  }

  async function run(reason){
    rows.length = 0;

    const sec = secureOrigin();
    add("Secure context", sec.secure ? ok(sec.via) : bad("no — WebRTC needs HTTPS or localhost"),
        sec.secure ? (location.protocol + "//" + location.hostname + " is treated as secure (" + sec.via + ")")
                   : location.protocol + " is not a secure origin — publish over https");

    const b = browser();
    add("Browser", ok(b.detail), b.detail);

    add("Trystero library", (typeof Trystero !== "undefined" && Trystero.joinRoom)
        ? ok("loaded, joinRoom present")
        : bad("did not load — trystero.js missing or blocked"),
        typeof Trystero !== "undefined" ? "global found" : "window.Trystero is undefined");

    add("crypto.subtle", (window.crypto && window.crypto.subtle) ? ok("present") : bad("missing"),
        (window.crypto && window.crypto.subtle)
          ? "Trystero needs this; absent outside a secure context"
          : "Trystero throws without it");

    add("WebRTC APIs",
        (typeof RTCPeerConnection !== "undefined" && typeof RTCDataChannel !== "undefined")
          ? ok("RTCPeerConnection + RTCDataChannel present") : bad("missing"),
        "RTCPeerConnection: " + (typeof RTCPeerConnection !== "undefined")
        + " · RTCDataChannel: " + (typeof RTCDataChannel !== "undefined"));

    const tried = (window.__RELAYLOG || []).slice(0, 4)
      .map(r => r.url.replace(/^wss:\/\//, "").split("/")[0] + ":" + r.state).join("  ");
    const rr = relayReport();
    add("Nostr relays", rr, rr.detail && tried ? rr.detail + " — " + tried : tried);

    const lb = await loopback();
    add("WebRTC self-test", lb, lb.detail);

    add("Page state", document.hidden ? warn("tab is BACKGROUNDED") : ok("tab is in the foreground"),
        document.hidden
          ? "iOS suspends JS entirely in a background tab — relay sockets drop and the room dies"
          : "foreground, connections stay alive");

    if (window.__BGWARN)
      add("Backgrounded earlier", warn("yes — the tab lost focus during this session"),
          "iOS freezes JS when you leave the page; the relay link does not survive it");

    if (reason) add("Reported problem", warn(reason), reason);

    return rows;
  }

  function show(reason){
    const el = document.getElementById("diag");
    const body = document.getElementById("diagBody");
    if (!el || !body) return;
    body.innerHTML = '<div class="fine">running…</div>';
    el.style.display = "block";
    run(reason).then(rs => {
      body.innerHTML = rs.map(r =>
        '<div class="dg ' + r.state + '"><span class="dgs">' +
        ({ ok:"OK", bad:"FAIL", warn:"WARN" }[r.state]) +
        '</span><b>' + r.name + '</b><em>' + (r.detail || "") + '</em></div>'
      ).join("");
    });
  }

  return { run, show };
})();