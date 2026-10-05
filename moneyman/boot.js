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

/* ─────────────────────────── mode switching ─────────────────────────── */
let mode = "solo";   // "solo" | "royale"

function toTitle(){
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
  AU.resume(); AU.init();
  mode = "solo";
  Solo.install();
  Solo.start();
}

function enterRoom(asHost){
  if(!Net.available()){
    netFail("The peer-to-peer library (vendor/trystero.js) did not load.");
    return;
  }
  rememberName();
  AU.resume(); AU.init();
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
    tag(asHost ? "ROOM OPEN — SHARE THE CODE" : "CONNECTING…", 2200);
    if(!asHost) AU.play("swoosh");
  }catch(err){
    netFail(err && err.message ? err.message : "Could not join the room.");
    toTitle();
  }
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
    AU.resume(); AU.init();
    document.removeEventListener(ev, once);
  }, { once:true }));