// Decides what to buy next during a live game.
//
// Takes the dataset's per-champion item win rates as the baseline, then
// adjusts for the actual game: items you already own are dropped, and
// defensive items are pushed up or down depending on whether the enemy
// team's damage is mostly AP or AD. Affordability is checked against
// current gold so the panel can separate "buy now" from "saving for".

const AP_CHAMP_HINT = new Set([
  'Ahri', 'Annie', 'Brand', 'Cassiopeia', 'Diana', 'Karthus', 'Lux', 'Lissandra',
  'Malzahar', 'Orianna', 'Ryze', 'Swain', 'Syndra', 'Veigar', 'Viktor', 'Vladimir',
  'Xerath', 'Ziggs', 'Zoe', 'Morgana', 'Seraphine', 'Hwei', 'Neeko', 'Elise',
  'Evelynn', 'Fiddlesticks', 'Gwen', 'Kennen', 'Rumble', 'Singed', 'Teemo', 'Heimerdinger',
  'AurelionSol', 'Anivia', 'Taliyah', 'Vex', 'Yuumi', 'Nidalee', 'Karma', 'Zyra',
  'Lillia', 'Sylas', 'Ekko', 'Katarina', 'Akali', 'Nautilus', 'Amumu', 'Galio',
]);

// Items whose value is mostly defensive, split by what they defend against.
const ARMOR_ITEMS = new Set([3047, 3075, 3110, 3143, 3193, 3742, 3068, 3076, 8001]);
const MR_ITEMS = new Set([3111, 3065, 3102, 3156, 3194, 3001, 4401, 3211, 3139]);

function enemyDamageProfile(allPlayers, myTeam) {
  const enemies = allPlayers.filter((p) => p.team !== myTeam);
  if (enemies.length === 0) return { apShare: 0.5, adShare: 0.5, enemies: [] };

  const apCount = enemies.filter((e) => AP_CHAMP_HINT.has(e.championName)).length;
  const apShare = apCount / enemies.length;
  return {
    apShare,
    adShare: 1 - apShare,
    enemies: enemies.map((e) => e.championName),
  };
}

function recommendNextItems({ dataset, championName, position, ownedItemIds, currentGold, allPlayers, myTeam, itemMeta }) {
  const bucket = (dataset.items || {})[`${championName}|${position}`] || {};
  const owned = new Set(ownedItemIds);
  const profile = enemyDamageProfile(allPlayers || [], myTeam);

  const scored = Object.entries(bucket)
    .map(([id, s]) => ({ itemId: Number(id), games: s.games, wins: s.wins }))
    .filter((i) => i.games >= 2 && !owned.has(i.itemId))
    .map((i) => {
      const meta = itemMeta?.[i.itemId];
      const winRate = i.wins / i.games;

      // Wilson lower bound keeps a 2-0 item from outranking a 40-25 one.
      const z = 1.96;
      const denom = 1 + (z * z) / i.games;
      const centre = winRate + (z * z) / (2 * i.games);
      const margin = z * Math.sqrt((winRate * (1 - winRate)) / i.games + (z * z) / (4 * i.games * i.games));
      let confidence = (centre - margin) / denom;

      // Nudge defensive picks toward whatever the enemy team actually deals.
      let reason = null;
      if (ARMOR_ITEMS.has(i.itemId) && profile.adShare >= 0.6) {
        confidence *= 1.25;
        reason = `enemy team is ${Math.round(profile.adShare * 100)}% AD`;
      } else if (MR_ITEMS.has(i.itemId) && profile.apShare >= 0.6) {
        confidence *= 1.25;
        reason = `enemy team is ${Math.round(profile.apShare * 100)}% AP`;
      } else if (ARMOR_ITEMS.has(i.itemId) && profile.adShare < 0.4) {
        confidence *= 0.75;
      } else if (MR_ITEMS.has(i.itemId) && profile.apShare < 0.4) {
        confidence *= 0.75;
      }

      return {
        itemId: i.itemId,
        name: meta?.name || `Item ${i.itemId}`,
        cost: meta?.cost ?? null,
        games: i.games,
        winRate: Math.round(winRate * 1000) / 10,
        affordable: meta?.cost != null ? currentGold >= meta.cost : null,
        reason,
        confidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return {
    enemyProfile: profile,
    buyNow: scored.filter((i) => i.affordable).slice(0, 3),
    nextGoals: scored.filter((i) => !i.affordable).slice(0, 3),
  };
}

module.exports = { recommendNextItems, enemyDamageProfile };
