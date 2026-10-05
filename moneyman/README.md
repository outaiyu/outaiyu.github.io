# MONEYMAN — Hurricane Katrina Quiz Tycoon

A trivia game about Hurricane Katrina (August 2005). Answer fast, stack fake FEMA
cash, buy upgrades, survive the boss rounds — or take on up to 7 other players in a
peer-to-peer battle royale.

**Every dollar in the game is fictional. Every fact in it is real.**

---

## Play it

### Locally

Multiplayer needs a secure context, so open the game through a web server rather
than double-clicking the file:

```bash
cd /home/taiyu
python3 -m http.server 8000
# then visit http://localhost:8000
```

Solo works from `file://` too, but the music will not load there.

### On GitHub Pages (free)

```bash
git init
git add index.html style.css engine.js solo.js net.js boot.js trystero.js electro_dymanics.mp3 README.md
git commit -m "MONEYMAN: solo + 8-player battle royale"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save.**
The game is live at `https://<you>.github.io/<repo>/`.

---

## Modes

### Solo
An endless run. You start with 3 shelters; each question has its own countdown that
gets tighter the further you get. Answer correctly to build a streak multiplier and
bank cash; answer wrong or run out of time and you lose a shelter **and** 8% of your
cash. At zero shelters you are bankrupt. Upgrades and records persist in
`localStorage`.

### Battle Royale (2–8 players)
The host opens a room and shares the 5-character code. Everyone starts each round with
**2 shields**, and every living player is dealt a **different question on their own
clock** — deliberately different, so nobody can read an answer off a neighbour.

- Correct → keep your shields, bank the cash.
- Wrong or out of time → lose a shield and 25% of your cash.
- Zero shields → eliminated, and you spectate the rest.
- Last player standing wins.

Cash, streaks, upgrades and achievements stay **local to each player** — the host never
handles your economy, it only tracks shields and who is still alive.

---

## How the multiplayer works

There is **no backend and no account**. [Trystero](https://github.com/dmotz/trystero)
lets browsers find each other through public Nostr relays, then switches to a direct
encrypted WebRTC channel between peers. The library is vendored in
`trystero.js`, so nothing is fetched from a CDN at runtime.

### Authority is split

| Owned by the **host** | Owned by each **client** |
| --- | --- |
| roster, phase, round number | cash, streak, multiplier |
| shields, elimination, winner | upgrades, milestones, achievements |
| question assignment, deadlines | their own answer result |

The host broadcasts a **complete state snapshot** on every change and a heartbeat
every 2s; clients reply with just their answer.

### Protocol

| Action | Direction | Payload |
| --- | --- | --- |
| `hi` | client → host | `{ name }` |
| `dur` | client → host | `{ round, deadline }` — my effective clock |
| `rep` | client → host | `{ round, correct, cash }` |
| `mine` | host → client | `{ round, q, baseSec }` — my question |
| `snap` | host → all | full state snapshot |
| `kick` | host → all | `{ reason }` — room full |

A round closes as soon as **every living player has reported**, or when the slowest
reported deadline passes plus a 2.5s grace period. That is why clients report their
own deadline: the host cannot know that somebody bought the time upgrade, and it will
not cut them off early.

### Host migration

If the host leaves cleanly or goes silent for 9s, the longest-present surviving peer
takes over from the last snapshot it already holds. The election is deterministic
(lowest `joined` timestamp, then peer id) and snapshots carry an `epoch`, so a
migrating host and a stale one cannot both take over.

---

## Files

| File | Purpose |
| --- | --- |
| `index.html` | markup for the title screen, quiz, lobby, spectator view and results |
| `style.css` | all styling |
| `engine.js` | question bank, scoring, renderers, audio, upgrades, HUD, timer loop |
| `solo.js` | single-player mode — installs the solo `MODE` hooks |
| `net.js` | battle royale — transport, host authority, migration, roster UI |
| `boot.js` | the only file that knows a button exists |
| `trystero.js` | vendored WebRTC/Nostr library |
| `electro_dymanics.mp3` | background music |

`engine.js` holds a single `MODE` object. Each mode installs its own hooks
(`afterResolve`, `afterTimeout`, `afterEvac`, `tick`, `togglePause`, `livesLabel`), so
the scoring and rendering code is written once and never needs to know whether a solo
run or a royale is in progress.

Classic `<script>` tags are used deliberately — no bundler, no build step, no ES
modules, so it runs from any static host.

---

## Question bank

64 questions across six types, interleaved so you never get the same type twice in a
row, with a boss question every 5th slot (3 boss variants):

`mc` multiple choice · `tf` true/false · `multi` select-all-that-apply ·
`num` type a number · `ord` put in order · `sld` slider guess

Drawn from a Hurricane Katrina class presentation plus NOAA / National Hurricane Center
storm records.

## Upgrades and achievements

8 upgrades: Reinforced Levees, Recovery Grants, Sprint Power, Calm Before The Eye,
FEMA Shelter, Golden Lifeline, Emergency Satellite, Evacuate Early.
10 achievements. Everything is stored locally under `moneyman_katrina_v2`.

## Keys

`1`–`6` answer · `F` 50/50 · `E` evacuate · `P` pause · `Enter` submit ·
`Backspace`/`Delete` edit a typed number

---

## Tests

114 checks run headless under jsdom:

- **boot (18)** — the page loads with no runtime errors, every DOM id the code reaches
  for exists, solo mode installs by default.
- **solo (31)** — all 64 questions well-formed, boss cadence, deck cycling, all six
  question types played through the real UI, cash stays finite, wrong answers cost a
  shelter, bankruptcy ends the run, upgrades persist.
- **royale (42)** — eight independent browser instances joined over a fake WebRTC bus:
  lobby, countdown, distinct questions per player, correct/wrong/timeout all scoring
  correctly, shield loss, elimination, spectating, a winner, and host migration.
- **stuck (23)** — every path that can land you on the lobby must have a working way
  out: hosting alone, leaving, double-leaving, starting with no peers, and re-entering
  a room afterwards. Guards a real bug where the net tick survived leaving and dragged
  the player back to the lobby on every frame.

```bash
cd /tmp/opencode/t && npm install jsdom
node boot.js && node solo.js && node stuck.js && node royale.js
```

The multiplayer suite exercises the real host-authority code path; only the WebRTC
transport itself is stubbed. Actual peer-to-peer connectivity still needs a manual test
between two real browsers or devices.

---

`katrina-moneyman.html` is the original single-file build, kept for reference. The
multi-file version above is the one to deploy.