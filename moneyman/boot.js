/* ════════════════════════════════════════════════════════════════════════
   boot.js — everything that wires the DOM to the two modes.
   This is the only file that knows a button exists; engine.js knows how the
   game scores, solo.js and net.js know how a run is driven.
   ════════════════════════════════════════════════════════════════════════ */
"use strict";

function playerName(){
  const v = ($("#nameInput").value || "").trim().slice(0, 14);
  return v || "Player";
}
function rememberName(){
  S.name = playerName();
  save();
}

function netFail(msg){
  $("#netfailMsg").textContent = msg +
    " Multiplayer needs a secure context, so it won't work from a plain file:// " +
    "URL — serve the folder over http (or publish it to GitHub Pages) and try again. " +
    "Solo works anywhere.";
  $("#netfail").style.display = "block";
}

/* Audio must never be able to prevent someone playing online. On some mobile
   browsers the Web Audio API exists but throws while initialising, which used
   to abort the whole join handler and leave the button doing nothing at all. */
function safeAudio(){
  try { AU.resume(); AU.init(); return true; }
  catch(err){ tag("AUDIO UNAVAILABLE — PLAYING SILENT", 2600); return false; }
}

/* ─────────────────────────── mode switching ─────────────────────────── */
let mode = "solo";   // "solo" | "royale"

function toTitle(){
  clearTimeout(watchPeerArrival._t);
  Net.leave();
  mode = "solo";
  Solo.install();
  st.spectating = false;
  $("#over").classList.remove("show");
  $("#spectate").classList.remove("show");
  $("#pausedBox").classList.remove("show");
  showRoyale(false);
  showScreen("start");
  renderHUD(); renderShop();
}

function playSolo(){
  rememberName();
  safeAudio();
  mode = "solo";
  Solo.install();
  Solo.start();
}

function enterRoom(asHost){
  if(!Net.available()){
    netFail("The peer-to-peer library (trystero.js) did not load. " +
            "Open CONNECTION REPORT below for the full reason.");
    Diag.show("trystero.js did not load");
    return;
  }
  rememberName();
  safeAudio();
  const code = asHost ? Net.makeCode() : Net.normCode($("#codeInput").value);
  if(!asHost && code.length < 4){
    tag("ENTER A ROOM CODE", 2000);
    $("#codeInput").focus();
    return;
  }
  mode = "royale";
  Net.install();
  showScreen("lobby");
  showRoyale(true);
  document.body.classList.add("royale");
  $("#over").classList.remove("show");
  $("#spectate").classList.remove("show");
  $("#joinRow").style.display = "none";
  try{
    Net.connect(code, playerName(), asHost);
    $("#roomCode").textContent = Net.code;
    tag(asHost ? "ROOM OPEN — COPY THE CODE ABOVE" : "CONNECTING…", 2200);
    if(!asHost) AU.play("swoosh");
    watchPeerArrival(asHost);
  }catch(err){
    netFail(err && err.message ? err.message : "Could not join the room.");
    Diag.show("joining threw: " + (err && err.message ? err.message : err));
    toTitle();
  }
}

/* Joining used to fail silently: you tapped JOIN, it said "CONNECTING…", and
   then nothing — no error, ever. If nobody has arrived a little while after
   the attempt, work out why instead of leaving you guessing. */
function watchPeerArrival(asHost){
  clearTimeout(watchPeerArrival._t);
  const waited = asHost ? 45000 : 25000;
  const label = asHost ? "No players joined your room" : "Could not reach the host";
  watchPeerArrival._t = setTimeout(() => {
    if (mode !== "royale") return;
    if (Net.state.count > 1) return;
    tag(label + " — OPENING CONNECTION REPORT", 3200);
    Diag.show(label + " (waited " + Math.round(waited / 1000) + "s)");
  }, waited);
}

/* ─────────────────────────── button wiring ─────────────────────────── */
$("#btnStart").onclick  = playSolo;
$("#btnCreate").onclick = ()=> enterRoom(true);
$("#btnJoinHow").onclick = ()=>{
  const r = $("#joinRow");
  r.style.display = r.style.display === "none" ? "flex" : "none";
  if(r.style.display === "flex") $("#codeInput").focus();
};
$("#codeInput").addEventListener("keydown", e=>{ if(e.key === "Enter") enterRoom(false); });
$("#btnJoin").onclick  = ()=> enterRoom(false);
$("#btnStartRoyale").onclick = ()=>{ AU.play("boss"); Net.startRoyale(); };
$("#btnLeave").onclick = ()=>{ AU.play("swoosh"); toTitle(); };
$("#btnNetFailOk").onclick = ()=>{ $("#netfail").style.display = "none"; };

/* ── connection diagnostics ─────────────────────────────────────────────── */
$("#btnDiag").onclick  = ()=> Diag.show("");
$("#btnDiagOk").onclick = ()=>{ $("#diag").style.display = "none"; };

/* ── room code copy ───────────────────────────────────────────────────────
   On an iPad, switching to another app to share the code freezes this page:
   iOS suspends JS, the relay sockets drop and the room is dead on return.
   Copying from the page means you never have to leave it. */
$("#btnCopyCode").onclick = async ()=>{
  const btn = $("#btnCopyCode"), code = Net.code || "";
  if(!code || code === "-----"){ tag("NO ROOM CODE YET", 1600); return; }
  let done = false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(code);
      done = true;
    }
  }catch(e){ /* clipboard API blocked — fall back below */ }
  if(!done){
    const sel = window.getSelection(), range = document.createRange();
    const node = $("#roomCode");
    range.selectNodeContents(node);
    sel.removeAllRanges(); sel.addRange(range);
    try{ done = document.execCommand("copy"); }catch(e){}
    sel.removeAllRanges();
  }
  btn.textContent = done ? "✅ COPIED — NOW PASTE IT" : "SELECT AND COPY ABOVE";
  btn.classList.toggle("done", done);
  setTimeout(()=>{ btn.textContent = "📋 COPY ROOM CODE"; btn.classList.remove("done"); }, 2600);
};

/* ── backgrounded warning ───────────────────────────────────────────────
   iOS silently freezes the page in the background. Tell the player the moment
   they come back, because by then the room is usually already gone. */
let wasHidden = false;
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden){ wasHidden = true; return; }
  if(!wasHidden) return;
  wasHidden = false;
  window.__BGWARN = true;
  if(mode === "royale"){
    $("#bgwarn").style.display = "block";
    setTimeout(()=>{ $("#bgwarn").style.display = "none"; }, 9000);
    tag("PAGE WAS PAUSED — YOU MAY NEED TO REJOIN", 3400);
  }
});

$("#btnAgain").onclick = ()=>{
  $("#over").classList.remove("show");
  if(mode === "royale"){ Net.leave(); showLobby(); netPaint(); }
  else playSolo();
};
$("#btnHome").onclick = toTitle;

$("#btnReset").onclick = ()=>{
  if(!confirm("Reset all upgrades, achievements and records?")) return;
  const keep = { volMusic:S.volMusic, volSfx:S.volSfx, music:S.music, sfx:S.sfx, name:S.name };
  Object.assign(S, def(), keep);
  save(); renderHUD(true); renderShop(); tag("UPGRADES RESET");
};

$("#btnFifty").onclick = useFifty;
$("#btnEvac").onclick  = useEvac;
$("#btnPause").onclick = ()=> MODE.togglePause();
$("#btnSubmit").onclick = ()=> submit();

$("#btnMusic").onclick = ()=>{
  S.music = !S.music; save();
  $("#btnMusic").textContent = S.music ? "🎵" : "🔕";
  $("#btnMusic").classList.toggle("off", !S.music);
  S.music ? AU.musicStart() : AU.musicStop();
  if(S.music) tag("MUSIC ON");
};
$("#btnSfx").onclick = ()=>{
  S.sfx = !S.sfx; save(); AU.setSfxVol();
  $("#btnSfx").textContent = S.sfx ? "🔊" : "🔇";
  $("#btnSfx").classList.toggle("off", !S.sfx);
  if(S.sfx) AU.play("click");
};
$("#volMusic").oninput = e => { S.volMusic = +e.target.value; save(); AU.musicVol(); };
$("#volSfx").oninput   = e => { S.volSfx = +e.target.value; save(); AU.init(); AU.setSfxVol(); };

/* ─────────────────────────── keyboard ─────────────────────────── */
document.addEventListener("keydown", e=>{
  if(e.target.tagName === "INPUT"){
    if(e.key === "Enter") $("#codeInput").blur();
    return;
  }
  const k = e.key.toLowerCase();
  if(k === "p"){ MODE.togglePause(); return; }
  if(!st.running || st.paused || st.spectating) return;
  if(k === "f"){ useFifty(); return; }
  if(k === "e"){ useEvac(); return; }
  if(k === "enter"){ submit(); return; }
  if(!st.q) return;
  if(st.q.t === "num"){
    if(/^[0-9]$/.test(k)){ numKey(k); return; }
    if(k === "backspace"){ e.preventDefault(); numKey("⌫"); return; }
    if(k === "delete" || k === "c"){ numKey("C"); return; }
    if(k === "." || k === ","){ numKey("."); return; }
    return;
  }
  if(["1","2","3","4","5","6"].includes(k)){
    const i = +k - 1;
    const b = $("#answers").children[i];
    if(!b || b.disabled) return;
    if(st.q.t === "multi") toggleMulti(i, b);
    else pickMC(i, b);
  }
});

/* ─────────────────────────── init ─────────────────────────── */
$("#nameInput").value = S.name || "";
$("#btnMusic").textContent = S.music ? "🎵" : "🔕";
$("#btnMusic").classList.toggle("off", !S.music);
$("#btnSfx").textContent = S.sfx ? "🔊" : "🔇";
$("#btnSfx").classList.toggle("off", !S.sfx);
$("#volMusic").value = S.volMusic;
$("#volSfx").value = S.volSfx;
$("#music").volume = S.volMusic / 100;

Solo.install();            // solo is the default mode
showScreen("start");
renderHUD(); renderShop();
lightning();
startFrame();
setTimeout(()=>$("#boot").classList.add("gone"), 500);
setTimeout(()=>{ const b = $("#boot"); if(b) b.remove(); }, 1200);

/* first real interaction unlocks WebAudio in every browser */
["pointerdown","keydown"].forEach(ev=>
  document.addEventListener(ev, function once(){
    safeAudio();
    document.removeEventListener(ev, once);
  }, { once:true }));