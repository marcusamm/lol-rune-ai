const express = require('express');
const { platformGet, regionalGet } = require('../riotApi');

const router = express.Router();

const QUEUE_NAMES = { 420: 'Ranked Solo/Duo', 440: 'Ranked Flex' };

async function resolveRiotId(platform, puuid) {
  const { status, body } = await regionalGet(platform, `/riot/account/v1/accounts/by-puuid/${puuid}`);
  if (status !== 200) return null;
  return `${body.gameName}#${body.tagLine}`;
}

async function rankFor(platform, puuid) {
  const { status, body } = await platformGet(platform, `/lol/league/v4/entries/by-puuid/${puuid}`);
  if (status !== 200 || !Array.isArray(body)) return null;
  const solo = body.find((r) => r.queueType === 'RANKED_SOLO_5x5');
  if (!solo) return null;
  return {
    tier: solo.tier,
    rank: solo.rank,
    leaguePoints: solo.leaguePoints,
    winRate: Math.round((solo.wins / (solo.wins + solo.losses)) * 100),
    games: solo.wins + solo.losses,
  };
}

// GET /api/live-game/:platform/:gameName/:tagLine
// Porofessor-style scouting: if the searched player is currently in a
// game, return all 10 participants with champion + rank, so you can
// see the enemy team before/while you're playing against them.
router.get('/:platform/:gameName/:tagLine', async (req, res) => {
  const { platform, gameName, tagLine } = req.params;

  try {
    const account = await regionalGet(
      platform,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    if (account.status !== 200) {
      return res.status(account.status).json({ error: 'Player not found', detail: account.body });
    }
    const puuid = account.body.puuid;

    const active = await platformGet(platform, `/lol/spectator/v5/active-games/by-summoner/${puuid}`);
    if (active.status === 404) {
      return res.json({ inGame: false });
    }
    if (active.status !== 200) {
      return res.status(active.status).json({ error: 'Spectator lookup failed', detail: active.body });
    }

    const game = active.body;
    const participants = await Promise.all(
      game.participants.map(async (p) => {
        const [riotId, rank] = await Promise.all([
          p.riotIdGameName ? Promise.resolve(`${p.riotIdGameName}#${p.riotIdTagline}`) : resolveRiotId(platform, p.puuid),
          rankFor(platform, p.puuid),
        ]);
        return {
          riotId,
          teamId: p.teamId,
          championId: p.championId,
          spell1Id: p.spell1Id,
          spell2Id: p.spell2Id,
          rank,
        };
      })
    );

    res.json({
      inGame: true,
      gameId: game.gameId,
      queue: QUEUE_NAMES[game.gameQueueConfigId] || game.gameQueueConfigId,
      gameLengthSeconds: game.gameLength,
      participants,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
