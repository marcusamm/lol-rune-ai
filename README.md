# lol-rune-ai

Prototype for a local tool that watches League of Legends champ select,
figures out your lane matchup, and auto-applies the best rune page for it.

## How it's meant to work

1. **Read the client.** The League client exposes a local API (LCU) while
   it's running. `src/lcu.js` finds the port + auth token from the running
   `LeagueClientUx.exe` process and talks to it over HTTPS.
2. **Detect the matchup.** Watch `/lol-champ-select/v1/session` for your
   champion and your lane opponent's champion.
3. **Look up the best page.** Query a matchup database (built from real
   match data via Riot's official Match-V5 API) for the rune page with the
   best win rate for that specific matchup.
4. **Apply it.** `PUT /lol-perks/v1/pages` to create/select that page
   before the game starts.

This only reads/writes client data during champ select - no memory
reading, no in-game input automation - which is the same boundary
approved third-party tools (Blitz, Mobalytics, etc.) stay inside.

## Open question we need to answer first

Riot added a champ-select "fog of war" a few years back specifically to
stop tools from reading your lane opponent's pick before it's revealed.
**If `theirTeam[].championId` is still zeroed out during pick phase, the
whole "auto rune during champ select" flow doesn't work** - we'd only find
out the enemy champion once the loading screen starts, which may be too
late to change runes.

## Step 1: run the diagnostic

```bash
node src/diagnose.js
```

Then queue into a Draft Pick or Ranked game and let it run through pick/ban.
It polls the champ-select session every 2 seconds, prints a one-line
summary, and saves full JSON snapshots to `diagnostics/`.

Look at the `enemyVisible=X/5` numbers in the console output:

- **If `enemyVisible` stays `0/5` all the way through pick phase** →
  fog of war is active. We'll need to redesign around applying runes in
  the brief loading-screen window instead (using the Live Client Data API
  once the game process launches), which is a meaningfully different and
  more time-constrained problem.
- **If `enemyVisible` climbs as enemies lock in during pick phase** →
  we're clear to build the full matchup-detection flow as planned.

Send me the console output (or a snapshot JSON from `diagnostics/`) once
you've run it through a game, and we'll build the next piece based on
what it actually shows.

## Step 2 (once Step 1 confirms the approach): matchup data pipeline

Needs a Riot Developer API key (free, from
https://developer.riotgames.com/ - personal keys expire every 24h unless
you register an app, worth knowing before we build a long-running
collector around it). We'll pull match history for a sample of
high-elo players via `league-v4` + `match-v5`, aggregate rune-page win
rates per champion-vs-champion-vs-lane, and store it locally (SQLite) so
the live app can look matchups up instantly instead of hitting the API
during champ select.
