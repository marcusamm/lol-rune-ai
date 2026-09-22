const express = require('express');
const { platformGet, regionalGet } = require('../riotApi');

const router = express.Router();

const SAMPLE = 20;

// Derived playstyle tags, computed from the player's own recent matches.
// Each tag states the evidence behind it so it isn't just a vibe.
function deriveTags(matches) {
  const tags = [];
  if (matches.length < 5) return tags;

  const wins = matches.filter((m) => m.win).length;
  const winRate = wins / matches.length;

  // Streaks: longest run of the same result, oldest-to-newest.
  const chrono = [...matches].reverse();
  let longestWin = 0;
  let longestLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const m of chrono) {
    if (m.win) {
      curWin += 1;
      curLoss = 0;
    } else {
      curLoss += 1;
      curWin = 0;
    }
    longestWin = Math.max(longestWin, curWin);
    longestLoss = Math.max(longestLoss, curLoss);
  }
  if (longestWin >= 3) tags.push({ label: 'Chain wins', detail: `${longestWin}-game win streak`, tone: 'good' });
  if (longestLoss >= 3) tags.push({ label: 'Tilt risk', detail: `${longestLoss}-game loss streak`, tone: 'bad' });

  // Side preference - blue side is team 100.
  const blue = matches.filter((m) => m.teamId === 100);
  const red = matches.filter((m) => m.teamId === 200);
  if (blue.length >= 3 && red.length >= 3) {
    const blueWr = blue.filter((m) => m.win).length / blue.length;
    const redWr = red.filter((m) => m.win).length / red.length;
    if (redWr - blueWr > 0.25) {
      tags.push({ label: 'Red side lover', detail: `${Math.round(redWr * 100)}% red vs ${Math.round(blueWr * 100)}% blue`, tone: 'neutral' });
    } else if (blueWr - redWr > 0.25) {
      tags.push({ label: 'Blue side lover', detail: `${Math.round(blueWr * 100)}% blue vs ${Math.round(redWr * 100)}% red`, tone: 'neutral' });
    }
  }

  // Snowballing: wins that end well under average game length.
  const avgDuration = matches.reduce((s, m) => s + m.duration, 0) / matches.length;
  const stomps = matches.filter((m) => m.win && m.duration < avgDuration * 0.82).length;
  if (stomps >= 3) {
    tags.push({ label: 'Snowballs', detail: `${stomps} quick wins`, tone: 'good' });
  }

  // Aggression / passivity from KDA shape.
  const avgKills = matches.reduce((s, m) => s + m.kills, 0) / matches.length;
  const avgDeaths = matches.reduce((s, m) => s + m.deaths, 0) / matches.length;
  if (avgDeaths >= 8) tags.push({ label: 'Dies a lot', detail: `${avgDeaths.toFixed(1)} deaths/game`, tone: 'bad' });
  if (avgKills >= 8) tags.push({ label: 'Aggressive', detail: `${avgKills.toFixed(1)} kills/game`, tone: 'good' });

  const avgKp = matches.filter((m) => m.kp != null);
  if (avgKp.length >= 5) {
    const kp = avgKp.reduce((s, m) => s + m.kp, 0) / avgKp.length;
    if (kp >= 60) tags.push({ label: 'Always in the fight', detail: `${Math.round(kp)}% kill participation`, tone: 'good' });
    if (kp <= 40) tags.push({ label: 'Solo player', detail: `${Math.round(kp)}% kill participation`, tone: 'neutral' });
  }

  // One-trick detection.
  const champCounts = {};
  for (const m of matches) champCounts[m.championName] = (champCounts[m.championName] || 0) + 1;
  const [topChamp, topCount] = Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCount / matches.length >= 0.6) {
    tags.push({ label: 'One-trick', detail: `${topChamp} in ${topCount}/${matches.length} games`, tone: 'neutral' });
  }

  if (winRate >= 0.65) tags.push({ label: 'On a heater', detail: `${Math.round(winRate * 100)}% recent win rate`, tone: 'good' });
  if (winRate <= 0.35) tags.push({ label: 'Rough patch', detail: `${Math.round(winRate * 100)}% recent win rate`, tone: 'bad' });

  return tags;
}

// GET /api/analytics/:platform/:gameName/:tagLine
router.get('/:platform/:gameName/:tagLine', async (req, res) => {
  const { platform, gameName, tagLine } = req.params;

  try {
    const account = await regionalGet(
      platform,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    if (account.status !== 200) {
      return res.status(account.status).json({ error: 'Player not found' });
    }
    const puuid = account.body.puuid;

    const ids = await regionalGet(
      platform,
      `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${SAMPLE}`
    );
    if (!Array.isArray(ids.body)) return res.json({ tags: [], teammates: [], sampleSize: 0 });

    const matchResults = await Promise.all(
      ids.body.map((id) => regionalGet(platform, `/lol/match/v5/matches/${id}`).catch(() => null))
    );

    const matches = [];
    const teammateCounts = {};

    for (const m of matchResults) {
      if (!m || m.status !== 200 || !m.body?.info) continue;
      const info = m.body.info;
      const p = info.participants.find((pp) => pp.puuid === puuid);
      if (!p) continue;

      const team = info.participants.filter((pp) => pp.teamId === p.teamId);
      const teamKills = team.reduce((s, pp) => s + pp.kills, 0);

      matches.push({
        championName: p.championName,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        teamId: p.teamId,
        duration: info.gameDuration,
        kp: teamKills > 0 ? ((p.kills + p.assists) / teamKills) * 100 : null,
      });

      // Recurring teammates = likely duo partners.
      for (const mate of team) {
        if (mate.puuid === puuid) continue;
        const name = mate.riotIdGameName
          ? `${mate.riotIdGameName}#${mate.riotIdTagline}`
          : mate.summonerName;
        if (!name) continue;
        if (!teammateCounts[name]) teammateCounts[name] = { games: 0, wins: 0 };
        teammateCounts[name].games += 1;
        if (p.win) teammateCounts[name].wins += 1;
      }
    }

    const teammates = Object.entries(teammateCounts)
      .filter(([, s]) => s.games >= 2)
      .map(([name, s]) => ({
        name,
        games: s.games,
        winRate: Math.round((s.wins / s.games) * 100),
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 5);

    res.json({ tags: deriveTags(matches), teammates, sampleSize: matches.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
