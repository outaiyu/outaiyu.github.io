/* ════════════════════════════════════════════════════════════════════════
   MONEYMAN — Hurricane Katrina Quiz Tycoon
   engine.js — shared core: question bank, upgrades, save data, audio, and
   the question renderers. Everything here is mode-agnostic: solo play and
   battle-royale multiplayer both drive the same renderer through `st`.
   ════════════════════════════════════════════════════════════════════════ */
"use strict";

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ───────────────────────────  QUESTION BANK  ──────────────────────────
   Six types: mc | tf | multi | num | ord | sld, plus an optional `boss` flag.
   Sourced from the Hurricane Katrina class presentation + NOAA / NHC records.
   ─────────────────────────────────────────────────────────────────── */

const BANK = [
/* ---------- MULTIPLE CHOICE ---------- */
{q:"Roughly how many people died as a result of Hurricane Katrina?",t:"mc",cat:"PEOPLE",diff:1,
 c:"About 1,800–1,900",w:["About 400","About 75,000","Exactly 1,170"],
 why:"Nationwide the toll was roughly <b>1,800–1,900</b>. Louisiana alone lost about 1,170."},
{q:"Most people who did not survive Katrina were in which age group?",t:"mc",cat:"PEOPLE",diff:2,
 c:"65 or older",w:["Under 5 years old","Teenagers","25 to 34 years old"],
 why:"About half of all Katrina deaths were people aged <b>65 or older</b>, many of whom had evacuated without critical medical support."},
{q:"Katrina is the costliest U.S. hurricane on record. What was the total cost in 2005 dollars?",t:"mc",cat:"COST",diff:1,
 c:"$108.3 billion",w:["$17 billion","$2.9 billion","$1.5 billion"],
 why:"Katrina (2005) totals about <b>$108.3 billion</b> in damage."},
{q:"About how many people lost their jobs in the 10 months after Katrina?",t:"mc",cat:"COST",diff:2,
 c:"Around 95,000",w:["Around 500","Around 5,000","Around 950,000"],
 why:"An estimated <b>95,000</b> jobs vanished in the ten months after the storm."},
{q:"What was the estimated value of those lost wages?",t:"mc",cat:"COST",diff:2,
 c:"$2.9 billion",w:["$290 million","$29 billion","$108.3 billion"],
 why:"Those job losses added up to roughly <b>$2.9 billion</b> in lost wages."},
{q:"When did Hurricane Katrina first form?",t:"mc",cat:"TIMELINE",diff:1,
 c:"August 23, 2005, over the Bahamas",w:["July 4, 2005","August 15, 2005","September 11, 2005"],
 why:"Katrina formed on <b>August 23, 2005</b> as a tropical wave over the southeastern Bahamas."},
{q:"On what date did Katrina reach its peak as a Category 5?",t:"mc",cat:"TIMELINE",diff:2,
 c:"August 28, 2005",w:["August 24, 2005","August 29, 2005","September 2, 2005"],
 why:"Katrina peaked as a <b>Category 5 on August 28</b> over the warm Gulf."},
{q:"How long did Katrina track westward across the Gulf before turning toward Louisiana?",t:"mc",cat:"TIMELINE",diff:2,
 c:"Roughly 4 days",w:["Roughly 12 hours","Roughly 2 weeks","Roughly 6 months"],
 why:"After clearing southern Florida she moved west across the Gulf for <b>about four days</b>, feeding on warm water."},
{q:"About what percentage of New Orleans was flooded?",t:"mc",cat:"DAMAGE",diff:1,
 c:"More than 80%",w:["About 5%","About 25%","Exactly 50%"],
 why:"Surge and levee failure left <b>over 80%</b> of New Orleans underwater — some areas for weeks."},
{q:"How much damage did Katrina cause in New Orleans alone?",t:"mc",cat:"DAMAGE",diff:2,
 c:"$17 billion",w:["$1.7 billion","$170 billion","$2.9 billion"],
 why:"New Orleans alone took about <b>$17 billion</b>, most of it from flooding rather than wind."},
{q:"About how many people died in Louisiana?",t:"mc",cat:"PEOPLE",diff:2,
 c:"About 1,170",w:["About 210","About 1,800","About 17,000"],
 why:"Louisiana recorded roughly <b>1,170 deaths</b> — more than any other Gulf Coast state."},
{q:"What category was Katrina when it made landfall?",t:"mc",cat:"STORM SCIENCE",diff:2,
 c:"Category 1",w:["Category 5","Category 3","Category 4"],
 why:"Katrina had weakened to a <b>Category 1</b> at landfall on August 29, but its surge was still catastrophic."},
{q:"Near which community did Katrina make landfall in Louisiana?",t:"mc",cat:"TIMELINE",diff:3,
 c:"Buras-Triumph, near the Mississippi River",w:["Galveston, Texas","Miami Beach, Florida","Key West, Florida"],
 why:"It came ashore near <b>Buras-Triumph, Louisiana</b>, just east of the Mississippi delta, around 6:10 a.m. August 29."},
{q:"Which New Orleans levee failure let the storm surge flood the city?",t:"mc",cat:"DAMAGE",diff:3,
 c:"The 17th Street Canal breach",w:["The Lake Pontchartrain Spillway","The Pearl River Levee","The Houston Ship Channel"],
 why:"The <b>17th Street Canal</b> walls gave way, and canals poured into the city. Water rose to 20 feet in places."},
{q:"How many levee and floodwall sections failed or were overtopped around New Orleans?",t:"mc",cat:"DAMAGE",diff:3,
 c:"More than 50",w:["Exactly 3","About 12","Exactly 100"],
 why:"More than <b>50</b> levee and floodwall sections failed or were overtopped around the city."},
{q:"Which famous stadium became a symbol of the disaster and housed tens of thousands?",t:"mc",cat:"AFTERMATH",diff:1,
 c:"The Superdome",w:["The Rose Bowl","The Cotton Bowl","Yankee Stadium"],
 why:"The <b>Superdome</b> sheltered tens of thousands, though conditions became dire — earning it the grim nickname 'death dome'."},
{q:"Roughly how many people were sheltering in the Superdome at its peak?",t:"mc",cat:"AFTERMATH",diff:3,
 c:"More than 30,000",w:["About 300","About 3,000","More than 300,000"],
 why:"At peak the Superdome held <b>over 30,000</b> people, with little food, water or sanitation."},
{q:"New Orleans relied on pumps to keep water out. What happened to them during Katrina?",t:"mc",cat:"DAMAGE",diff:3,
 c:"Many lost power and failed, flooding the city",w:["They worked perfectly throughout","They were never needed","They were drained before landfall"],
 why:"The city sits <b>below sea level</b> and depends on pumps. When backup power failed, pumps stopped and water poured in."},
{q:"Besides human lives and property, what environmental problems did Katrina leave behind?",t:"mc",cat:"AFTERMATH",diff:2,
 c:"Oil spills, storm debris and broken sewage and water systems",w:["An earthquake and tsunamis","A volcanic ash plume","A nuclear plant meltdown"],
 why:"Katrina left <b>oil spills, storm debris, mold</b> and wrecked sewage and water treatment systems."},
{q:"How long did the deepest parts of New Orleans stay underwater?",t:"mc",cat:"DAMAGE",diff:2,
 c:"Several weeks",w:["About 20 minutes","About 6 hours","Over a full year"],
 why:"The deepest neighbourhoods stayed flooded for <b>several weeks</b>, dry only after pumping them out."},
{q:"Roughly how far inland did Katrina's storm surge push in coastal Louisiana?",t:"mc",cat:"STORM SCIENCE",diff:3,
 c:"About 20–30 miles",w:["Only a few hundred yards","Over 100 miles","It never reached inland"],
 why:"The surge pushed roughly <b>20–30 miles inland</b>, drowning homes, crops and whole towns."},
{q:"Which unfinished flood-control project might have greatly reduced the flooding?",t:"mc",cat:"DAMAGE",diff:3,
 c:"The Lake Pontchartrain protection project",w:["The Hoover Dam levees","The Sacramento Flood Control Project","The Miami seawall"],
 why:"Incomplete, underfunded <b>Lake Pontchartrain</b> projects are widely cited as a major reason the city flooded."},
{q:"Roughly how many Americans were left homeless by Katrina?",t:"mc",cat:"PEOPLE",diff:2,
 c:"Hundreds of thousands",w:["About 200","Exactly 1,170","Over 10 million"],
 why:"Katrina displaced <b>hundreds of thousands</b>, housed in the Superdome or in tent cities."},
{q:"Which agency drew the most criticism for the failing levees?",t:"mc",cat:"AFTERMATH",diff:2,
 c:"The U.S. Army Corps of Engineers",w:["The National Weather Service","The Coast Guard","The FAA"],
 why:"The <b>Army Corps of Engineers</b>, which built and maintained many of the failing levees, faced intense criticism."},
{q:"How much did Katrina raise U.S. gas prices, per the class presentation?",t:"mc",cat:"COST",diff:2,
 c:"About 30 cents",w:["About 3 dollars","About 3 cents","Nothing at all"],
 why:"Refineries shutting down pushed gas up roughly <b>30 cents</b> a gallon in the weeks after the storm."},
{q:"Which states took the hardest hit from Katrina's landfall?",t:"mc",cat:"DAMAGE",diff:1,
 c:"Mississippi and Alabama",w:["New York and Vermont","Nevada and Idaho","Oregon and Washington"],
 why:"Katrina's eastern side devastated <b>Mississippi</b> — hardest hit of all — and <b>Alabama</b>."},
{q:"What caused the catastrophic flooding in New Orleans: wind or water?",t:"mc",cat:"STORM SCIENCE",diff:2,
 c:"Storm surge and levee failure",w:["The hurricane's wind alone","A tsunami from the Gulf","A levee built too tall"],
 why:"The city was spared the worst wind, but <b>storm surge breached the levees</b>. Water, not wind, destroyed it."},
{q:"About how tall was Katrina's storm surge along the Mississippi coast?",t:"mc",cat:"STORM SCIENCE",diff:3,
 c:"About 28 feet",w:["About 4 feet","About 10 feet","About 60 feet"],
 why:"The surge reached about <b>28 feet</b> near the mouth of the Mississippi, overtopping nearly everything."},
{q:"Which neighbourhoods of New Orleans flooded the worst?",t:"mc",cat:"DAMAGE",diff:3,
 c:"Low-lying areas behind the 17th Street Canal and the eastern levees",w:["The wealthy Garden District","Only the coastal beach","The French Quarter"],
 why:"The <b>low-lying neighbourhoods</b> behind the canal — largely poorer, Black neighbourhoods — flooded deepest and longest."},
{q:"Roughly how many barrels of oil per day did Gulf production lose at first?",t:"mc",cat:"COST",diff:2,
 c:"Millions of barrels per day",w:["About 40 barrels per day","Exactly zero","One barrel per day"],
 why:"Rigs and platforms shut down, taking <b>millions of barrels per day</b> off the market and spiking prices."},
{q:"What was the main criticism of FEMA's response?",t:"mc",cat:"AFTERMATH",diff:2,
 c:"Help, supplies and transport took far too long to arrive",w:["FEMA refused to raise any money","FEMA cancelled the storm","FEMA wrongly reported no damage"],
 why:"People waited days for <b>food, water and buses</b>, and criticism focused on slow federal coordination."},
{q:"How long after Katrina were New Orleans's drainage and levee upgrades substantially finished?",t:"mc",cat:"AFTERMATH",diff:3,
 c:"About five years",w:["Ten days","Exactly one year","They were never substantially finished"],
 why:"The post-Katrina repair and drainage upgrades took roughly <b>five years</b> to substantially finish."},
{q:"Katrina's surge broke the previous Gulf Coast record set by which earlier hurricane?",t:"mc",cat:"STORM SCIENCE",diff:4,boss:true,
 c:"Hurricane Camille (1969)",w:["Hurricane Betsy (1965)","Hurricane Audrey (1957)","Hurricane Hilda (1955)"],
 why:"Camille's 1969 surge of about 24 feet was surpassed by <b>Katrina's ~28 feet</b> — a record that still stands."},
{q:"Which official document criticised the federal response after the storm?",t:"mc",cat:"AFTERMATH",diff:3,
 c:"The report to Congress",w:["The Kyoto Protocol","The Nuremberg Trials record","The Marshall Plan summary"],
 why:"The official <b>report to Congress</b> found the federal response was slow and that key agencies had failed in their duties."},

{q:"Which state suffered the most storm-surge damage in Katrina, measured by homes destroyed?",t:"mc",cat:"DAMAGE",diff:4,boss:true,
 c:"Mississippi",w:["Louisiana","Alabama","Florida"],
 why:"Katrina's surge was most destructive along the <b>Mississippi</b> coast, where about 80% of the surge's energy hit hardest."},
{q:"About a third of New Orleans residents left and never came back. Roughly how many people lived in the city proper by the 2020 census, down from about 350,000 in 2000?",t:"mc",cat:"PEOPLE",diff:4,boss:true,
 c:"About 210,000",w:["About 300,000","About 120,000","About 500,000"],
 why:"The 2020 census counted roughly <b>210,000</b> people in New Orleans — down from about 350,000 in 2000."},

/* ---------- TRUE / FALSE ---------- */
{q:"TRUE or FALSE — Katrina was a Category 5 hurricane when it flooded New Orleans.",t:"tf",cat:"STORM SCIENCE",diff:1,
 c:"False",w:["True"],
 why:"False. It peaked as a <b>Category 5 over the Gulf</b>, then weakened to <b>Category 1</b> at landfall."},
{q:"TRUE or FALSE — Katrina caused more deaths in Louisiana than in any other Gulf state.",t:"tf",cat:"PEOPLE",diff:2,
 c:"True",w:["False"],
 why:"True. Louisiana lost roughly <b>1,170</b> people — more than any other Gulf Coast state."},
{q:"TRUE or FALSE — Most of New Orleans's damage came from wind rather than water.",t:"tf",cat:"DAMAGE",diff:2,
 c:"False",w:["True"],
 why:"False. The city barely took a direct hit; it was <b>storm surge and broken levees</b> that destroyed it."},
{q:"TRUE or FALSE — The Superdome was used as a mass evacuation shelter.",t:"tf",cat:"AFTERMATH",diff:1,
 c:"True",w:["False"],
 why:"True. It became the best-known shelter in the country, though conditions inside were terrible."},
{q:"TRUE or FALSE — Katrina hit the Gulf Coast in the winter.",t:"tf",cat:"TIMELINE",diff:1,
 c:"False",w:["True"],
 why:"False. Atlantic hurricane season runs June–November; Katrina hit on <b>August 29, 2005</b>."},
{q:"TRUE or FALSE — Katrina's peak sustained winds were about 175 mph.",t:"tf",cat:"STORM SCIENCE",diff:2,
 c:"True",w:["False"],
 why:"True. Katrina peaked near <b>175 mph</b> with a pressure around 902 mb over the Gulf."},
{q:"TRUE or FALSE — The 17th Street Canal was still intact after the storm.",t:"tf",cat:"DAMAGE",diff:2,
 c:"False",w:["True"],
 why:"False. Its walls <b>breached</b>, and the resulting channel was one of the main sources of floodwater."},
{q:"TRUE or FALSE — New Orleans sits below sea level and relies on pumps to stay dry.",t:"tf",cat:"STORM SCIENCE",diff:2,
 c:"True",w:["False"],
 why:"True. Much of the city is <b>below sea level</b>, so it depends on pumps and levees around the clock."},
{q:"TRUE or FALSE — Gasoline prices went down after Katrina because fuel was plentiful.",t:"tf",cat:"COST",diff:1,
 c:"False",w:["True"],
 why:"False. Refineries shut down, so fuel was <b>scarce</b> and prices climbed sharply."},

/* ---------- SELECT ALL THAT APPLY ---------- */
{q:"SELECT ALL — Which of these made the New Orleans flooding worse?",t:"multi",cat:"DAMAGE",diff:4,
 c:["Levees and floodwalls failing","Storm surge higher than expected","Pumps losing power"],w:["An unusually low tide"],
 why:"Levee failure, an extreme surge and dead pumps all compounded. An unusually low tide would have made flooding <b>less</b> likely."},
{q:"SELECT ALL — Which were major consequences of Hurricane Katrina?",t:"multi",cat:"COST",diff:3,
 c:["Mass job losses","Widespread mold","Higher gas prices"],w:["A worldwide internet blackout"],
 why:"Job losses, mold and higher fuel prices were all real consequences. There was no global internet blackout."},
{q:"SELECT ALL — Which statements about Katrina's death toll are correct?",t:"multi",cat:"PEOPLE",diff:4,
 c:["Nationwide it was roughly 1,800–1,900","Louisiana lost about 1,170","Most of those who died were 65 or older"],w:["No one died in Mississippi"],
 why:"Those three are all correct. Mississippi also lost hundreds of people, so the last statement is false."},
{q:"SELECT ALL — Which helped make the disaster so severe?",t:"multi",cat:"AFTERMATH",diff:4,
 c:["Levee systems that were incomplete","Pumps that were not fully restored after earlier hurricanes","Years of underfunding"],w:["A total absence of any federal help"],
 why:"Incomplete levees, unrestored pumps and years of underfunding all stacked up. There was federal help — the complaint was that it was slow and badly organised."},

/* ---------- TYPE A NUMBER ---------- */
{q:"TYPE IT — Roughly how many people died nationwide (round to the nearest 50)?",t:"num",cat:"PEOPLE",diff:3,
 c:1850,tol:75,unit:"people",
 why:"Nationwide the toll was about <b>1,800–1,900</b>, commonly given as roughly 1,850."},
{q:"TYPE IT — What was the total cost of Katrina in BILLIONS of 2005 dollars?",t:"num",cat:"COST",diff:2,
 c:108,tol:4,unit:"billion dollars",
 why:"Katrina cost about <b>$108.3 billion</b>, making it the costliest U.S. hurricane on record."},
{q:"TYPE IT — What percentage of New Orleans was flooded? (round to the nearest 5)",t:"num",cat:"DAMAGE",diff:3,
 c:80,tol:6,unit:"percent",
 why:"More than <b>80%</b> of the city was flooded, with the deepest areas staying under water for weeks."},
{q:"TYPE IT — How many people died in Louisiana? (round to the nearest 10)",t:"num",cat:"PEOPLE",diff:3,
 c:1170,tol:25,unit:"people",
 why:"Louisiana's toll was about <b>1,170</b> — more than any other Gulf Coast state."},
{q:"TYPE IT — About how many people lost their jobs after Katrina? (round to the nearest 1,000)",t:"num",cat:"COST",diff:3,
 c:95000,tol:6000,unit:"people",
 why:"An estimated <b>95,000</b> jobs were lost within ten months of the storm."},
{q:"TYPE IT — How many billion dollars of damage did New Orleans alone take?",t:"num",cat:"DAMAGE",diff:3,
 c:17,tol:2,unit:"billion dollars",
 why:"New Orleans alone sustained about <b>$17 billion</b> in damage."},
{q:"TYPE IT — On what DAY of August 2005 did Katrina make landfall in Louisiana?",t:"num",cat:"TIMELINE",diff:3,
 c:29,tol:0,unit:"(day number)",
 why:"Katrina made landfall on <b>August 29, 2005</b>, around 6:10 a.m."},

/* ---------- PUT IN ORDER ---------- */
{q:"PUT IN ORDER — Arrange Katrina's life, earliest first.",t:"ord",cat:"TIMELINE",diff:3,
 c:["Forms as a tropical wave over the Bahamas","Becomes a tropical storm","Peaks as a Category 5 over the Gulf","Makes landfall in Louisiana"],
 why:"The classic progression: <b>tropical wave → tropical storm → Category 5 → landfall</b>."},
{q:"PUT IN ORDER — What happened inside New Orleans, first to last?",t:"ord",cat:"DAMAGE",diff:4,
 c:["Storm surge rises above the levees","Levee and floodwalls are overtopped","Water pours through the breaches","The pumps lose power and stop"],
 why:"Surge overtopped the walls, breaches opened, water gushed in, and dead pumps made it far worse."},
{q:"PUT IN ORDER — How a hurricane strengthens from nothing, earliest first.",t:"ord",cat:"STORM SCIENCE",diff:2,
 c:["Tropical wave","Tropical depression","Tropical storm","Hurricane"],
 why:"A wave becomes a <b>depression</b> (under 39 mph), then a <b>storm</b> (39–73 mph), then a <b>hurricane</b> (74+ mph)."},
{q:"PUT IN ORDER — Track the human side of the response, earliest first.",t:"ord",cat:"AFTERMATH",diff:4,
 c:["Levees breach and the city floods","Residents turn to the Superdome for shelter","Supplies run out inside the Superdome","Federal relief and buses finally arrive"],
 why:"Flooding came first, then shelter, then deprivation, and only then organised federal relief — a painful sequence."},

/* ---------- SLIDER GUESS ---------- */
{q:"SLIDER — Roughly what percentage of New Orleans was flooded?",t:"sld",cat:"DAMAGE",diff:2,
 min:0,max:100,step:1,c:80,tol:5,unit:"%",
 why:"More than <b>80%</b> of the city was under water."},
{q:"SLIDER — How far inland did the surge push, in miles?",t:"sld",cat:"STORM SCIENCE",diff:3,
 min:0,max:60,step:1,c:25,tol:6,unit:" miles",
 why:"The surge ran roughly <b>20–30 miles inland</b>, devastating coastal parishes."},
{q:"SLIDER — How many years did it take to substantially finish the city's levee and drainage upgrades?",t:"sld",cat:"AFTERMATH",diff:3,
 min:0,max:15,step:1,c:5,tol:1.5,unit:" years",
 why:"Substantially complete took roughly <b>five years</b> after the storm."},
{q:"SLIDER — What year did Hurricane Katrina hit the Gulf Coast?",t:"sld",cat:"TIMELINE",diff:1,
 min:2000,max:2012,step:1,c:2005,tol:0.001,unit:"",
 why:"Katrina struck on <b>August 29, 2005</b>."}
];

const TYPE_LABEL = {mc:"🎯 MULTIPLE CHOICE",tf:"⚖️ TRUE / FALSE",multi:"☑️ SELECT ALL THAT APPLY",
                    num:"🔢 TYPE A NUMBER",ord:"🔀 PUT IN ORDER",sld:"🎚️ SLIDER GUESS"};


/* ───────────────────────────  UPGRADES & SAVE DATA  ────────────────── */

const UPGRADES = [
 {id:"time", ico:"🧱", name:"Reinforced Levees",   desc:"+4 seconds on every question",                    base:120, growth:1.75, max:10},
 {id:"pay",  ico:"💰", name:"Recovery Grants",     desc:"+20% cash on every payout",                       base:180, growth:1.85, max:10},
 {id:"mult", ico:"⚡", name:"Sprint Power",        desc:"+0.5x added to your streak multiplier",           base:220, growth:1.95, max:5},
 {id:"slow", ico:"🌀", name:"Calm Before The Eye", desc:"Timer drains 7% slower per level",               base:260, growth:2.00, max:6},
 {id:"life", ico:"🏠", name:"FEMA Shelter",        desc:"+1 permanent shelter (max 3)",                   base:400, growth:2.60, max:3},
 {id:"luck", ico:"🍀", name:"Golden Lifeline",     desc:"+10% chance to double any payout",                base:320, growth:1.80, max:5},
 {id:"fifty", ico:"🛰️", name:"Emergency Satellite", desc:"50/50 lifeline, recharges every 5 questions",      base:450, growth:2.20, max:1},
 {id:"evac",  ico:"🚗", name:"Evacuate Early",      desc:"Buy one charge to skip a question",              base:90,  growth:1.35, max:99, charges:true}
];

const ACHIEVEMENTS = [
 {id:"first", ico:"🎯", name:"First Blood"},   {id:"streak5", ico:"🔥", name:"On Fire"},
 {id:"streak10",ico:"⚡", name:"Unstoppable"},   {id:"streak20",ico:"💀", name:"Perfect Run"},
 {id:"boss",   ico:"☠️", name:"Boss Slayer"},   {id:"k1",      ico:"💵", name:"Five Figures"},
 {id:"k2",     ico:"💎", name:"Six Figures"},   {id:"shop",    ico:"🛒", name:"Shopaholic"},
 {id:"fast",   ico:"⚡", name:"Speed Demon"},   {id:"allr",    ico:"🧠", name:"Historian"}
];

/* ───────────────────────────  RUN STATE  ─────────────────────────────
   `st` describes MY current round view. In solo the game fills it; in
   multiplayer the host assigns the question and pushes it in. The renderers
   and scoring code are identical for both modes.
   ─────────────────────────────────────────────────────────────────── */

const KEY = "moneyman_katrina_v2";
const S = load();
function load(){
  try{
    const r = localStorage.getItem(KEY);
    if(!r) return def();
    const s = JSON.parse(r);
    s.up = s.up || {}; s.ach = s.ach || []; s.evac = s.evac || 0;
    s.best = s.best || 0; s.music = s.music !== false; s.sfx = s.sfx !== false;
    s.volMusic = s.volMusic ?? 26; s.volSfx = s.volSfx ?? 75;
    s.name = s.name || "";
    return s;
  }catch(e){ return def(); }
}
function def(){ return {up:{},ach:[],evac:0,best:0,runs:0,music:true,sfx:true,volMusic:26,volSfx:75,name:""}; }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

const lvl = id => S.up[id] || 0;
const cost = u => Math.round(u.base * Math.pow(u.growth, lvl(u.id)));
const mult = () => (1 + st.streak * 0.10) + lvl("mult") * 0.5;
const st = {
  cash:0, lives:3, maxLives:3, streak:0, qIndex:0, bestStreak:0, total:0,
  timeLeft:0, timeMax:1, deadline:0, running:false, paused:false, answered:false,
  spectating:false, q:null, opts:[], sel:[], order:[], sinceFifty:0, correct:0, wrong:0,
  lastMilestone:0, fiftyUsed:false, numBuf:"", pendingNext:false
};
let queue = [];


/* ───────────────────────────  AUDIO  ─────────────────────────────────
   Everything is synthesised at runtime: SFX, the wind/rain ambience and
   the music loop. There are no audio files to fetch — nothing to 404, no
   binary payload, and it works from a plain file:// as happily as https.
   Music and SFX run through separate buses so each has its own volume.
   ─────────────────────────────────────────────────────────────────── */

const AU = (()=>{
  let ctx=null, bus=null, mbus=null, noise=null, wind=null, windF=null, windG=null, rainG=null;
  let procTimer=null, procStep=0, duckT=null;

  function init(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 8;
    comp.attack.value = .004; comp.release.value = .25;
    bus = ctx.createGain();
    bus.gain.value = S.volSfx / 100;
    bus.connect(comp);
    mbus = ctx.createGain();
    mbus.gain.value = S.volMusic / 100;
    mbus.connect(comp);
    comp.connect(ctx.destination);

    // shared noise buffer
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2 - 1;

    startAmbience();
    if(S.music) procStart();
    return ctx;
  }
  function resume(){ init(); if(ctx && ctx.state === "suspended") ctx.resume(); }

  function tone(f, dur, {type="sine", vol=.2, at=0, slideTo=null, detune=0}={}, dest=null){
    if(!S.sfx || !ctx) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(.02, dur*.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || bus); o.start(t0); o.stop(t0 + dur + .02);
  }
  function burst(dur, {vol=.2, freq=1200, q=1, type="bandpass", at=0, sweepTo=null, rate=1}={}, dest=null){
    if(!S.sfx || !ctx) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if(sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(.03, dur*.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || bus);
    src.start(t0, Math.random() * 1.2); src.stop(t0 + dur + .02);
  }

  /* ---- ambience: wind + rain bed ---- */
  function startAmbience(){
    if(!ctx || wind) return;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    windF = ctx.createBiquadFilter(); windF.type = "bandpass"; windF.frequency.value = 480; windF.Q.value = .7;
    windG = ctx.createGain(); windG.gain.value = 0;
    src.connect(windF); windF.connect(windG); windG.connect(ctx.destination);
    src.start();
    wind = src;
    // slow LFO on wind so it gusts
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = .09; lg.gain.value = 240;
    lfo.connect(lg); lg.connect(windF.frequency); lfo.start();

    const rsrc = ctx.createBufferSource(); rsrc.buffer = noise; rsrc.loop = true; rsrc.playbackRate.value = 1.7;
    const rf = ctx.createBiquadFilter(); rf.type = "highpass"; rf.frequency.value = 2600;
    rainG = ctx.createGain(); rainG.gain.value = .012;
    rsrc.connect(rf); rf.connect(rainG); rainG.connect(ctx.destination);
    rsrc.start();
  }
  function storm(x){
    if(!ctx || !windG) return;
    const t = ctx.currentTime;
    windG.gain.setTargetAtTime(.035 + x*.10, t, 1.2);
    windF.frequency.setTargetAtTime(420 + x*420, t, 1.5);
    rainG.gain.setTargetAtTime(.010 + x*.026, t, 1.2);
  }

  /* ---- music: a 128bpm electro loop, synthesised ---- */
  function musicStart(){ if(S.music){ init(); procStart(); } }
  function musicStop(){ procStop(); }
  function musicVol(){
    if(mbus) mbus.gain.value = S.volMusic / 100;
    if(S.music) procStart(); else procStop();
  }

  // duck the music briefly so SFX cut through
  function duck(ms=320, amt=.55){
    if(!S.music || !mbus) return;
    const base = S.volMusic / 100;
    mbus.gain.cancelScheduledValues(ctx.currentTime);
    mbus.gain.setTargetAtTime(base * amt, ctx.currentTime, .02);
    clearTimeout(duckT);
    duckT = setTimeout(()=>{
      if(mbus) mbus.gain.setTargetAtTime(S.music ? S.volMusic/100 : base, ctx.currentTime, .08);
    }, ms);
  }

  const SCALE=[0,3,5,7,10,12];
  function procStart(){
    if(procTimer || !ctx) return;
    const bpm = 128, spb = 60/bpm/2;   // eighth notes
    procStep = 0;
    procTimer = setInterval(()=>{
      if(!S.music || !ctx || ctx.state!=="running" || !mbus) return;
      const M = mbus;
      const s = procStep % 16, bar = Math.floor(procStep/16);
      // kick
      if(s%2===0) tone(150,.16,{type:"sine",vol:.5,slideTo:44},M);
      // hat
      if(s%2===1) burst(.035,{vol:.09,freq:8200,q:.8,type:"highpass"},M);
      if(s===4||s===12) burst(.09,{vol:.16,freq:1900,q:.7},M);
      // bass
      const roots=[55,55,65.41,49];
      const rf=roots[bar%4] * (s<8?1:1.5);
      if(s%2===0) tone(rf,.19,{type:"sawtooth",vol:.14},M);
      // arp
      if(s%2===1){
        const n = SCALE[(s+bar)%SCALE.length];
        tone(220*Math.pow(2,n/12),.11,{type:"square",vol:.055,detune:8},M);
      }
      // every 8 bars, open the filter up for a bar so it doesn't loop flatly
      if(bar%8===7 && s===0){
        const pad = ctx.createGain(); pad.gain.value = .05;
        pad.connect(M);
        [0,7,12].forEach(n=>{
          const o=ctx.createOscillator(); o.type="sawtooth";
          o.frequency.value=220*Math.pow(2,n/12);
          o.connect(pad); o.start(); o.stop(ctx.currentTime+spb*16);
        });
      }
      procStep++;
    }, spb*1000);
  }
  function procStop(){ if(procTimer){ clearInterval(procTimer); procTimer = null; } }

  /* ---- the SFX kit ---- */
  const sfx = {
    click(){ tone(700,.05,{type:"square",vol:.09}); },
    correct(){ [0,4,7,12].forEach((n,i)=>tone(523.25*Math.pow(2,n/12),.16,{type:"triangle",vol:.2,at:i*.055})); },
    correctBoss(){ [0,4,7,12,16,19].forEach((n,i)=>tone(392*Math.pow(2,n/12),.2,{type:"sawtooth",vol:.13,at:i*.05}));
                   burst(.7,{vol:.2,freq:320,q:.6,sweepTo:5200,type:"bandpass"}); },
    wrong(){ tone(220,.34,{type:"sawtooth",vol:.22,slideTo:62}); burst(.34,{vol:.2,freq:420,q:.5,type:"lowpass",sweepTo:120}); },
    coin(){ tone(988,.06,{type:"square",vol:.14}); tone(1319,.11,{type:"square",vol:.13,at:.055}); },
    buy(){ tone(392,.09,{type:"triangle",vol:.18}); tone(587,.13,{type:"triangle",vol:.17,at:.07}); },
    levelup(){ [0,4,7,11,12].forEach((n,i)=>tone(440*Math.pow(2,n/12),.22,{type:"triangle",vol:.19,at:i*.075})); },
    streak(){ tone(1046,.1,{type:"sine",vol:.2}); tone(1568,.2,{type:"sine",vol:.16,at:.07}); tone(2093,.3,{type:"sine",vol:.1,at:.14}); },
    jackpot(){ for(let i=0;i<10;i++) tone(523*Math.pow(2,i/6),.09,{type:"square",vol:.12,at:i*.035});
               burst(.9,{vol:.16,freq:900,q:.4,sweepTo:8000}); },
    tick(){ tone(1500,.03,{type:"square",vol:.05}); },
    warn(){ tone(440,.09,{type:"square",vol:.1}); tone(440,.09,{type:"square",vol:.1,at:.13}); },
    thunder(){ burst(1.5,{vol:.34,freq:260,q:.4,type:"lowpass",sweepTo:55,rate:.55});
               tone(58,1.1,{type:"sine",vol:.26,slideTo:30}); },
    whoosh(){ burst(.55,{vol:.16,freq:300,q:.6,sweepTo:3200}); },
    start(){ [0,7,12].forEach((n,i)=>tone(262*Math.pow(2,n/12),.3,{type:"sawtooth",vol:.12,at:i*.08}));
             burst(.8,{vol:.14,freq:400,q:.5,sweepTo:4000}); },
    over(){ [0,-2,-5,-9,-12].forEach((n,i)=>tone(392*Math.pow(2,n/12),.42,{type:"triangle",vol:.19,at:i*.16}));
            burst(1.4,{vol:.2,freq:300,q:.5,type:"lowpass",sweepTo:60,rate:.5}); },
    select(){ tone(880,.05,{type:"sine",vol:.11}); },
    swoosh(){ burst(.3,{vol:.1,freq:1800,q:.8,sweepTo:500}); },
    boss(){ tone(110,.7,{type:"sawtooth",vol:.3,slideTo:55}); burst(.9,{vol:.3,freq:200,q:.5,type:"lowpass",sweepTo:60,rate:.6});
            tone(220,.5,{type:"square",vol:.1,at:.1}); }
  };
  function play(name){ if(!S.sfx) return; try{ sfx[name] && sfx[name](); }catch(e){} }
  function setSfxVol(){ if(bus) bus.gain.value = S.volSfx / 100; }

  return {init, resume, play, duck, storm, musicStart, musicStop, musicVol, setSfxVol,
          get ready(){ return !!ctx; }};
})();


/* ───────────────────────────  FORMATTING  ──────────────────────────── */

function fmt(n){
  if(n>=1e12) return "$"+(n/1e12).toFixed(2)+"T";
  if(n>=1e9)  return "$"+(n/1e9).toFixed(2)+"B";
  if(n>=1e6)  return "$"+(n/1e6).toFixed(2)+"M";
  if(n>=1e4)  return "$"+Math.round(n/1e3)+"K";
  return "$"+Math.round(n).toLocaleString();
}
const num = n => n.toLocaleString();

/* ════════════════════════════════════════════════════════════════════════
   MODE HOOK — solo.js and net.js each install one of these so the shared
   renderer/scoring code below never needs to know which mode is running.
   ════════════════════════════════════════════════════════════════════════ */
const MODE = {
  name: "solo",
  livesLabel: "SHELTERS",
  onAdvance(){},       // called when it is time for the next question
  afterResolve(){},    // called after the player answers (ok = boolean)
  afterTimeout(){},    // called when the clock runs out
  afterEvac(){},       // called when an evac charge is burned
  onBuy(){},           // called after an upgrade is bought
  gameOver(){},        // called when the run ends
  togglePause(){},     // called by the pause button
  tick(){}             // per-frame hook
};

/* ════════════════════════════════════════════════════════════════════════
   DECK — interleaves the six question types and drops a boss in every 5th
   ════════════════════════════════════════════════════════════════════════ */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

function layout(){
  const buckets = {};
  BANK.forEach(q => (buckets[q.t] = buckets[q.t] || []).push(q));
  Object.values(buckets).forEach(shuffle);
  const order = ["mc","tf","multi","num","ord","sld"];
  const out = [];
  let added = true;
  while(added){
    added = false;
    order.forEach(t=>{
      if(buckets[t] && buckets[t].length){ out.push(buckets[t].pop()); added = true; }
    });
  }
  return out;
}
function buildCycle(){
  const bosses = BANK.filter(q=>q.boss);
  const rest = layout().filter(q=>!q.boss);
  const out = [];
  for(let i=0;i<rest.length;i++){
    out.push(rest[i]);
    if((i+1) % 5 === 0 && bosses.length) out.push(bosses[((i+1)/5 - 1) % bosses.length]);
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════
   QUESTION INSTALL — the single place a question enters the UI.
   Both modes call this; multiplayer just supplies a host-assigned question.
   ════════════════════════════════════════════════════════════════════════ */
function baseSeconds(){
  return Math.max(7, 21 - st.qIndex * 0.32);
}
/* slow-mo is folded into the deadline once, rather than per frame, so the
   countdown can be driven from an absolute timestamp (which multiplayer needs). */
function installQuestion(q, extraSeconds, baseOverride){
  st.q = q;
  st.qIndex++;
  st.answered = false;
  st.sinceFifty++;
  st.fiftyUsed = false;
  st.sel = [];
  st.order = [];
  st.numBuf = "";

  if(q.t === "ord")        st.opts = q.c.slice();
  else if(q.t === "multi") st.opts = [...q.c, ...(q.w || [])];
  else                      st.opts = [q.c, ...(q.w || [])];
  shuffle(st.opts);

  // solo ramps off the local question index; multiplayer passes baseOverride
  // from the host so every player in a round shares one difficulty curve.
  const base = (baseOverride != null ? baseOverride : baseSeconds());
  const nominal = base + lvl("time") * 4 + (extraSeconds || 0);
  st.timeMax = nominal / (1 - lvl("slow") * 0.07);
  st.deadline = Date.now() + st.timeMax * 1000;
  st.timeLeft = st.timeMax;

  $("#qcat").textContent  = q.cat;
  $("#qtype").textContent = TYPE_LABEL[q.t];
  $("#qdif").textContent  = "DIFFICULTY " + "★".repeat(q.diff || 1);
  $("#qprog").style.width = Math.min(100, st.qIndex * 3) + "%";
  $("#why").style.display = "none";
  $("#qHint").innerHTML = "💡 " + ({
    mc:"Pick one answer.", tf:"Pick one answer.",
    multi:"Select EVERY option that applies, then lock it in.",
    num:"Type the number. " + (q.c >= 1000 ? "Commas are fine." : ""),
    ord:"Click the items in the correct order, earliest first.",
    sld:"Slide as close as you can, then lock it in."
  }[q.t]);
  if(q.boss) $("#qtype").textContent = "☠️ BOSS · " + TYPE_LABEL[q.t];

  const qt = $("#qText");
  qt.textContent = q.q;
  qt.style.animation = "none"; void qt.offsetWidth; qt.style.animation = "";

  renderQuestion();
  renderHUD();
}

/* ════════════════════════════════════════════════════════════════════════
   RENDERERS — one per question type
   ════════════════════════════════════════════════════════════════════════ */
function renderQuestion(){
  const box = $("#answers");
  box.innerHTML = "";
  const sub = $("#submitRow");
  sub.style.display = "none";
  const t = st.q.t;

  if(t === "mc" || t === "tf"){
    box.className = t === "tf" ? "tfgrid" : "";
    st.opts.forEach((txt,i)=>{
      const b = document.createElement("button");
      b.className = "ans";
      b.innerHTML = `<span class="key">${t === "tf" ? txt[0] : (i+1)}</span><span>${txt}</span><span class="tick"></span>`;
      b.onclick = ()=>pickMC(i,b);
      box.appendChild(b);
    });
  }
  else if(t === "multi"){
    st.opts.forEach((txt,i)=>{
      const b = document.createElement("button");
      b.className = "ans";
      b.innerHTML = `<span class="key">${i+1}</span><span>${txt}</span><span class="tick"></span>`;
      b.onclick = ()=>toggleMulti(i,b);
      box.appendChild(b);
    });
    showSubmit("LOCK IT IN ⏎");
  }
  else if(t === "num"){
    const w = document.createElement("div");
    w.className = "numwrap";
    w.innerHTML = `<div><div class="numdisplay empty" id="numDisp">?</div>
      <div class="slmarks" style="margin-top:6px"><span id="numUnit">${st.q.unit || ""}</span><span id="numTol">±${st.q.tol}</span></div></div>
      <div class="keypad"></div>`;
    box.appendChild(w);
    const kp = w.querySelector(".keypad");
    ["1","2","3","4","5","6","7","8","9","C","0","⌫"].forEach(k=>{
      const b = document.createElement("button");
      b.textContent = k;
      if(k === "⌫" || k === "C") b.className = "w";
      b.onclick = ()=>numKey(k);
      kp.appendChild(b);
    });
    showSubmit("LOCK IT IN ⏎");
  }
  else if(t === "ord"){
    const l = document.createElement("div");
    l.className = "ordlist";
    box.appendChild(l);
    shuffle(st.opts.slice()).forEach(txt=>{
      const d = document.createElement("div");
      d.className = "orditem";
      d.dataset.txt = txt;
      d.innerHTML = `<span class="num">·</span><span>${txt}</span><span class="rm">CLICK TO PLACE</span>`;
      d.onclick = ()=>pickOrder(d);
      l.appendChild(d);
    });
    showSubmit("LOCK IT IN ⏎");
  }
  else if(t === "sld"){
    const b = document.createElement("div");
    b.className = "sldbox";
    b.innerHTML = `<div class="sldval" id="sldVal">?</div>
      <div class="sldhint" id="sldHint">SLIDE TO GUESS</div>
      <input type="range" id="sld" min="${st.q.min}" max="${st.q.max}" step="${st.q.step || 1}" value="${Math.round((st.q.min + st.q.max) / 2)}">
      <div class="slmarks"><span>${st.q.min}${st.q.unit || ""}</span><span>${st.q.max}${st.q.unit || ""}</span></div>`;
    box.appendChild(b);
    const sl = b.querySelector("#sld");
    sl.addEventListener("input", ()=>{
      const v = +sl.value;
      $("#sldVal").textContent = v + (st.q.unit || "");
      const err = Math.abs(v - st.q.c), h = $("#sldHint");
      if(err <= st.q.tol){ h.textContent = "LOCKING HOT 🔥"; h.className = "sldhint hot"; }
      else if(err <= st.q.tol * 3){ h.textContent = "WARM"; h.className = "sldhint warm"; }
      else { h.textContent = "COLD"; h.className = "sldhint cold"; }
    });
    sl.dispatchEvent(new Event("input"));
    showSubmit("LOCK IT IN ⏎");
  }
  renderTools();
}
function showSubmit(label){
  const sub = $("#submitRow");
  sub.style.display = "block";
  $("#btnSubmit").textContent = label;
  updateSubmit();
}

/* ════════════════════════════════════════════════════════════════════════
   INTERACTION
   ════════════════════════════════════════════════════════════════════════ */
function playable(){ return st.running && !st.paused && !st.answered && !st.spectating; }

function pickMC(i, btn){
  if(!playable() || i < 0 || i >= st.opts.length) return;
  resolve(st.opts[i] === st.q.c, ()=>1, btn);
}
function toggleMulti(i, btn){
  if(!playable() || i < 0 || i >= st.opts.length) return;
  const k = st.sel.indexOf(i);
  if(k >= 0){
    st.sel.splice(k,1);
    if(btn){ btn.classList.remove("sel"); btn.querySelector(".tick").textContent = ""; }
  } else {
    st.sel.push(i);
    if(btn){ btn.classList.add("sel"); btn.querySelector(".tick").textContent = "✓"; }
  }
  AU.play("select");
  updateSubmit();
}
function numKey(k){
  if(!playable() || st.q.t !== "num") return;
  if(k === "C") st.numBuf = "";
  else if(k === "⌫") st.numBuf = st.numBuf.slice(0,-1);
  else if(st.numBuf.length < 9) st.numBuf += k;
  const d = $("#numDisp");
  if(d){ d.textContent = st.numBuf || "?"; d.classList.toggle("empty", !st.numBuf); }
  AU.play("select");
  updateSubmit();
}
function pickOrder(el){
  if(!playable() || !el) return;
  const txt = el.dataset.txt;
  const k = st.order.indexOf(txt);
  if(k >= 0) st.order.splice(k,1); else st.order.push(txt);
  refreshOrder();
  AU.play("select");
  updateSubmit();
}
function refreshOrder(){
  $$(".orditem").forEach(el=>{
    const k = st.order.indexOf(el.dataset.txt);
    el.classList.toggle("placed", k >= 0);
    el.querySelector(".num").textContent = k >= 0 ? (k+1) : "·";
    el.querySelector(".rm").textContent = k >= 0 ? "REMOVE" : "CLICK TO PLACE";
  });
}
function updateSubmit(){
  const b = $("#btnSubmit");
  if(!b || !st.q) return;
  let ok = false;
  if(st.q.t === "multi")    ok = st.sel.length > 0;
  else if(st.q.t === "num") ok = st.numBuf.length > 0;
  else if(st.q.t === "ord") ok = st.order.length === st.q.c.length;
  else if(st.q.t === "sld") ok = true;
  b.disabled = !ok;
}
function submit(){
  if(!playable()) return;
  const q = st.q;
  if(q.t === "multi"){
    const picked = st.sel.map(i=>st.opts[i]);
    const noWrong = picked.every(p=>q.c.includes(p));
    const hits = q.c.filter(c=>picked.includes(c)).length;
    if(noWrong && hits === q.c.length)     resolve(true,  ()=>1, null);
    else if(noWrong && hits > 0)           resolve(true,  ()=>hits/q.c.length, null, hits, q.c.length);
    else                                   resolve(false, ()=>0, null, hits, q.c.length);
  }
  else if(q.t === "num"){
    const v = parseFloat(st.numBuf.replace(/,/g,""));
    if(isNaN(v)) return;
    resolve(Math.abs(v - q.c) <= q.tol, ()=>1, null, v);
  }
  else if(q.t === "ord"){
    resolve(st.order.length === q.c.length && st.order.every((x,i)=>x === q.c[i]), ()=>1, null, null);
  }
  else if(q.t === "sld"){
    const v = +$("#sld").value;
    resolve(Math.abs(v - q.c) <= q.tol, ()=>1, null, v);
  }
}

/* ════════════════════════════════════════════════════════════════════════
   SCORING — cash, streak and multipliers are local (the player's own
   business). Shields, elimination and round flow are the host's.
   ════════════════════════════════════════════════════════════════════════ */
function payout(speed, partial){
  partial = (partial === undefined) ? 1 : partial;
  const base = 20 + st.qIndex * 4;
  let g = Math.round(base * (1 + lvl("pay") * .20) * mult() * (1 + speed * .60) * partial * (st.q.boss ? 3 : 1));
  if(Math.random() < lvl("luck") * .10){
    g *= 2;
    setTimeout(()=>{ bigWord("JACKPOT x2"); confetti(24); }, 80);
    AU.play("jackpot");
  }
  return g;
}
st.milestoneTier = function(){
  const tiers = [10000,25000,50000,100000,250000,500000,1000000];
  let n = 0;
  for(const t of tiers) if(st.cash >= t) n++;
  return n;
};

/* Losing a shelter is the shared penalty for a wrong answer or a timeout.
   Royale is host-authoritative, so this only mirrors what the host already
   decided — the next snapshot confirms the same number. */
function loseShelter(){
  st.lives = Math.max(0, st.lives - 1);
  if(st.lives > 0) bigWord("−1 " + MODE.livesLabel + " · " + st.lives + " LEFT");
  else           bigWord("NO " + MODE.livesLabel + " LEFT");
  return st.lives;
}
function resolve(ok, partialFn, btn, extra, extra2){
  st.answered = true;
  const q = st.q;
  const speed = Math.max(0, st.timeLeft / st.timeMax);
  const kids = $$("#answers .ans");

  if(q.t === "mc" || q.t === "tf"){
    kids.forEach((b,i)=>{
      b.disabled = true;
      if(st.opts[i] === q.c){ b.classList.add("right"); b.querySelector(".tick").textContent = "✔"; }
    });
    if(btn && !ok){ btn.classList.add("wrong"); btn.querySelector(".tick").textContent = "✘"; }
  }
  else if(q.t === "multi"){
    kids.forEach((b,i)=>{
      b.disabled = true;
      if(q.c.includes(st.opts[i])) b.classList.add("right");
      if(st.sel.includes(i)){
        if(q.c.includes(st.opts[i])) b.classList.add("right");
        else b.classList.add("wrong");
      }
    });
  }
  else if(q.t === "ord"){
    $$(".orditem").forEach(el=>{
      const k = st.order.indexOf(el.dataset.txt);
      const right = k >= 0 && el.dataset.txt === q.c[k];
      el.style.pointerEvents = "none";
      el.style.borderColor = right ? "var(--green)" : (k >= 0 ? "var(--red)" : "rgba(255,255,255,.1)");
      el.style.background = right ? "rgba(74,222,128,.16)" : (k >= 0 ? "rgba(255,95,109,.16)" : "");
      if(k >= 0 && !right) shakeCard();
    });
  }
  else if(q.t === "num"){
    const d = $("#numDisp");
    if(d){
      d.style.color = ok ? "var(--green)" : "var(--red)";
      d.style.textShadow = "0 0 24px " + (ok ? "rgba(74,222,128,.5)" : "rgba(255,95,109,.5)");
    }
  }
  else if(q.t === "sld"){
    const sl = $("#sld");
    if(sl){ sl.disabled = true; sl.style.filter = ok ? "hue-rotate(70deg)" : "grayscale(1)"; }
    if(!ok) shakeCard();
  }

  const partial = partialFn();
  let gain = 0;
  if(ok){
    if(st.correct === 0) unlock("first");
    if(st.qIndex >= 20) unlock("allr");
    gain = payout(speed, partial);
    st.cash += gain; st.total += gain;
    st.streak++; st.correct++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    AU.play(q.boss ? "correctBoss" : "correct");
    AU.play("coin"); AU.duck(340);
    flash("good");
    flyMoney(btn || $("#answers"), gain);
    pulse($("#statMult"));
    if(btn) btn.classList.add("right");
    if(q.boss){ confetti(56); lightning(); }
    if(st.streak === 5) unlock("streak5");
    if(st.streak === 10){ unlock("streak10"); AU.play("streak"); }
    if(st.streak === 20){ unlock("streak20"); confetti(60); }
    if(speed > .82) unlock("fast");
    if(q.boss) unlock("boss");

    const tier = st.milestoneTier();
    if(tier > st.lastMilestone){
      st.lastMilestone = tier;
      const bonus = 5000 * tier;
      st.cash += bonus;
      bigWord("MILESTONE +" + fmt(bonus));
      confetti(70); AU.play("levelup"); AU.duck(500);
      setTimeout(()=>flyMoney($("#answers"), bonus), 260);
      unlock("k1");
    }
    if(st.cash >= 100000) unlock("k2");

    const bits = [`<b>+${fmt(gain)}</b>`];
    if(q.t === "multi" && partial < 1) bits.push(`${Math.round(partial * 100)}% of the picks correct`);
    bits.push(`${st.streak}× streak`);
    bits.push(`${(1 + speed * .6).toFixed(2)}× speed`);
    if(q.boss) bits.push("<b>BOSS CLEARED — 3× pay</b>");
    $("#why").innerHTML = `<span class="hd">CORRECT</span>${bits.join(" · ")}<br>${q.why}`;
  }
  else{
    st.streak = 0; st.wrong++;
    const lost = Math.min(st.cash, Math.round(st.cash * .08));
    st.cash -= lost;
    const left = loseShelter();
    AU.play("wrong"); AU.duck(420);
    if(q.boss) AU.play("thunder");
    flash("bad"); shakeCard();
    let detail = "";
    if(q.t === "num") detail = `You entered <b>${num(extra)}</b>. `;
    if(q.t === "sld") detail = `You guessed <b>${extra}${q.unit || ""}</b>. `;
    if(q.t === "multi" && extra2) detail = `You got ${extra} of ${extra2} right. `;
    $("#why").innerHTML = `<span class="hd" style="color:var(--red)">WRONG${lost ? " — −" + fmt(lost) : ""}</span>
      ${detail}${left ? "You lost a " + MODE.livesLabel.toLowerCase().replace(/s$/,"") + "."
                    : "That was your last " + MODE.livesLabel.toLowerCase() + "."}
      The answer${q.t === "ord" ? "<b>order</b>" : ""} was <b>${q.t === "ord" ? q.c.join(" → ") : q.c}</b>.<br>${q.why}`;
  }
  $("#why").style.display = "block";
  $("#submitRow").style.display = "none";
  renderHUD(true); renderShop();
  MODE.afterResolve(ok, gain);
}

function timeout(){
  if(st.answered || !st.running) return;
  st.answered = true;
  const q = st.q;
  st.streak = 0; st.wrong++;
  const left = loseShelter();
  if(q.t === "mc" || q.t === "tf"){
    $$("#answers .ans").forEach((b,i)=>{
      b.disabled = true;
      if(st.opts[i] === q.c){ b.classList.add("right"); b.querySelector(".tick").textContent = "✔"; }
    });
  }
  if(q.t === "num"){ const d = $("#numDisp"); if(d){ d.textContent = "TIME"; d.style.color = "var(--red)"; } }
  if(q.t === "sld"){ const sl = $("#sld"); if(sl) sl.disabled = true; }
  if(q.t === "ord") $$(".orditem").forEach(el=>{
    const k = st.order.indexOf(el.dataset.txt);
    if(k >= 0 && el.dataset.txt === q.c[k]) el.style.borderColor = "var(--green)";
  });
  AU.play("warn"); AU.play("wrong"); AU.duck(450);
  flash("bad"); shakeCard();
  $("#why").innerHTML = `<span class="hd" style="color:var(--red)">OUT OF TIME</span>
    ${left ? "You lost a " + MODE.livesLabel.toLowerCase().replace(/s$/,"") + "."
           : "That was your last " + MODE.livesLabel.toLowerCase() + "."}
    The answer was <b>${q.t === "ord" ? q.c.join(" → ") : q.c}</b>.<br>${q.why}`;
  $("#why").style.display = "block";
  $("#submitRow").style.display = "none";
  renderHUD(true); renderShop();
  MODE.afterTimeout();
}

/* ════════════════════════════════════════════════════════════════════════
   HUD · SHOP · FX
   ════════════════════════════════════════════════════════════════════════ */
let cashShown = 0;
function renderCash(animate){
  const el = $("#statCash b");
  if(!animate){ cashShown = st.cash; el.textContent = fmt(st.cash); return; }
  clearInterval(renderCash._iv);
  renderCash._iv = setInterval(()=>{
    const d = st.cash - cashShown;
    if(Math.abs(d) < 1){ cashShown = st.cash; clearInterval(renderCash._iv); el.textContent = fmt(st.cash); return; }
    cashShown += d * .22; el.textContent = fmt(cashShown);
  }, 16);
}
function pulse(el){ if(!el) return; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }

function renderHUD(animate){
  renderCash(animate);
  $("#statMult b").textContent = "x" + mult().toFixed(1);
  const cap = st.maxLives || 3;
  $("#statLives b").textContent = "★".repeat(Math.max(0, Math.min(st.lives, cap))) + "☆".repeat(Math.max(0, cap - st.lives));
  $("#statQ b").textContent = st.qIndex;
  $("#statBest b").textContent = fmt(S.best);
  const c = st.streak;
  $("#combo").classList.toggle("on", c >= 2);
  $("#comboTxt").textContent = c + " streak · x" + mult().toFixed(1);
  $("#comboBar").style.width = ((c % 5) / 5 * 100) + "%";
  renderTools();
}
function supportsFifty(){ return st.q ? ["mc","tf","multi"].includes(st.q.t) : false; }
function renderTools(){
  const has50 = lvl("fifty") > 0;
  const usable = has50 && st.sinceFifty >= 5 && !st.fiftyUsed && supportsFifty();
  const b = $("#btnFifty");
  b.disabled = !playable() || !usable;
  b.style.opacity = (!has50 || !supportsFifty()) ? .35 : 1;
  $("#fiftyInfo").textContent = !has50 ? "buy in the shop"
    : !supportsFifty() ? "not usable on this type"
    : st.fiftyUsed ? "already used"
    : st.sinceFifty < 5 ? (5 - st.sinceFifty) + " Qs to recharge" : "READY — press F";
  const e = $("#btnEvac");
  e.disabled = !playable() || S.evac <= 0;
  $("#evacInfo").textContent = S.evac > 0 ? S.evac + " charge(s) — press E" : "buy in the shop";
}

function renderShop(){
  const box = $("#shopList");
  if(!box) return;
  box.innerHTML = "";
  UPGRADES.forEach(u=>{
    const L = lvl(u.id), maxed = L >= u.max, c = cost(u);
    const el = document.createElement("div");
    el.className = "up" + (maxed ? " maxed" : "");
    const shown = u.charges ? 5 : u.max;
    let pips = "";
    for(let i=0;i<shown;i++) pips += `<i class="${i < Math.min(L,shown) ? "on" : ""}"></i>`;
    el.innerHTML = `<div class="row">
        <div class="ico">${u.ico}</div>
        <div class="nm"><b>${u.name}</b><span>${u.desc}</span></div>
        <button class="buy ${maxed ? "maxed" : ""}">${maxed ? "MAX" : fmt(c)}</button>
      </div><div class="pips">${pips}</div>`;
    const btn = el.querySelector(".buy");
    if(maxed) btn.disabled = true;
    else { btn.disabled = st.cash < c; btn.onclick = ()=>buy(u); }
    box.appendChild(el);
  });
  renderAch();
}
function buy(u){
  const c = cost(u);
  if(lvl(u.id) >= u.max || st.cash < c) return;
  st.cash -= c;
  S.up[u.id] = lvl(u.id) + 1;
  if(u.id === "life"){ st.lives++; st.maxLives++; bigWord("+1 SHELTER"); }
  if(u.id === "fifty"){ st.sinceFifty = 5; bigWord("50/50 ONLINE"); }
  if(u.id === "evac") S.evac = (S.evac || 0) + 1;
  AU.play("buy"); AU.duck(240);
  unlock("shop");
  save(); renderHUD(true); renderShop();
  if(MODE.onBuy) MODE.onBuy(u);
}
function renderAch(){
  const box = $("#achList");
  if(!box) return;
  box.innerHTML = "";
  ACHIEVEMENTS.forEach(a=>{
    const s = document.createElement("span");
    s.textContent = a.ico + " " + a.name;
    if(S.ach.includes(a.id)) s.className = "got";
    s.title = S.ach.includes(a.id) ? "Unlocked" : "Locked";
    box.appendChild(s);
  });
}
function unlock(id){
  if(S.ach.includes(id)) return;
  const a = ACHIEVEMENTS.find(x=>x.id === id);
  if(!a) return;
  S.ach.push(id); save(); renderAch();
  bigWord("🏆 " + a.name.toUpperCase());
  AU.play("levelup");
}

let tagEl;
function tag(msg, ms){
  ms = ms || 1500;
  if(!tagEl){
    tagEl = document.createElement("div");
    tagEl.className = "msgtag";
    document.body.appendChild(tagEl);
  }
  tagEl.textContent = msg; tagEl.style.opacity = 1;
  clearTimeout(tag._t); tag._t = setTimeout(()=>{ tagEl.style.opacity = 0; }, ms);
}
function bigWord(msg){
  const d = document.createElement("div");
  d.className = "bigword";
  d.textContent = msg;
  d.style.color = "#ffd76e";
  d.style.textShadow = "0 0 34px rgba(255,215,110,.85),0 4px 12px #000";
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 1150);
}
function flyMoney(fromEl, amount){
  const a = $("#statCash").getBoundingClientRect();
  const r = (fromEl && fromEl.getBoundingClientRect) ? fromEl.getBoundingClientRect()
           : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const d = document.createElement("div");
  d.className = "fl";
  d.textContent = "+" + fmt(amount);
  d.style.left = (r.left + r.width / 2 - 24) + "px";
  d.style.top = r.top + "px";
  if(amount >= 300) d.style.fontSize = "27px";
  document.body.appendChild(d);
  setTimeout(()=>{
    d.style.transition = "left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1)";
    d.style.left = (a.left + a.width / 2 - 24) + "px";
    d.style.top = a.top + "px";
  }, 30);
  setTimeout(()=>d.remove(), 950);
  pulse($("#statCash"));
}
function flash(cls){
  const f = document.createElement("div");
  f.className = "flash " + cls;
  document.body.appendChild(f);
  setTimeout(()=>f.remove(), 520);
}
function confetti(n){
  n = n || 44;
  const cols = ["#5ad2ff","#2ee6b6","#ffc94d","#ffd76e","#ff5f6d","#a78bfa","#fff"];
  for(let i=0;i<n;i++){
    const c = document.createElement("div");
    c.className = "conf";
    c.style.left = Math.random() * 100 + "vw";
    c.style.top = "-20px";
    c.style.background = cols[(Math.random() * cols.length) | 0];
    c.style.animationDuration = (1.1 + Math.random() * 1.1) + "s";
    c.style.animationDelay = (Math.random() * .45) + "s";
    c.style.opacity = .9;
    document.body.appendChild(c);
    setTimeout(()=>c.remove(), 2600);
  }
}
function lightning(){
  const b = $("#bolt");
  if(!b) return;
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "bolt .7s ease-out";
  if(Math.random() < .5) setTimeout(lightning, 2600 + Math.random() * 6000);
}
function shakeCard(){
  const g = $("#screenGame");
  if(!g) return;
  g.classList.add("shake"); setTimeout(()=>g.classList.remove("shake"), 420);
}
function useFifty(){
  if(lvl("fifty") < 1 || st.sinceFifty < 5 || st.fiftyUsed || !playable() || !supportsFifty()) return;
  const kids = $$("#answers .ans");
  if(st.q.t === "tf"){
    const w = [...Array(kids.length).keys()].find(i => st.opts[i] !== st.q.c);
    kids[w].disabled = true; kids[w].classList.add("gone");
  } else {
    const wrongs = [...Array(kids.length).keys()].filter(i => st.opts[i] !== st.q.c);
    shuffle(wrongs);
    const n = st.q.t === "multi" ? 1 : 2;
    wrongs.slice(0, n).forEach(i => { kids[i].disabled = true; kids[i].classList.add("gone"); });
  }
  st.fiftyUsed = true; st.sinceFifty = 0;
  AU.play("buy"); tag("SATELLITE LOCK");
  renderTools();
}
function useEvac(){
  if(!S.evac || S.evac <= 0 || !playable()) return;
  S.evac--; save();
  AU.play("whoosh"); tag("EVACUATING…", 1200);
  renderTools(); renderShop();
  MODE.afterEvac();
}

/* ════════════════════════════════════════════════════════════════════════
   RESULTS OVERLAY
   ════════════════════════════════════════════════════════════════════════ */
function showResults(opts){
  $("#overTitle").textContent = opts.title;
  $("#overTitle").className = opts.titleClass || "";
  $("#overMsg").textContent = opts.msg || "";
  $("#overCash").textContent = fmt(opts.cash);
  $("#overStats").innerHTML = opts.stats;
  $("#over").classList.add("show");
}

/* ════════════════════════════════════════════════════════════════════════
   TIMER LOOP — driven from an absolute deadline so multiplayer clients and
   the host agree on when a round closes.
   ════════════════════════════════════════════════════════════════════════ */
let lastTs = 0, warnedTick = -1, warnedFive = false;
function frame(ts){
  if(!lastTs) lastTs = ts;
  const dt = Math.min(.1, (ts - lastTs) / 1000);
  lastTs = ts;
  if(st.running && !st.paused && !st.answered && st.deadline){
    st.timeLeft = Math.max(0, (st.deadline - Date.now()) / 1000);
    const frac = st.timeMax > 0 ? st.timeLeft / st.timeMax : 0;
    const bar = $("#timerBar"), txt = $("#timerTxt");
    bar.style.width = Math.max(0, frac * 100) + "%";
    txt.textContent = st.timeLeft.toFixed(1) + "s";
    const col = frac < .2 ? "#ff5f6d" : frac < .45 ? "#ffc94d" : "";
    bar.style.background = col || "linear-gradient(90deg,#4ade80,#2ee6b6)";
    const half = Math.floor(st.timeLeft * 2);
    if(frac < .25 && half !== warnedTick){ warnedTick = half; AU.play("tick"); }
    if(frac < .25 && st.timeLeft > 0 && Math.floor(st.timeLeft) === 5 && !warnedFive){ warnedFive = true; AU.play("warn"); }
    if(st.timeLeft > 5.2) warnedFive = false;
    if(st.timeLeft <= 0){ st.deadline = 0; timeout(); }
  }
  MODE.tick(dt);
  requestAnimationFrame(frame);
}
function startFrame(){ lastTs = 0; warnedTick = -1; warnedFive = false; requestAnimationFrame(frame); }
