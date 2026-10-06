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
git add index.html style.css engine.js solo.js net.js diag.js boot.js trystero.js README.md
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
| `diag.js` | connection report — why multiplayer failed |
| `build-standalone.js` | packs everything into one `.html` |
| `boot.js` | the only file that knows a button exists |
| `trystero.js` | vendored WebRTC/Nostr library |

### Signalling relays

Trystero cannot introduce two browsers to each other by itself. They meet by exchanging
messages over public Nostr relays, so **no relay means no connection** — regardless of how
healthy the network between the two devices is.

The vendored copy shipped 28 hardcoded relays and takes only the first few *in order*. Two
at the front of that list are dead hostnames, so on some networks it only ever attempted
endpoints that no longer exist and reported "peer link unavailable" while healthy relays
sat further down the list, never contacted. `net.js` therefore passes its own list:

```js
relayConfig: { urls: RELAYS, redundancy: 14 }
```

`RELAYS` is ordered with the large long-running public relays first and spreads different
providers through the top of the list, so a block aimed at one host or CDN cannot take
everything out at once. This is the only signalling strategy this build has — the vendored
library is Nostr-only, with no MQTT or fallback to fall back to.

The connection report distinguishes the two ways this fails, because they look identical
but need opposite fixes: a relay **refused within a second** was blocked locally (extension,
DNS filter), while a relay that **hangs** had its packets dropped by a network or firewall.

### Standalone build

```bash
node build-standalone.js            # → ../moneyman-upload/moneyman-standalone.html
```

Inlines the stylesheet, all six scripts and the vendored Trystero library into a single
~226 KB `.html` that makes **zero** network requests. It refuses to write the output if any
external reference or `.mp3` mention survives the packing, so a broken build fails loudly
instead of shipping a file that quietly misses a script. Solo runs from it straight off
`file://`; multiplayer still needs `https` or localhost, which is a browser rule about
WebRTC rather than something the file can influence.

**There are no binary assets.** Not one. The music, the sound effects and the
wind/rain ambience are all synthesised with the Web Audio API at runtime, and the favicon
is an inline `data:` SVG. Nothing to upload alongside the code, nothing to 404, no
download penalty, and it works just as well from a plain `file://` as from a server.

`engine.js` holds a single `MODE` object. Each mode installs its own hooks
(`afterResolve`, `afterTimeout`, `afterEvac`, `tick`, `togglePause`, `livesLabel`), so
the scoring and rendering code is written once and never needs to know whether a solo
run or a royale is in progress.

### Calm desktop layer

`style.css` ends with a `@media(min-width:941px)` block that quiets the desktop
presentation without touching mobile: it stops the animated gradients, the
spinning radar and the drifting glows, flattens the eight boxes in the top bar
into one row of plain numbers, removes the hover lift-offs, and gives the
question column more width. Phones and tablets keep the original treatment. It
is a self-contained block at the end of the file, so deleting it reverts cleanly.

### Device tiers

The audience is iPad, laptop and desktop PC, so the layout is built around three
real ranges rather than generic breakpoints:

| Width | Device | Treatment |
| --- | --- | --- |
| `<700px` | phone | original mobile-first, single column |
| `700–940px` | **iPad portrait** (744–834px) | touch-first but **not** phone-sized: 17.5px answers, 38px key badges, 46px icon buttons, 17px keypad, question text at 23px, and the upgrade shop paired into a 2-up grid so it is half as tall |
| `941–1599px` | iPad landscape + laptop | calm desktop layer, single row of stats, 312px sidebar |
| `1600px+` | large desktop | frame widens to 1520px, 372px sidebar, 27px question text |

The awkward case is an iPad in portrait: wide enough to look like a small laptop,
but it is touch, so it needs phone-grade single-column flow *and* desktop-scale
type and tap targets. Letting it fall through to the phone base gave it 15.5px
answers and 40px buttons.

There is also an `@media(hover:none)` block. iPads report `:hover` on tap and then
keep it stuck, so a finger tapping an answer leaves it looking permanently
selected; every hover affordance is gated behind a real pointer.

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

## Diagnosing multiplayer on iPads and iPhones

Multiplayer used to fail **silently**. You tapped JOIN, it said `CONNECTING…`, and then
nothing — no error, ever. On a desktop that is merely annoying. On an iPad it made two
completely different problems look identical, which is why this took a while to pin down.

Four things now happen instead:

1. **The room code has a COPY button.** On iPadOS, switching to another app to share the
   code *freezes the page*: JS is suspended, relay sockets drop, and the room is dead when
   you come back. Copying from inside the page means you never have to leave it. A
   `visibilitychange` handler also warns you on return if the page was frozen mid-match.
2. **A watchdog reports silent failures.** If nobody has joined ~25s after you try to join
   (45s when hosting), the connection report opens automatically instead of leaving you
   staring at `CONNECTING…`.
3. **Errors are reported, not swallowed.** A failed join shows the actual message, and a
   real exception opens the report too.
4. **Audio can no longer block joining.** `safeAudio()` wraps the Web Audio init. On some
   mobile browsers the API exists but throws while initialising, which used to abort the
   whole join handler and leave the button doing nothing at all. It now degrades to silent
   play.

### The connection report

**TEST MY CONNECTION** on the title screen, or it opens itself when something fails. Nine
measured checks:

| Check | Why it matters |
| --- | --- |
| Secure context | WebRTC needs HTTPS or localhost; falls back to a protocol check where `isSecureContext` is missing |
| Browser | names iPad/iOS Safari and the iOS version |
| Trystero library | confirms `trystero.js` loaded and `joinRoom` exists |
| `crypto.subtle` | Trystero throws without it, and it only exists in a secure context |
| WebRTC APIs | `RTCPeerConnection` + `RTCDataChannel` present |
| Nostr relays | **measured**, not assumed — a `WebSocket` wrapper installed before `trystero.js` logs every relay Trystero opens and whether it connected |
| WebRTC self-test | builds two connections *inside the page* and pushes real bytes between them, isolating WebRTC from the network and the other device |
| Page state | whether the tab is backgrounded right now |
| Backgrounded earlier | whether the tab lost focus at any point this session |

The relay report is the useful one for iPads: if it says all relays failed, the network is
blocking `wss://`, and no amount of code changes will help. If relays are fine and the
self-test passes but peers still cannot connect, it is device-specific WebRTC behaviour.

---

## Tests

416 checks run headless under jsdom:

- **boot (18)** — the page loads with no runtime errors, every DOM id the code reaches
  for exists, solo mode installs by default.
- **solo (33)** — all 64 questions well-formed, boss cadence, deck cycling, all six
  question types played through the real UI, cash stays finite, wrong answers cost a
  shelter, bankruptcy ends the run, upgrades persist.
- **royale (42)** — eight independent browser instances joined over a fake WebRTC bus:
  lobby, countdown, distinct questions per player, correct/wrong/timeout all scoring
  correctly, shield loss, elimination, spectating, a winner, and host migration.
- **stuck (23)** — every path that can land you on the lobby must have a working way
  out: hosting alone, leaving, double-leaving, starting with no peers, and re-entering
  a room afterwards. Guards a real bug where the net tick survived leaving and dragged
  the player back to the lobby on every frame.
- **cash (10)** — the payout path with WebAudio missing and with a broken
  AudioContext, asserting the money is banked *and* rendered.
- **keyboard (15)** — the desktop-only input path: answering with number keys,
  typing digits then Enter, and not hijacking keys while typing in a text field.
- **calm (27)** — parses `style.css` through the CSSOM and asserts the desktop
  layer applies, that mobile is untouched, and that the base rules survive.
- **tiers (39)** — resolves the CSS cascade by hand at eight real device widths
  (iPad mini/Air/Pro portrait and landscape, 1280, 1440, 1920, 390) and asserts
  each tier wins, that the boundaries at 700/940/941/1600 are exact, and that
  phones are unaffected.
- **relays** — the pool is passed to `joinRoom` as `relayConfig`, so the diag suite
  asserts it is wired up at all: no stale `relayUrls` option, no duplicates, every entry
  a `wss://` URL, `relay.damus.io` first, and a redundancy high enough to get past a bad
  prefix. It also drives `Diag.run` with synthetic relay logs to pin the two diagnoses that
  matter — a fast refusal means blocked on the device, a hang means dropped packets — and
  checks the verdict line never claims all-clear while WebRTC is actually missing.
- **diag (77)** — the failure-reporting path. Asserts the relay recorder installs
  before Trystero, the watchdog cancels when you leave, no bare unguarded
  `AU.init()` call site survives, the clipboard path is awaited with a working
  fallback, and that `Diag.run` produces a full report in a browser with no
  WebRTC at all instead of throwing.

```bash
cd /tmp/opencode/t && npm install jsdom
node boot.js && node solo.js && node stuck.js && node cash.js && node keyboard.js \
  && node calm.js && node tiers.js && node royale.js && node diag.js \
  && node assets.js && node music.js && node standalone.js
```

The multiplayer suite exercises the real host-authority code path; only the WebRTC
transport itself is stubbed. Actual peer-to-peer connectivity still needs a manual test
between two real browsers or devices — which is exactly what the in-game **connection
report** is for. It measures relays and WebRTC on the real device and says which of the
two failed.

---

`katrina-moneyman.html` is the original single-file build, kept for reference. The
multi-file version above is the one to deploy.