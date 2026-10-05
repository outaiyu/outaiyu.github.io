/* ════════════════════════════════════════════════════════════════════════
   solo.js — single-player mode.
   Installs its own MODE hooks into the shared engine and owns the endless
   question deck. This is the offline path: it never touches the network, so
   the game is fully playable even if Trystero fails to load.
   ════════════════════════════════════════════════════════════════════════ */
"use strict";

let soloQueue = [];
let nextTimer = null;   // tracked so a restart can't be hit by a stale timer

const Solo = (()=>{
  function reset(){
    clearTimeout(nextTimer); nextTimer = null;
    soloQueue = [];
    st.cash = 0;
    st.lives = 3 + lvl("life");
    st.maxLives = st.lives;
    st.streak = 0;
    st.qIndex = 0;
    st.bestStreak = 0;
    st.correct = 0;
    st.wrong = 0;
    st.total = 0;
    st.lastMilestone = 0;
    st.sinceFifty = 0;
    st.fiftyUsed = false;
    st.pendingNext = false;
    st.spectating = false;
    st.deadline = 0;
    S.runs++; save();
  }

  function draw(){
    if(!soloQueue.length) soloQueue = buildCycle();
    return soloQueue.shift();
  }

  /* next question, but never while paused — if the delay expires during a
     pause we flag it and togglePause() picks it up (otherwise soft-lock) */
  function scheduleNext(ms){
    clearTimeout(nextTimer);
    nextTimer = setTimeout(()=>{
      if(!st.running) return;
      if(st.paused){ st.pendingNext = true; return; }
      advance();
    }, ms);
  }
  function advance(){
    st.pendingNext = false;
    if(st.lives <= 0){ gameOver(); return; }
    installQuestion(draw(), 0);
    AU.storm(Math.min(1, st.qIndex / 26));
    if(st.qIndex > 4 && Math.random() < .3) lightning();
  }

  function start(){
    AU.resume(); AU.init(); AU.setSfxVol();
    reset();
    showScreen("game");
    document.body.classList.remove("dim", "storm", "royale");
    st.running = true;
    st.paused = false;
    renderHUD(true); renderShop();
    AU.play("start"); AU.musicStart();
    setTimeout(()=>{ AU.storm(0); AU.play("whoosh"); lightning(); }, 200);
    advance();
  }

  function gameOver(){
    st.running = false;
    st.deadline = 0;
    AU.musicStop(); AU.play("over");
    const record = st.cash > S.best;
    if(record) S.best = Math.round(st.cash);
    save();
    document.body.classList.add("dim");
    showResults({
      title: record && st.cash > 0 ? "NEW RECORD!" : "BANKRUPT",
      titleClass: record && st.cash > 0 ? "win" : "lose",
      msg: record && st.cash > 0
        ? "You beat your best run. The recovery money keeps rolling in."
        : "The storm took everything. Rebuild and try again.",
      cash: st.cash,
      stats:
        `Questions answered <b>${st.qIndex}</b> &nbsp;•&nbsp; Correct <b style="color:#4ade80">${st.correct}</b> &nbsp;•&nbsp; Wrong <b style="color:#ff5f6d">${st.wrong}</b><br>` +
        `Best streak <b style="color:#2ee6b6">${st.bestStreak}</b> &nbsp;•&nbsp; Milestones <b style="color:#ffc94d">${st.milestoneTier()}</b> &nbsp;•&nbsp; All-time best <b style="color:#ffd76e">${fmt(S.best)}</b><br>` +
        `Achievements <b style="color:#a78bfa">${S.ach.length}/${ACHIEVEMENTS.length}</b>`
    });
    if(record && st.cash > 0) confetti(90);
  }

  /* ── MODE hooks ── */
  function afterResolve(ok){
    if(st.lives <= 0){ setTimeout(gameOver, 1900); return; }
    scheduleNext(ok ? 1500 : 2900);
  }
  function afterTimeout(){
    if(st.lives <= 0){ setTimeout(gameOver, 2100); return; }
    scheduleNext(3200);
  }
  function afterEvac(){
    clearTimeout(nextTimer);
    nextTimer = setTimeout(()=>{ if(st.running && !st.answered && !st.paused) advance(); }, 900);
  }
  function togglePause(){
    if(!st.running) return;
    st.paused = !st.paused;
    $("#pausedBox").classList.toggle("show", st.paused);
    $("#btnPause").textContent = st.paused ? "▶" : "⏸";
    if(st.paused){ AU.musicStop(); }
    else {
      if(S.music) AU.musicStart();
      if(st.pendingNext) advance();
    }
  }

  function install(){
    MODE.name = "solo";
    MODE.livesLabel = "SHELTERS";
    /* Neutralise the net tick. install() is what the title screen runs to
       leave a room, so if we don't take this hook back the previous mode's
       tick keeps firing and drags the player back to the lobby forever. */
    MODE.tick = function(){};
    MODE.afterResolve = afterResolve;
    MODE.afterTimeout = afterTimeout;
    MODE.afterEvac = afterEvac;
    MODE.gameOver = gameOver;
    MODE.start = start;
    MODE.togglePause = togglePause;
  }

  return {install, start, gameOver, advance, togglePause};
})();