/* ════════════════════════════════════════════════════════════════════════
   net.js — peer-to-peer battle royale (2–8 players)

   ── TRANSPORT ────────────────────────────────────────────────────────────
   Trystero joins every browser to a room through public Nostr relays, then
   switches to a direct encrypted WebRTC channel between peers. Game data
   never touches a server of ours; there is no backend and no account.

   ── AUTHORITY ────────────────────────────────────────────────────────────
   The player who created the room is the HOST and owns:
       roster · round number · phase · who is eliminated · question assignment
   Each player owns their OWN cash, streak, upgrades and achievements, and
   reports only whether they got their question right. Splitting it this way
   means the host never needs to know anything about a client's economy, so
   the two sides cannot drift.

   Every state change is broadcast as a COMPLETE snapshot, which is what makes
   host migration possible: when the host disappears, the longest-present
   surviving peer takes over using the last snapshot it already holds.

   ── PROTOCOL ─────────────────────────────────────────────────────────────
     hi    client → host   { name }
     dur   client → host   { round, deadline }   my effective clock deadline
     rep   client → host   { round, correct, cash }
     mine  host → client   { round, q, baseSec } my personal question
     snap  host → all      full state snapshot (broadcast)
     kick  host → all      { reason }            back to lobby

   Every message carries `hostId` + `epoch`; clients discard snapshots from
   anyone who is not their current believed host, which is what keeps a
   migrating host from fighting a stale one.

   ── RULES ────────────────────────────────────────────────────────────────
     Everyone starts with 2 shields. Each round every living player gets a
     DIFFERENT question on their own clock (different questions on purpose, so
     nobody can read the answer off a neighbour). Answer right → keep your
     shields and bank the cash. Answer wrong or run out of time → lose a shield
     and 25% of your cash. Zero shields → eliminated. Last one standing wins.
   ════════════════════════════════════════════════════════════════════════ */
"use strict";

const APP_ID = "moneyman_katrina_v3";
const MAX_PLAYERS = 8;
const START_SHIELDS = 2;
const COUNTDOWN_MS = 3500;
const ROUND_END_MS = 5200;
const STRAGGLER_GRACE = 2500;
const HEARTBEAT_MS = 2000;      // keeps clients from mistaking a quiet round for a dead host
const HOST_TIMEOUT = 9000;   // no snapshot for this long ⇒ host is gone

const Net = (()=>{
  let room = null, A = {};
  let myId = null, myName = "Player";
  let hostId = null, epoch = 0;
  let lastSnapAt = 0, lastSnapSent = 0, phase = "off", round = 0, phaseEnds = 0;
  let players = {}, order = [], winner = null, finalBoard = null;
  let pendingRep = {}, deadlines = {}, stragglerAt = 0;
  let started = false, everJoined = false, roomCode = "";

  /* ─────────────────────────── room codes ─────────────────────────── */
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // no I/O/0/1
  function makeCode(){
    let s = "";
    const a = new Uint8Array(5);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_,i)=>a[i]=Math.random()*256);
    for(let i=0;i<5;i++) s += CODE_CHARS[a[i] % CODE_CHARS.length];
    return s;
  }
  function normCode(s){ return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,8); }

  /* ─────────────────────────── transport ─────────────────────────── */
  function available(){
    return typeof Trystero !== "undefined" && typeof Trystero.joinRoom === "function";
  }
  /* ---- Nostr relays: the signalling layer --------------------------
     Trystero cannot introduce two browsers to each other on its own —
     they meet by exchanging messages over public Nostr relays. No relay,
     no connection.

     The copy of Trystero vendored here ships a hardcoded list of 28
     relays and always tries them *in order*, taking only the first few.
     Two at the front of that list are dead hostnames, and several others
     are unreliable, so on some networks it only ever attempted dead
     endpoints and reported "peer link unavailable" while perfectly good
     relays sat further down the list, untried.

     So we pass our own list explicitly. This one is ordered with the
     large, long-running public relays first — those are the ones most
     likely to be reachable and are the least likely to be on an
     extension's blocklist — and diversity is spread through the top of
     the list so a block aimed at one host or CDN cannot take everything
     out at once. RELAY_REDUNDANCY controls how many are tried; if enough
     of them answer, the rest never get contacted.
     ------------------------------------------------------------------ */
  const RELAYS = [
    "wss://relay.damus.io",         // largest public relay
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://relay.snort.social",
    "wss://nostr.wine",
    "wss://nostr.mom",
    "wss://relay-dev.gulugulu.moe",
    "wss://nostrcity-club.fly.dev",  // fly.dev
    "wss://nostr-pub.wellorder.net",
    "wss://relay.nostr.blockhenge.com",
    "wss://0x-nostr-relay.fly.dev",  // fly.dev
    "wss://nostr.oxtr.dev",
    "wss://cdn.satellite.earth",
    "wss://relay.hackshed.dev",
    "wss://relay.agentry.com",
    "wss://relay.flashapp.me",
    "wss://relay.layer.systems",
    "wss://relay.kaleidoswap.com",
    "wss://nostr.red5d.dev",
    "wss://relay.nostr.dev.br",
    "wss://relay.nostrmap.net",
    "wss://relay.aarpia.com",
    "wss://relay.piazza.today",
    "wss://testr.nymble.world",
  ];
  const RELAY_REDUNDANCY = 14;

  function connect(code, name, asHost){
    if(!available()) throw new Error("Peer library failed to load (trystero.js)");
    myName = (name || "Player").slice(0, 14) || "Player";
    roomCode = normCode(code);
    room = Trystero.joinRoom({
      appId: APP_ID,
      relayConfig: { urls: RELAYS, redundancy: RELAY_REDUNDANCY },
    }, normCode(code));
    myId = Trystero.selfId;
    hostId = myId;           // optimistic: everyone assumes they are host first
    epoch = 0;
    lastSnapAt = Date.now();
    everJoined = true;
    isCreator = !!asHost;
    pendingRep = {}; deadlines = {}; myRep = null; myRepDone = false; roundChanges = [];

    const def = id => room.makeAction(id);
    A.hi   = def("hi");
    A.dur  = def("dur");
    A.rep  = def("rep");
    A.mine = def("mine");
    A.snap = def("snap");
    A.kick = def("kick");

    A.hi.onMessage   = (d, x) => onHi(d, x.peerId);
    A.dur.onMessage  = (d, x) => onDur(d, x.peerId);
    A.rep.onMessage  = (d, x) => onRep(d, x.peerId);
    A.mine.onMessage = (d, x) => onMine(d, x.peerId);
    A.snap.onMessage = (d, x) => onSnap(d, x.peerId);
    A.kick.onMessage = (d, x) => onKick(d, x.peerId);

    room.onPeerJoin  = id => { if(isHost()) A.hi.send({ name: myName }); };
    room.onPeerLeave = id => onPeerLeave(id);

    // the room creator is the host; joiners wait for the first snapshot
    if(isCreator) becomeHost();
    netPaint();
    return { code: normCode(code), selfId: myId };
  }
  let isCreator = false;

  function leave(){
    try{ if(room) room.leave(); }catch(e){}
    room = null;
    hostId = null; phase = "off"; players = {}; order = [];
    round = 0; winner = null; finalBoard = null;
    started = false; resultsShown = false;
    everJoined = false; roomCode = "";
    netPaint();
  }
  function isHost(){ return hostId === myId; }

  /* ──────────────────────── authority: host ───────────────────────── */
  function becomeHost(){
    hostId = myId;
    epoch++;
    if(!players[myId]){
      players[myId] = { id: myId, name: myName, joined: Date.now(), alive: true,
                        shields: START_SHIELDS, cash: 0, cleared: 0, gone: false };
    }
    phase = "lobby";
    tag("YOU ARE THE HOST");
    netPaint();
    applySnap();
    broadcastSnap();
  }

  function onHi(d, from){
    if(!isHost()) return;
    if(players[from]) return;
    if(countPlayers() >= MAX_PLAYERS){
      try{ A.kick.send({ reason: "Room is full (" + MAX_PLAYERS + " max)" }, { target: from }); }catch(e){}
      return;
    }
    players[from] = { id: from, name: (d && d.name ? d.name : "Player").slice(0,14),
                      joined: Date.now(), alive: true, shields: START_SHIELDS,
                      cash: 0, cleared: 0, gone: false };
    tag((d && d.name) + " joined");
    netPaint(); applySnap(); broadcastSnap();
  }
  function onPeerLeave(id){
    if(isHost()){
      if(players[id]){
        players[id].gone = true;
        const slot = pendingRep[round];
        if(slot) delete slot[id];
        tag(players[id].name + " disconnected");
        // a leaver forfeits the round they abandoned
        if(phase === "round" && players[id].alive && !repFor(id))
          (pendingRep[round] || (pendingRep[round] = {}))[id] = { correct:false, cash:0, ghost:true };
        netPaint(); applySnap(); broadcastSnap();
        maybeCloseRound(); checkEnd();
      }
      return;
    }
    // client side: did the host vanish?
    if(players[id]) players[id].gone = true;   // a departed host must not be re-elected
    if(id === hostId) hostId = null;
    netPaint();
  }

  function countPlayers(){ return Object.keys(players).length; }
  function livingIds(){
    return Object.keys(players).filter(k => players[k].alive && !players[k].gone);
  }
  function sortedBoard(){
    return Object.values(players)
      .sort((a,b)=> (b.cash - a.cash) || (b.cleared - a.cleared) || (a.joined - b.joined));
  }

  function startRoyale(){
    if(!isHost()) return;
    const n = countPlayers();
    if(n < 2){ tag("NEED AT LEAST 2 PLAYERS", 2200); return; }
    Object.values(players).forEach(p=>{
      p.alive = true; p.shields = START_SHIELDS; p.cash = 0; p.cleared = 0; p.gone = false;
    });
    round = 1; winner = null; finalBoard = null; started = true; resultsShown = false;
    phase = "countdown"; phaseEnds = Date.now() + COUNTDOWN_MS;
    st.cash = 0; st.lives = START_SHIELDS; st.maxLives = START_SHIELDS;
    st.streak = 0; st.qIndex = 0; st.bestStreak = 0; st.correct = 0; st.wrong = 0;
    st.total = 0; st.lastMilestone = 0; st.sinceFifty = 0; st.pendingNext = false;
    st.spectating = false; st.deadline = 0; st.running = true; st.paused = false;
    AU.play("boss"); AU.play("start"); AU.musicStart();
    showScreen("game"); showRoyale(true);
    document.body.classList.add("royale");
    applySnap(); broadcastSnap();
  }

  function assignRound(){
    // a different question per living player, so nobody can copy a neighbour
    const ids = livingIds();
    const pool = buildCycle();
    const picked = [];
    for(let i=0;i<ids.length && i<pool.length;i++) picked.push(pool[i]);
    ids.forEach((id,i)=>{
      const q = picked[i];
      const baseSec = Math.max(7, 21 - round * 0.32) + (q.boss ? 10 : 0);
      if(id === myId) deliverMine(id, q, baseSec);
      else { try{ A.mine.send({ round, q, baseSec }, { target: id }); }catch(e){} }
    });
  }

  function onDur(d, from){
    if(!isHost() || !d || d.round !== round) return;
    deadlines[from] = d.deadline;
  }
  function onRep(d, from){
    if(!isHost() || !d || d.round !== round) return;
    if(!players[from]) return;
    // keyed by player — one slot per round would let each answer overwrite the
    // last and only a single player's result would ever be applied
    const slot = pendingRep[round] || (pendingRep[round] = {});
    slot[from] = { correct: !!d.correct, cash: Math.round(d.cash || 0) };
    maybeCloseRound();
  }
  function repFor(id){
    if(id === myId) return myRepDone ? myRep : null;
    const slot = pendingRep[round];
    return (slot && slot[id]) || null;
  }
  function maybeCloseRound(){
    if(!isHost() || phase !== "round") return;
    const ids = livingIds();
    if(ids.length && ids.every(id => repFor(id))) closeRound();
  }

  function closeRound(){
    if(phase !== "round") return;
    const ids = livingIds();
    const changes = [];
    ids.forEach(id=>{
      const rep = repFor(id);
      const ok = rep && rep.correct;
      const p = players[id];
      if(!p) return;
      if(id !== myId && rep) p.cash = rep.cash;          // client owns its own cash
      if(ok){ p.cleared++; changes.push({ id, ok: true }); }
      else {
        p.shields = Math.max(0, p.shields - 1);
        p.cash = Math.round(p.cash * 0.75);              // forfeit a quarter
        changes.push({ id, ok: false, shields: p.shields });
        if(p.shields <= 0){
          p.alive = false; p.outRound = round;
          changes[changes.length - 1].out = true;
        }
      }
    });
    roundChanges = changes;
    phase = "roundend"; phaseEnds = Date.now() + ROUND_END_MS;
    pendingRep = {}; deadlines = {};
    AU.play("thunder");
    netPaint(); applySnap(); broadcastSnap();
    checkEnd();
  }
  let roundChanges = [];
  let myRep = null, myRepDone = false;

  /* one-shot, so the host's own timer and a client's snapshot can't double-fire */
  let resultsShown = false;
  function armResults(){
    if(resultsShown) return;
    resultsShown = true;
    setTimeout(showRoyaleResults, ROUND_END_MS + 400);
  }
  function checkEnd(){
    const alive = livingIds();
    if(alive.length <= 1 && started){
      phase = "over";
      winner = alive[0] || null;
      finalBoard = sortedBoard();
      started = false;
      st.running = false; st.deadline = 0;
      AU.musicStop();
      if(winner === myId) { AU.play("correctBoss"); confetti(110); bigWord("YOU WIN"); }
      else { AU.play("over"); if(winner) bigWord(players[winner].name.toUpperCase() + " WINS"); }
      netPaint(); applySnap(); broadcastSnap();
      armResults();          // clients arm theirs from the snapshot below
    }
  }

  /* ──────────────────────── authority: client ─────────────────────── */
  function deliverMine(id, q, baseSec){
    if(id !== myId) return;
    if(!q) return;
    if(st.lives <= 0){ st.spectating = true; return; }
    st.spectating = false;
    // clients never call startRoyale(), so the engine's "is a run live" flag has
    // to be raised here or playable() stays false and no answer can register
    st.running = true; st.paused = false;
    showRoyale(true); showScreen("game");
    // Personal time upgrades and slow-mo are applied locally by the shared
    // engine; the host only needs our resulting deadline so it knows how long
    // to wait before calling the round.
    st.pendingBase = baseSec;
    installQuestion(q, 0, baseSec);
    myRep = null; myRepDone = false;
    renderRoyaleWait();
    if(isHost()) return;                     // host has no one to tell
    try{ A.dur.send({ round, deadline: st.deadline }); }catch(e){}
  }
  function onMine(d, from){
    if(!d || d.round !== round) return;
    if(!isHost()) deliverMine(myId, d.q, d.baseSec);
  }

  function onSnap(d, from){
    if(!d) return;
    const trusted = (d.hostId === hostId) || (d.epoch > epoch) || (hostId === null);
    if(!trusted && from !== myId) return;
    if(d.epoch < epoch) return;
    epoch = d.epoch;
    hostId = d.hostId;
    lastSnapAt = Date.now();
    players = {};
    (d.players || []).forEach(p => { players[p.id] = p; });
    phase = d.phase; round = d.round || 0; phaseEnds = d.phaseEnds || 0;
    winner = d.winner || null; finalBoard = d.final || null;
    roundChanges = d.changes || [];
    // mirror the host's phase into the engine's run flag
    const inPlay = d.phase === "countdown" || d.phase === "round" || d.phase === "roundend";
    st.running = inPlay;
    if(inPlay){ showScreen("game"); showRoyale(true); }
    const me = players[myId];
    if(me){
      st.lives = me.shields;
      st.maxLives = START_SHIELDS;
      if(me.cash !== undefined && Math.abs(me.cash - st.cash) > 0.5) st.cash = me.cash;
      const wasOut = st.spectating;
      st.spectating = !me.alive;
      if(st.spectating && !wasOut){ AU.play("thunder"); bigWord("YOU ARE OUT"); }
      if(!st.spectating && wasOut) showRoyale(true);
    }
    renderHUD(); netPaint(); phasePaint();
    if(d.phase === "over") armResults();
  }
  function onKick(d, from){
    if(d && d.reason) tag(d.reason.toUpperCase(), 2600);
    setTimeout(()=>{ leave(); showLobby(); }, 1400);
  }

  function broadcastSnap(){
    if(!isHost() || !room) return;
    lastSnapSent = Date.now();
    try{
      A.snap.send({
        v: 1, epoch, hostId,
        phase, round, phaseEnds,
        players: Object.values(players), winner, final: finalBoard, changes: roundChanges
      });
    }catch(e){}
  }
  function applySnap(){
    // host applies the same snapshot locally so host and clients run one code path
    const me = players[myId];
    if(me){
      st.lives = me.shields;
      if(me.cash !== undefined) st.cash = me.cash;
      st.spectating = !me.alive;
    }
    renderHUD(); netPaint(); phasePaint();
  }

  /* ─────────────────────────── host loop ─────────────────────────── */
  /* The round cannot close before the slowest player's own clock has run out,
     so the host waits for the latest deadline anyone reports. Clients with big
     time-upgrade stacks legitimately need longer, and the host cannot know
     their upgrades — so they tell it. */
  function latestDeadline(){
    let m = 0;
    for(const k in deadlines) if(deadlines[k] > m) m = deadlines[k];
    if(isHost() && st.deadline > m) m = st.deadline;
    return m;
  }
  function hostTick(){
    if(!isHost() || !everJoined) return;
    const now = Date.now();
    /* Heartbeat. Snapshots otherwise only go out on state changes, so a round
       where everyone is quietly thinking would look identical to a dead host
       and clients would stage a pointless migration. */
    if(now - lastSnapSent > HEARTBEAT_MS) broadcastSnap();
    if(!started) return;
    if(phase === "countdown" && now >= phaseEnds){
      assignRound();
      phase = "round";
      stragglerAt = now + (st.pendingBase || 30) * 1000 + STRAGGLER_GRACE;
      applySnap(); broadcastSnap();
    }
    else if(phase === "round"){
      const latest = latestDeadline();
      if(latest) stragglerAt = Math.max(stragglerAt, latest + STRAGGLER_GRACE);
      phaseEnds = stragglerAt;
      if(now >= stragglerAt) closeRound();
    }
    else if(phase === "roundend" && now >= phaseEnds){
      round++;
      phase = "countdown"; phaseEnds = now + COUNTDOWN_MS;
      applySnap(); broadcastSnap();
    }
  }
  /* Re-elect deterministically: the longest-present surviving peer takes over.
     `hostId === null` means the host left cleanly; otherwise silence past
     HOST_TIMEOUT means it crashed and is excluded from the ballot. */
  function tryElect(){
    const dead = (hostId && Date.now() - lastSnapAt > HOST_TIMEOUT) ? hostId : null;
    let cands = Object.values(players).filter(p => !p.gone);
    if(dead) cands = cands.filter(p => p.id !== dead);
    if(!cands.length){ leave(); showLobby(); return; }
    cands.sort((a,b)=> (a.joined - b.joined) || (a.id < b.id ? -1 : 1));
    const heir = cands[0];
    if(heir.id === myId){ tag("HOST LEFT — YOU TAKE OVER", 2600); becomeHost(); }
    else { hostId = heir.id; lastSnapAt = Date.now(); }
  }
  function clientTick(){
    if(!room || isHost() || !everJoined) return;
    if(hostId === null) tryElect();
    else if(Date.now() - lastSnapAt > HOST_TIMEOUT) tryElect();
  }

  /* the host records its own answer locally instead of messaging itself */
  function reportMine(ok){
    myRep = { correct: !!ok, cash: Math.round(st.cash) };
    myRepDone = true;
    if(isHost()) maybeCloseRound();
  }

  /* ─────────────────────────── install ─────────────────────────── */
  function install(){
    MODE.name = "royale";
    MODE.livesLabel = "SHIELDS";
    MODE.tick = function(){
      hostTick(); clientTick();
      if(everJoined) throttlePaint();
    };
    MODE.afterResolve = function(ok){
      myRep = { correct: !!ok, cash: Math.round(st.cash) };
      myRepDone = true;
      if(!isHost()){ try{ A.rep.send({ round, correct: !!ok, cash: Math.round(st.cash) }); }catch(e){} }
      else maybeCloseRound();
      if(st.spectating) return;
      renderRoyaleWait();
    };
    MODE.afterTimeout = function(){
      myRep = { correct: false, cash: Math.round(st.cash) };
      myRepDone = true;
      if(!isHost()){ try{ A.rep.send({ round, correct: false, cash: Math.round(st.cash) }); }catch(e){} }
      else maybeCloseRound();
      renderRoyaleWait();
    };
    MODE.afterEvac = function(){
      // burning an evac charge still costs you the round
      myRep = { correct: false, cash: Math.round(st.cash) };
      myRepDone = true;
      if(!isHost()){ try{ A.rep.send({ round, correct: false, cash: Math.round(st.cash) }); }catch(e){} }
      else maybeCloseRound();
      renderRoyaleWait();
    };
    MODE.gameOver = function(){ showRoyaleResults(); };
    MODE.togglePause = function(){
      if(!st.running) return;
      st.paused = !st.paused;
      $("#pausedBox").classList.toggle("show", st.paused);
      $("#btnPause").textContent = st.paused ? "▶" : "⏸";
      if(st.paused) AU.musicStop(); else if(S.music) AU.musicStart();
    };
    MODE.onBuy = function(){ renderShop(); netPaint(); };
  }
  let lastPaint = 0;
  // the banner is driven by the host's phase clock, so it has to repaint on a
  // timer — snapshots alone only land on phase transitions.
  function throttlePaint(){
    const n = Date.now();
    if(n - lastPaint < 120) return;
    lastPaint = n;
    phasePaint();
  }

  return {
    install, connect, leave, makeCode, normCode, available,
    relays: RELAYS, relayRedundancy: RELAY_REDUNDANCY,
    isHost, startRoyale, reportMine, becomeHost, get code(){ return roomCode; },
    set code(v){ roomCode = v; },
    get state(){
      return { phase, round, players, winner, finalBoard, isHost:isHost(), me:myId,
               count: countPlayers(), max: MAX_PLAYERS, changes: roundChanges,
               phaseEnds, timeLeft: phaseEnds ? Math.max(0, phaseEnds - Date.now()) : 0 };
    }
  };
})();

/* ─────────────────────────── UI helpers ─────────────────────────── */
/* the roster is rendered twice — sidebar during a match, lobby while waiting */
function netPaint(){
  const s = Net.state;
  const ids = Object.keys(s.players);
  $("#royaleCount").textContent = ids.length + " / " + s.max;
  $("#royaleRound").textContent = s.round ? "ROUND " + s.round : "LOBBY";
  const phaseChip = $("#royalePhase");
  const names = { lobby:"WAITING FOR PLAYERS", countdown:"GET READY", round:"ROUND LIVE",
                  roundend:"ROUND OVER", over:"GAME OVER", off:"OFFLINE" };
  phaseChip.textContent = names[s.phase] || s.phase.toUpperCase();
  phaseChip.className = "chip " + (s.phase === "round" ? "hot" : s.phase === "over" ? "gold" : "");
  const roomChip = $("#royaleRoomChip");
  if(roomChip) roomChip.textContent = Net.code || "—";

  const rows = ids.length ? ids.map(id=>{
    const p = s.players[id];
    const you = id === s.me;
    const shields = "★".repeat(Math.max(0, p.shields)) + "☆".repeat(Math.max(0, START_SHIELDS - p.shields));
    const cls = p.gone ? "gone" : p.alive ? "alive" : "out";
    return `<div class="rp ${cls} ${you ? "you" : ""}">
      <div class="rn">${esc(p.name)}${you ? " (you)" : ""}${p.id === s.hostId ? " 👑" : ""}</div>
      <div class="rs">${shields}</div>
      <div class="rc">${fmt(p.cash || 0)}</div>
    </div>`;
  }).join("") : `<div class="rEmpty">Nobody here yet — share the room code.</div>`;

  const a = $("#roster"), b = $("#rosterL");
  if(a) a.innerHTML = rows;
  if(b) b.innerHTML = rows;

  const startBtn = $("#btnStartRoyale");
  if(startBtn){
    const canStart = s.isHost && s.count >= 2;
    startBtn.disabled = !canStart;
    startBtn.textContent = !s.isHost ? "WAITING FOR HOST…"
      : s.count < 2 ? "NEED 2+ PLAYERS" : "☠️ START BATTLE ROYALE";
  }
  const ho = $("#hostOnly");
  if(ho) ho.style.display = s.isHost ? "block" : "none";
  const hint = $("#roomHint");
  if(hint) hint.textContent = s.isHost
    ? "Send this code to your friends, then start when everyone's in."
    : "Waiting for the host to start the round…";
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

/* drive the round-end / countdown chrome from the host's phase timeline */
function phasePaint(){
  const s = Net.state;
  const banner = $("#roundBanner");
  if(!banner) return;
  if(s.phase === "countdown"){
    const left = Math.ceil(s.timeLeft / 1000);
    banner.className = "rb show rbcount";
    banner.innerHTML = `<b>ROUND ${s.round}</b><span>${left > 0 ? "starts in " + left : "GO!"}</span>`;
  } else if(s.phase === "round"){
    banner.className = "rb show";
    banner.innerHTML = `<b>ROUND ${s.round}</b><span>answer your own question</span>`;
  } else if(s.phase === "roundend"){
    const rows = (s.changes || []).map(c=>{
      const p = s.players[c.id];
      if(!p) return "";
      return `<div class="rc2 ${c.ok ? "good" : c.out ? "out" : "bad"}">
        <b>${esc(p.name)}</b> ${c.out ? "ELIMINATED" : c.ok ? "cleared ✓" : "−1 shield"}</div>`;
    }).join("");
    banner.className = "rb show rbend";
    banner.innerHTML = `<b>ROUND ${s.round} OVER</b><div class="rcl">${rows}</div>`;
  } else if(s.phase === "over"){
    banner.className = "rb show rbover";
    banner.innerHTML = winnerBoardHTML();
  } else {
    banner.className = "rb";
    banner.innerHTML = "";
  }
  const spec = $("#spectate");
  if(spec) spec.classList.toggle("show", !!st.spectating);
  if(st.spectating) $("#specBody").innerHTML = winnerBoardHTML();
}
function winnerBoardHTML(){
  const s = Net.state;
  const board = s.finalBoard && s.finalBoard.length
    ? s.finalBoard
    : Object.values(s.players).sort((a,b)=> (b.cash-a.cash) || (b.cleared-a.cleared));
  if(!board.length) return "";
  return `<div class="board">${board.map((p,i)=>{
    const you = p.id === s.me;
    return `<div class="br ${p.alive ? "" : "out"} ${you ? "you" : ""}">
      <span class="bp">${i === 0 ? "👑" : (i+1)+"."}</span>
      <span class="bn">${esc(p.name)}${you ? " (you)" : ""}</span>
      <span class="bs">${p.alive ? "SURVIVED" : "out r" + (p.outRound || "?")}</span>
      <span class="bc">${fmt(p.cash || 0)}</span></div>`;
  }).join("")}</div>`;
}
function renderRoyaleWait(){
  const w = $("#royaleWait");
  if(w) w.style.display = st.answered ? "block" : "none";
}
function showRoyaleResults(){
  const s = Net.state;
  const youWon = s.winner === s.me;
  const youDead = st.spectating;
  if(youWon) confetti(140);
  showResults({
    title: youWon ? "YOU SURVIVED" : (s.winner ? "GAME OVER" : "ROUND OVER"),
    titleClass: youWon ? "win" : "lose",
    msg: youWon ? "Last one standing. The Gulf Coast recovery money is yours."
      : youDead ? "You were knocked out. Watch the survivors finish it out."
      : (s.winner ? esc(s.players[s.winner] ? s.players[s.winner].name : "Someone") + " survived the storm." : "The round ended."),
    cash: st.cash,
    stats: winnerBoardHTML() + `<div style="margin-top:12px">Questions cleared <b style="color:#4ade80">${s.players[s.me] ? s.players[s.me].cleared : 0}</b> &nbsp;•&nbsp; Best streak <b style="color:#2ee6b6">${st.bestStreak}</b> &nbsp;•&nbsp; Achievements <b style="color:#a78bfa">${S.ach.length}/${ACHIEVEMENTS.length}</b></div>`
  });
  $("#btnAgain").textContent = "↩ BACK TO LOBBY";
}
function showRoyale(on){
  const r = $("#royale");
  if(r) r.style.display = on ? "block" : "none";
}
function showScreen(which){
  $("#screenStart").style.display = (which === "start") ? "block" : "none";
  $("#screenGame").style.display = (which === "game") ? "block" : "none";
  $("#screenLobby").style.display = (which === "lobby") ? "block" : "none";
}
function showLobby(){
  st.running = false;
  st.deadline = 0;
  showScreen("lobby");
  showRoyale(false);
  document.body.classList.remove("dim", "royale");
  netPaint();
}