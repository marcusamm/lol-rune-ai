const BACKEND_URL = window.runeAI.backendUrl;

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Champion id -> display name (for live scout / search) ----------
let championIdToDisplayName = {};
(async () => {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    const champJson = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`
    ).then((r) => r.json());
    for (const champ of Object.values(champJson.data)) {
      championIdToDisplayName[Number(champ.key)] = champ.name;
    }
  } catch (err) {
    console.error('Failed to load champion data', err);
  }
})();

function champName(id) {
  return championIdToDisplayName[id] || `Champion ${id}`;
}

// ---------- Auto Runes tab (existing behaviour) ----------
const clientDot = document.getElementById('clientDot');
const clientText = document.getElementById('clientText');
const datasetText = document.getElementById('datasetText');
const refreshBtn = document.getElementById('refreshBtn');
const autoApplyToggle = document.getElementById('autoApplyToggle');

const champSelectCard = document.getElementById('champSelectCard');
const youText = document.getElementById('youText');
const enemiesText = document.getElementById('enemiesText');
const phaseText = document.getElementById('phaseText');

const recommendationCard = document.getElementById('recommendationCard');
const recText = document.getElementById('recText');
const appliedText = document.getElementById('appliedText');

const logList = document.getElementById('logList');

function log(msg) {
  const div = document.createElement('div');
  const time = new Date().toLocaleTimeString();
  div.textContent = `[${time}] ${msg}`;
  logList.prepend(div);
  while (logList.children.length > 100) logList.removeChild(logList.lastChild);
}

window.runeAI.onStatus((msg) => log(msg));
window.runeAI.onDatasetLoaded(({ source, matches }) => {
  datasetText.textContent = `${matches} matches (${source})`;
  log(`Dataset loaded: ${matches} matches, source=${source}`);
});
window.runeAI.onClientStatus((connected) => {
  clientDot.classList.toggle('on', connected);
  clientText.textContent = connected ? 'Connected' : 'Not detected';
});
window.runeAI.onChampSelectStatus((s) => {
  if (!s) {
    champSelectCard.hidden = true;
    return;
  }
  champSelectCard.hidden = false;
  youText.textContent = `${s.myChamp} (${s.position || 'role not assigned yet'})`;
  enemiesText.textContent = s.enemyChamps.length ? s.enemyChamps.join(', ') : 'none yet';
  phaseText.textContent = s.phase || '-';
});
window.runeAI.onRecommendation(({ myChamp, enemyChamp, position, rec }) => {
  recommendationCard.hidden = false;
  appliedText.hidden = true;
  if (!rec) {
    recText.textContent = `No matchup data yet for ${myChamp} vs ${enemyChamp} (${position}).`;
    return;
  }
  recText.textContent =
    `${myChamp} vs ${enemyChamp} (${position}): ${rec.source}, ` +
    `${(rec.winRate * 100).toFixed(1)}% win rate over ${rec.games} games.`;
  log(`Recommendation: ${recText.textContent}`);
});
window.runeAI.onApplied(() => {
  appliedText.hidden = false;
  log('Runes applied.');
});
window.runeAI.onWatcherError((msg) => log(`Error: ${msg}`));
window.runeAI.onFatalError((msg) => log(`Fatal: ${msg}`));
refreshBtn.addEventListener('click', () => {
  log('Refreshing dataset...');
  window.runeAI.refreshDataset();
});
autoApplyToggle.addEventListener('change', () => {
  window.runeAI.setAutoApply(autoApplyToggle.checked);
  log(`Auto-apply ${autoApplyToggle.checked ? 'enabled' : 'disabled'}.`);
});

// ---------- Shared helpers ----------
function parseRiotId(input) {
  const [gameName, tagLine] = input.split('#').map((s) => s.trim());
  return gameName && tagLine ? { gameName, tagLine } : null;
}

async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// ---------- Search tab ----------
const searchInput = document.getElementById('searchInput');
const searchPlatform = document.getElementById('searchPlatform');
const searchBtn = document.getElementById('searchBtn');
const searchResult = document.getElementById('searchResult');

async function runSearch() {
  const parsed = parseRiotId(searchInput.value);
  if (!parsed) {
    searchResult.innerHTML = `<div class="empty-state">Enter a Riot ID like Name#TAG</div>`;
    return;
  }
  searchResult.innerHTML = `<div class="empty-state">Searching...</div>`;
  try {
    const data = await fetchJson(
      `${BACKEND_URL}/api/summoner/${searchPlatform.value}/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`
    );
    renderSearchResult(data);
  } catch (err) {
    searchResult.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderSearchResult(data) {
  const rankHtml = data.ranks.length
    ? data.ranks
        .map(
          (r) =>
            `<div class="stat-row"><span>${r.queue}</span><span>${r.tier} ${r.rank} - ${r.leaguePoints} LP (${r.wins}W ${r.losses}L)</span></div>`
        )
        .join('')
    : `<div class="stat-row"><span>Unranked</span></div>`;

  const matchesHtml = data.recentMatches
    .map(
      (m) =>
        `<div class="match-row ${m.win ? 'win' : 'loss'}"><span>${m.championName} (${m.position || '-'})</span><span>${m.kills}/${m.deaths}/${m.assists} - ${m.win ? 'Win' : 'Loss'}</span></div>`
    )
    .join('');

  searchResult.innerHTML = `
    <div class="player-card">
      <h3>${data.riotId}</h3>
      <div class="sub">Level ${data.summonerLevel}</div>
      ${rankHtml}
    </div>
    <div class="player-card">
      <h3>Recent Matches</h3>
      ${matchesHtml || '<div class="empty-state">No recent ranked matches</div>'}
    </div>
  `;
}

searchBtn.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && runSearch());

// ---------- Live Scout tab ----------
const scoutInput = document.getElementById('scoutInput');
const scoutPlatform = document.getElementById('scoutPlatform');
const scoutBtn = document.getElementById('scoutBtn');
const scoutResult = document.getElementById('scoutResult');

async function runScout() {
  const parsed = parseRiotId(scoutInput.value);
  if (!parsed) {
    scoutResult.innerHTML = `<div class="empty-state">Enter a Riot ID like Name#TAG</div>`;
    return;
  }
  scoutResult.innerHTML = `<div class="empty-state">Looking up live game...</div>`;
  try {
    const data = await fetchJson(
      `${BACKEND_URL}/api/live-game/${scoutPlatform.value}/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`
    );
    renderScoutResult(data);
  } catch (err) {
    scoutResult.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderScoutResult(data) {
  if (!data.inGame) {
    scoutResult.innerHTML = `<div class="empty-state">Not currently in a game.</div>`;
    return;
  }

  const teams = {};
  for (const p of data.participants) {
    if (!teams[p.teamId]) teams[p.teamId] = [];
    teams[p.teamId].push(p);
  }

  const teamHtml = Object.entries(teams)
    .map(([teamId, players]) => {
      const rows = players
        .map((p) => {
          const rankText = p.rank
            ? `${p.rank.tier} ${p.rank.rank} - ${p.rank.winRate}% WR (${p.rank.games} games)`
            : 'Unranked / no data';
          return `<div class="scout-player"><span>${champName(p.championId)} - ${p.riotId || 'Unknown'}</span><span class="rank">${rankText}</span></div>`;
        })
        .join('');
      return `<div class="scout-team"><h4>Team ${teamId}</h4>${rows}</div>`;
    })
    .join('');

  scoutResult.innerHTML = `
    <div class="player-card">
      <h3>${data.queue}</h3>
      <div class="sub">${Math.floor(data.gameLengthSeconds / 60)}m ${data.gameLengthSeconds % 60}s elapsed</div>
    </div>
    ${teamHtml}
  `;
}

scoutBtn.addEventListener('click', runScout);
scoutInput.addEventListener('keydown', (e) => e.key === 'Enter' && runScout());

// ---------- Champions tab ----------
const championFilter = document.getElementById('championFilter');
const championList = document.getElementById('championList');
let allChampionStats = [];

async function loadChampionStats() {
  championList.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const data = await fetchJson(`${BACKEND_URL}/api/champion-stats`);
    allChampionStats = data.champions;
    renderChampionList(allChampionStats);
  } catch (err) {
    championList.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderChampionList(list) {
  if (list.length === 0) {
    championList.innerHTML = `<div class="empty-state">No matches.</div>`;
    return;
  }
  championList.innerHTML = list
    .map((c) => {
      const wrClass = c.winRate >= 52 ? 'wr-good' : c.winRate <= 48 ? 'wr-bad' : '';
      return `<div class="champion-row"><span>${c.champion} <span style="color:var(--muted)">(${c.roles.join(', ')})</span></span><span class="${wrClass}">${c.winRate}% WR - ${c.games} games</span></div>`;
    })
    .join('');
}

championFilter.addEventListener('input', () => {
  const q = championFilter.value.toLowerCase();
  renderChampionList(allChampionStats.filter((c) => c.champion.toLowerCase().includes(q)));
});

loadChampionStats();
