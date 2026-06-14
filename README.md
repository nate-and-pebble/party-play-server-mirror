# 🎉 Party Play

A web-native party-game platform. **The browser is the shared screen; phones are the controllers.** Think "Jackbox, web-native" — players join by QR code or a 4-letter room code, no app install and no accounts. One platform shell (join · lobby · identity · scoring · reconnection) hosts a growing library of games.

This is a full, working proof-of-concept with **three distinct games** that exercise the whole platform.

---

## The big idea

```
   ┌───────────────────────────┐                ┌──────────────┐
   │      SHARED SCREEN        │   QR + code    │    PHONE     │
   │   (laptop / TV / browser) │ ◀────────────▶ │ (controller) │
   │  public game state, lobby │   websockets   │  private UI  │
   └───────────────────────────┘                └──────────────┘
                  ▲                                     ▲
                  │   authoritative state, per-surface  │
                  └────────── projections ──────────────┘
                             (Node + Socket.IO)
```

The **server is authoritative** and owns all game state. It computes two projections of that state:

- `screenView()` — the **public** view rendered on the shared screen.
- `playerView(playerId)` — a **private**, per-player view rendered on that one phone.

Secrets (your prompt, your hand, your vote, the artist's secret word) only ever travel inside the owning player's `playerView`. Privacy isn't a discipline you have to remember — it's enforced by what the server sends.

---

## Quick start

Requirements: **Node ≥ 20** (built on Node 22).

```bash
npm install

# Option A — one-port build, best for real phones on your Wi-Fi
npm run build      # bundles the client into client/dist
npm start          # serves everything on http://<your-LAN-ip>:3001

# Option B — hot-reloading dev (two processes; great on a laptop)
npm run dev        # server :3001 + Vite client :5173 (proxied)
```

Open the printed **Shared screen** URL on your TV/laptop, then scan the QR with any phone camera — or type the room code at the join URL. That's it.

> **Why the LAN IP matters:** the QR must point phones at the host machine over the local network, never `localhost`. The server auto-detects your LAN IPv4 and builds the join URL from it. Override with `PUBLIC_HOST` / `PUBLIC_PORT` if you're behind a tunnel.

### Useful env vars

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Server port |
| `PUBLIC_HOST` | auto-detected LAN IP | Hostname baked into the QR/join URL |
| `PUBLIC_PORT` | `5173` (dev) / `PORT` (prod) | Port baked into the join URL |
| `PP_TIME_SCALE` | `1` | Multiplies every game timer. `0.1` = 10× faster (tests/snappy demos) |

---

## The games

| Game | Style | What it shows off |
| --- | --- | --- |
| ✍️ **Quibble** | simultaneous, social | Private prompts → witty answers → head-to-head voting. Proves text entry, hidden answers/authors during voting, vote-based scoring. |
| ⚡ **Trivia Rush** | simultaneous, timed | Multiple choice with speed + streak scoring and colorblind-safe answer shapes. Proves timing fairness and a live leaderboard. |
| 🎨 **Doodle Dash** | turn-based, spotlight | One player draws a secret word on their phone; ink streams live to the big screen; everyone else races to guess (fuzzy-matched). Proves canvas controllers, turn-based spotlight, and low-overhead real-time streaming. |

---

## Architecture

```
shared/      Wire protocol + shared types — the single source of truth
             both sides import (no drift between client & server).

server/      Node + Express + Socket.IO. Authoritative.
  src/
    index.ts         HTTP + realtime wiring, static client, rate limiting
    sessionManager.ts  Creates/finds/reaps sessions (isolation + idle cleanup)
    session.ts         A room: players, identity, scoring, phase, broadcasting
    games/
      engine.ts        GameContext + GameRuntime contract + BaseGame (clock)
      registry.ts      The library — registering a game is one line here
      quibble.ts | trivia.ts | doodle.ts
      content.ts       Prompts / questions / word banks
    util/              room codes, identity palette, name filter, LAN IP

client/      React + Vite + TypeScript. Framer Motion + canvas-confetti.
  src/
    Home.tsx           Host-or-join landing
    screen/            The shared-screen experience (lobby, results, per-game)
    controller/        The phone experience (join, lobby, results, per-game)
    components/        Shape (colorblind-safe identity), avatars, timers…
    lib/               socket, persistence, synthesized sound, ink helpers
```

### Adding a new game (the whole point of the shell)

1. Create `server/src/games/yourgame.ts` implementing `GameRuntime` (or extending `BaseGame` for a free pause-aware countdown). Provide a `GameSummary` and `screenView()` / `playerView()`.
2. Register it in `server/src/games/registry.ts` (one line).
3. Add a `screen/games/YourGameScreen.tsx` and `controller/games/YourGameController.tsx` and switch on the game id in the two routers.

You never touch joining, the lobby, identity, reconnection, scoring, or results — that's the platform's job.

---

## Testing

```bash
npx tsx tests/e2e.ts          # spawns the server, runs host + bot players through
                              # all three games, asserts the requirements hold
```

The end-to-end harness covers: session create, join, identity (distinct color **and** shape), name disambiguation, profanity filter, all three games to completion, scoring, session-tally carryover, **privacy** (authors hidden during voting; non-host can't issue host commands), **reconnection** (drop → marked disconnected → rejoin with same identity), room locking, and clean session end.

For interactive/manual testing without a pile of phones:

```bash
npx tsx tests/bots.ts <ROOMCODE> [count]   # bots join a room and auto-play
```

---

## Requirements coverage (highlights)

- **Join in seconds, zero install/accounts** — QR + 4-letter code; native camera scans, no in-app camera permission needed.
- **One persistent session across many games** — the lobby survives rounds and game switches; the same group stays together; running session tally.
- **Resilience** — token-based reconnection keeps your name + score through drops; games skip/continue around missing players; the host screen resumes after a refresh.
- **Fairness & privacy** — authoritative server, per-surface projections, server-side input validation, server timestamps for speed scoring.
- **Accessibility** — large high-contrast shared-screen type; player identity is **color + a distinct shape** (never color alone).
- **Cost/scale shape** — in-memory sessions, near-zero at idle; isolated rooms; idle reaping. (Production would swap the in-memory store for Redis to scale horizontally.)

## Known limitations (POC scope)

- Session state is in-memory (single instance). Horizontal scale needs a shared store (Redis) + sticky sessions / the Socket.IO adapter.
- The drawing game re-sends the full stroke set on ~1 Hz snapshots in addition to incremental streaming — fine on a LAN, but a production version would diff more aggressively.
- Content banks are small, illustrative sets.
