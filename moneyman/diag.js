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
    if (!log.length)
      return warn("no relay connections attempted yet - Trystero may not have started");
    const open = log.filter(r => r.state === "open");
    const dead = log.filter(r => r.state !== "open");
    const host = u => String(u).replace(/^wss:\/\//, "").split("/")[0];

    if (open.length){
      const times = open.map(r => r.ms || 0).sort((a, b) => a - b);
      const med = times[Math.floor(times.length / 2)];
      return ok(open.length + " of " + log.length + " relays connected (median " + med
                + "ms) - " + open.slice(0, 4).map(r => host(r.url)).join(", "));
    }

    // Every relay failed. Say which KIND of failure this is, because the two
    // causes look identical ("it failed") and need opposite fixes.
    const settled = dead.filter(r => r.ms > 0);
    const instant = settled.filter(r => r.ms < 700).length;
    const dropped = settled.length - instant;
    let why;
    if (settled.length && instant && !dropped)
      why = "ALL " + log.length + " refused within a second - blocked on this device, "
          + "not a relay problem. Ad-blockers, privacy extensions and DNS filters "
          + "routinely kill WebSockets: try a private window with extensions off.";
    else if (dropped)
      why = "ALL " + log.length + " hung instead of being refused - your network or "
          + "firewall is silently dropping the traffic.";
    else
      why = "ALL " + log.length + " relays failed, with no timing captured.";
    return bad(why + "  [" + dead.slice(0, 6).map(r => host(r.url) + " " + r.ms + "ms").join("  ") + "]");
  }

  /* ── active relay probe ──────────────────────────────────────────────
     Reporting on what Trystero happened to do is useless from the title
     screen: no room has started, so the honest answer is always "nothing
     has been tried yet", which tells you nothing. A connection test has to
     actually reach out.

     So we open our own short-lived WebSocket to each relay in the pool and
     time it. Nostr relays accept the socket immediately, so a reachable
     one opens fast and an unreachable one is refused or hangs - which is
     exactly the distinction that identifies who is at fault. Sockets are
     closed again as soon as each verdict is in, so this leaves nothing
     running. */
  /* Use the un-wrapped constructor: probing must not pollute __RELAYLOG,
     which is reserved for connections Trystero itself opened. */
  function nativeWS(){
    const WS = window.__NATIVE_WS || window.WebSocket;
    return typeof WS === "function" ? WS : null;
  }

  function probeOne(url, budget){
    return new Promise(resolve => {
      const t0 = Date.now();
      let ws = null, settled = false;
      const finish = (state, detail) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { if (ws) ws.close(); } catch (e) {}
        resolve({ url, state, ms: Date.now() - t0, detail: detail || "" });
      };
      const timer = setTimeout(() => finish("timeout", "no response"), budget);
      const WS = nativeWS();
      if (!WS) return finish("error", "this browser exposes no WebSocket");
      try { ws = new WS(url); }
      catch (err) { return finish("error", err && err.message ? err.message : "could not open"); }
      ws.onopen    = () => finish("open");
      // An error event carries no information in most browsers; the close
      // event that follows it has the code. 1006 means the socket died
      // without a close handshake, which is what a network/DNS block looks
      // like. Capture whichever arrives first.
      ws.onerror   = e => finish("error", "error event" + (e && e.message ? ": " + e.message : " (no detail given by the browser)"));
      ws.onclose   = e => finish("closed", "close code " + (e && (e.code !== undefined ? e.code : "?"))
                                    + (e && e.reason ? " (" + e.reason + ")" : "")
                                    + (e && e.wasClean === false ? ", not clean" : ""));
    });
  }

  /* A non-Nostr WebSocket control. If this opens but every Nostr relay
     fails, the network is filtering those hosts specifically rather than
     blocking WebSockets outright. */
  const CONTROLS = ["wss://echo.websocket.org/", "wss://ws.postman-echo.com/raw"];

  async function probeControl(budget){
    const list = CONTROLS.slice(0, 2);
    const results = [];
    for (const u of list) results.push(await probeOne(u, budget));
    return results;
  }

  async function probeRelays(budget, cap){
    const pool = (typeof Net !== "undefined" && Net.relays) || [];
    if (!pool.length) return null;
    if (!nativeWS())
      return { state: "warn", detail: "this browser exposes no WebSocket, so relays cannot be reached", rows: [] };
    const list = pool.slice(0, cap || pool.length);
    const results = [];
    for (let i = 0; i < list.length; i += 6)          // small batches, don't flood
      results.push.apply(results, await Promise.all(list.slice(i, i + 6).map(u => probeOne(u, budget))));
    return { state: "ok", detail: "", rows: results };
  }

  /* Turn probe results into a verdict, using timing to name the culprit. */
  function summarise(rows, budget){
    const host = u => String(u).replace(/^wss:\/\//, "").split("/")[0];
    const open = rows.filter(r => r.state === "open");
    const dead = rows.filter(r => r.state !== "open");
    if (open.length){
      const times = open.map(r => r.ms).sort((a, b) => a - b);
      return ok(open.length + " of " + rows.length + " relays reachable (fastest "
        + times[0] + "ms, median " + times[Math.floor(times.length / 2)]
        + "ms) - " + open.slice(0, 4).map(r => host(r.url)).join(", ")
        + (dead.length ? ". Unreachable: " + dead.length : ""));
    }
    // A probe that used the whole budget never got an answer; anything that
    // failed sooner was actively refused. Measure against the real budget
    // rather than a fixed delay, so short and long budgets both classify right.
    const cap = budget || 3500;
    const hung = dead.filter(r => r.state === "timeout" || r.ms >= cap).length;
    const instant = dead.length - hung;
    const listed = dead.slice(0, 6).map(r => host(r.url) + " " + r.ms + "ms").join("  ");
    if (instant && !hung)
      return bad("ALL " + rows.length + " refused within a second - blocked on THIS DEVICE, "
        + "not a relay fault. Ad-blockers, privacy extensions and DNS filters routinely kill "
        + "WebSockets. Try a private window with extensions off.  [" + listed + "]");
    if (hung)
      return bad("ALL " + rows.length + " hung with no reply - your network or firewall is "
        + "silently dropping the traffic. Try a different network or a phone hotspot.  [" + listed + "]");
    return bad("ALL " + rows.length + " relays unreachable, with no timing captured.  [" + listed + "]");
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

  /* isSecureContext is true for file:// pages, which makes it useless as a
     multiplayer check on its own. A file:// page has an opaque ("null") origin,
     and browsers refuse to open a WebSocket from one - so every relay and every
     control host fails within a few milliseconds, with no packet leaving the
     device. That is the exact signature of "opened the file directly", so
     check the scheme itself rather than trusting the property. */
  function originProblem(){
    if (location.protocol === "file:")
      return bad("this page was OPENED AS A LOCAL FILE (file://), which cannot join a room at all",
        "Browsers refuse every outbound WebSocket from a file:// page because its origin is "
        + "opaque, so no relay can be reached however healthy the network is. Upload this file "
        + "and open it over http(s) - https://outaiyu.github.io/moneyman/ - then multiplayer works.");
    if (location.protocol === "http:"){
      const h = location.hostname;
      const local = h === "localhost" || h === "127.0.0.1" || h === "[::1]";
      if (!local)
        return bad("this page is served over plain http://, so the browser blocks its WebSockets",
          "Only https:// (or localhost) is allowed to open a WebSocket. Put the file somewhere "
          + "that serves https and reload.");
    }
    return null;
  }

  async function run(reason, opts){
    const o = opts || {};
    rows.length = 0;

    const origin = originProblem();
    if (origin){
      // Report this first and loudest: it explains every relay failure that
      // follows, and no relay list or setting can work around it.
      add("Page origin", origin, origin.detail);
    }
    const sec = secureOrigin();
    add("Secure context", sec.secure && !origin ? ok(sec.via)
        : origin ? warn("true, but irrelevant here") : bad("no — WebRTC needs HTTPS or localhost"),
        origin ? "The browser calls this a secure context, but a " + location.protocol
                + "// page still cannot open a WebSocket. Ignore this line; read Page origin."
        : sec.secure ? (location.protocol + "//" + location.hostname + " is treated as secure (" + sec.via + ")")
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

    const pool = (typeof Net !== "undefined" && Net.relays) ? Net.relays.length : 0;
    if (o.live !== false){
      const budget = o.budget || 3500;
      const probe = await probeRelays(budget, o.cap || 16);
      if (probe && probe.rows && probe.rows.length) add("Relay test (live)", summarise(probe.rows, budget), probe.detail);
      else add("Relay test (live)", probe || warn("no relay pool configured"));

      if (probe && probe.rows && probe.rows.length && !probe.rows.some(r => r.state === "open")){
        const ctl = await probeControl(budget);
        const ctlOpen = ctl.filter(r => r.state === "open").length;
        add("WebSocket control", ctlOpen
              ? ok("plain WebSockets work (" + ctlOpen + " of " + ctl.length + " control hosts answered)")
              : bad("plain WebSockets are blocked too"),
            ctlOpen
              ? "Plain WebSockets work, so this device is NOT blocking WebSockets. Something specific to the Nostr relay hosts is being filtered - a DNS or network filter for those domains."
              : "Even non-Nostr WebSocket hosts were refused, so all outbound WebSockets are blocked on this device or network.");
      }
    }
    const rr = relayReport();
    const passive = window.__RELAYLOG && window.__RELAYLOG.length
      ? "so far in this session: " + rr.detail
      : "no room has been joined yet, so Trystero has not used a relay yet";
    add("Nostr relays", rr, passive + (pool ? "  (pool: " + pool + ")" : ""));

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

    // One plain-language line at the top: of everything that was checked,
    // this is the thing that is actually stopping you playing.
    const relayRow = rows.find(r => r.name === "Relay test (live)") || rows.find(r => r.name === "Nostr relays");
    const ctlRow   = rows.find(r => r.name === "WebSocket control");
    const webapi   = rows.find(r => r.name === "WebRTC APIs");
    const self     = rows.find(r => r.name === "WebRTC self-test");
    const lib      = rows.find(r => r.name === "Trystero library");
    let verdict;
    if (origin)
      verdict = bad("FOUND IT: this page is open as a LOCAL FILE, not over a web address. "
        + "A file:// page has an opaque origin, so every browser refuses its WebSockets — "
        + "that is why all the relays below failed in a few milliseconds. Upload the file and "
        + "open it from https://outaiyu.github.io/moneyman/ instead. Nothing is wrong with your "
        + "network or this device.");
    else if (lib && lib.state === "bad")
      verdict = bad("trystero.js did not load, so nothing multiplayer can work. Reload the page.");
    else if (webapi && webapi.state === "bad")
      verdict = bad("This browser has no WebRTC, so peer connections are impossible. Try a different browser.");
    else if (relayRow && relayRow.state === "bad")
      verdict = bad(ctlRow && ctlRow.state === "ok"
        ? "FOUND IT: plain WebSockets work here, but every Nostr relay was refused. Something "
          + "is filtering those relay hosts specifically - a DNS or network filter, or a "
          + "privacy app with a blocklist. The relay hosts must be reachable for two devices "
          + "to find each other."
        : "FOUND IT: this device cannot open ANY outbound WebSocket, including non-Nostr "
          + "hosts. That stops two devices finding each other no matter how healthy the "
          + "network is between them. Turn off VPN/ad-block/privacy apps, or try another network.");
    else if (self && self.state === "bad")
      verdict = bad("WebRTC itself fails inside this browser even with no network involved.");
    else if (relayRow && relayRow.state === "warn")
      verdict = warn("Signalling has not been exercised yet. Start a room and re-run this report.");
    else
      verdict = ok("Everything checked out. Your browser can reach relays and do peer-to-peer.");
    rows.unshift({ name: "Verdict", state: verdict.state, detail: verdict.detail });

    return rows;
  }

  function show(reason){
    const el = document.getElementById("diag");
    const body = document.getElementById("diagBody");
    if (!el || !body) return;
    el.style.display = "block";
    body.innerHTML = '<div class="fine">checking…</div>'
      + '<div class="fine" style="margin-top:6px">Reaching out to the signalling relays now — '
      + 'this takes a few seconds.</div>';
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