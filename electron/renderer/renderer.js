const BACKEND_URL = window.runeAI.backendUrl;

// ---------- Tabs ----------
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Settings ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

(async () => {
  const settings = await window.runeAI.getSettings();
  applyTheme(settings.theme);

  document.getElementById('setLaunchOnStartup').checked = settings.launchOnStartup;
  document.getElementById('setMinimizeToTray').checked = settings.minimizeToTray;
  document.getElementById('setNotifyOnApply').checked = settings.notifyOnApply;
  document.getElementById('setAutoAccept').checked = settings.autoAccept;
  document.getElementById('setAutoItemSet').checked = settings.autoItemSet;
  document.getElementById('setShowOverlay').checked = settings.showOverlay;
  document.getElementById('setDefaultRegion').value = settings.defaultRegion;
  document.getElementById('setTheme').value = settings.theme;

  // Prefill region pickers used elsewhere in the app.
  document.getElementById('searchPlatform').value = settings.defaultRegion;
  document.getElementById('scoutPlatform').value = settings.defaultRegion;
  document.getElementById('rankPlatform').value = settings.defaultRegion;
})();

document.getElementById('setAutoAccept').addEventListener('change', (e) =>
  window.runeAI.setSetting('autoAccept', e.target.checked)
);
document.getElementById('setAutoItemSet').addEventListener('change', (e) =>
  window.runeAI.setSetting('autoItemSet', e.target.checked)
);
document.getElementById('previewOverlayBtn').addEventListener('click', () => window.runeAI.previewOverlay());
document.getElementById('setShowOverlay').addEventListener('change', (e) =>
  window.runeAI.setSetting('showOverlay', e.target.checked)
);

document.getElementById('setLaunchOnStartup').addEventListener('change', (e) =>
  window.runeAI.setSetting('launchOnStartup', e.target.checked)
);
document.getElementById('setMinimizeToTray').addEventListener('change', (e) =>
  window.runeAI.setSetting('minimizeToTray', e.target.checked)
);
document.getElementById('setNotifyOnApply').addEventListener('change', (e) =>
  window.runeAI.setSetting('notifyOnApply', e.target.checked)
);
document.getElementById('setDefaultRegion').addEventListener('change', (e) => {
  window.runeAI.setSetting('defaultRegion', e.target.value);
  document.getElementById('searchPlatform').value = e.target.value;
  document.getElementById('scoutPlatform').value = e.target.value;
  document.getElementById('rankPlatform').value = e.target.value;
});
document.getElementById('setTheme').addEventListener('change', (e) => {
  window.runeAI.setSetting('theme', e.target.value);
  applyTheme(e.target.value);
});

// ---------- Champion id -> display name / icon (for live scout / search) ----------
// championName (Match-V5 style, e.g. "MonkeyKing", "DrMundo") is also Data
// Dragon's image filename stem, so one id->{name, imageKey} map covers both
// the numeric-id lookups (live scout) and name-keyed lookups (search/champ list).
let ddragonVersion = null;
let championIdToDisplayName = {};
let championIdToImageKey = {};
let imageKeyToDisplayName = {}; // e.g. "MonkeyKing" -> "Wukong"
let spellIdToImage = {}; // numeric summoner spell id -> {file, name}

(async () => {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    ddragonVersion = versions[0];
    const [champJson, spellJson] = await Promise.all([
      fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`).then((r) => r.json()),
      fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/summoner.json`).then((r) => r.json()),
    ]);
    for (const champ of Object.values(champJson.data)) {
      championIdToDisplayName[Number(champ.key)] = champ.name;
      championIdToImageKey[Number(champ.key)] = champ.id;
      imageKeyToDisplayName[champ.id] = champ.name;
    }
    for (const spell of Object.values(spellJson.data)) {
      spellIdToImage[Number(spell.id)] = { file: spell.image.full, name: spell.name };
    }

    // Pick one champion's splash art for the ambient background, once.
    const imageKeys = Object.values(championIdToImageKey);
    const pick = imageKeys[Math.floor(Math.random() * imageKeys.length)];
    setSplashChampion(pick);
  } catch (err) {
    console.error('Failed to load champion/spell data', err);
  }
})();

const splashBg = document.getElementById('splashBg');

function setSplashChampion(imageKey) {
  if (!imageKey || !splashBg) return;
  splashBg.style.backgroundImage = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${imageKey}_0.png)`;
  splashBg.classList.add('visible');
}

function spellIconById(spellId) {
  const v = ddragonVersion || '14.1.1';
  const spell = spellIdToImage[spellId];
  if (!spell) return '<div class="spell-icon"></div>';
  return `<img class="spell-icon" src="https://ddragon.leagueoflegends.com/cdn/${v}/img/spell/${spell.file}" alt="${spell.name}" title="${spell.name}" onerror="this.style.visibility='hidden'" />`;
}

function champName(id) {
  return championIdToDisplayName[id] || `Champion ${id}`;
}

function champNameFromKey(imageKey) {
  return imageKeyToDisplayName[imageKey] || imageKey;
}

function champIconByName(championImageKey, size = 'sm') {
  const v = ddragonVersion || '14.1.1';
  const cls = `champ-icon ${size}`;
  return `<img class="${cls}" src="https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${championImageKey}.png" alt="${championImageKey}" onerror="this.style.visibility='hidden'" />`;
}

function champIconById(championId, size = 'sm') {
  const imageKey = championIdToImageKey[championId];
  return imageKey ? champIconByName(imageKey, size) : `<div class="champ-icon ${size}"></div>`;
}

function itemIcon(itemId) {
  const v = ddragonVersion || '14.1.1';
  return `<img class="item-icon" src="https://ddragon.leagueoflegends.com/cdn/${v}/img/item/${itemId}.png" alt="Item ${itemId}" onerror="this.style.visibility='hidden'" />`;
}

// Rune metadata: icon + name + which tree each perk belongs to, so the
// build panel can lay out a real rune page instead of a flat icon strip.
let perkMeta = {}; // perkId -> { icon, name, treeId }
let treeMeta = {}; // styleId -> { icon, name }

// Item metadata drives build-path grouping (starting / boots / core).
let itemMeta = {}; // itemId -> { name, cost, tags, depth }

(async () => {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    const v = versions[0];
    const patchEl = document.getElementById('patchValue');
    if (patchEl) patchEl.textContent = v.split('.').slice(0, 2).join('.');

    const [trees, items] = await Promise.all([
      fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/runesReforged.json`).then((r) => r.json()),
      fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/item.json`).then((r) => r.json()),
    ]);

    for (const tree of trees) {
      treeMeta[tree.id] = { icon: tree.icon, name: tree.name };
      for (const slot of tree.slots) {
        for (const rune of slot.runes) {
          perkMeta[rune.id] = { icon: rune.icon, name: rune.name, treeId: tree.id };
        }
      }
    }

    for (const [id, item] of Object.entries(items.data)) {
      itemMeta[Number(id)] = {
        name: item.name,
        cost: item.gold?.total ?? 0,
        tags: item.tags || [],
        depth: item.depth || 1,
      };
    }
  } catch (err) {
    console.error('Failed to load rune/item metadata', err);
  }
})();

function perkIcon(perkId, cls = 'perk-icon') {
  const meta = perkMeta[perkId];
  if (!meta) return '';
  return `<img class="${cls}" src="https://ddragon.leagueoflegends.com/cdn/img/${meta.icon}" alt="${meta.name}" title="${meta.name}" onerror="this.style.visibility='hidden'" />`;
}

function treeIcon(styleId) {
  const meta = treeMeta[styleId];
  if (!meta) return '';
  return `<img src="https://ddragon.leagueoflegends.com/cdn/img/${meta.icon}" alt="${meta.name}" />`;
}

function treeName(styleId) {
  return treeMeta[styleId]?.name || '';
}

// Stat shards aren't in runesReforged, so they get a small static map.
const SHARD_NAMES = {
  5001: 'Health', 5002: 'Armour', 5003: 'Magic Resist',
  5005: 'Attack Speed', 5007: 'Ability Haste', 5008: 'Adaptive Force',
  5010: 'Move Speed', 5011: 'Health Scaling', 5013: 'Tenacity',
};

function shardChip(perkId) {
  const name = SHARD_NAMES[perkId] || 'Shard';
  const short = name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return `<span class="shard" title="${name}">${short}</span>`;
}

// Groups items into a readable build path using Data Dragon's own tags
// and gold cost rather than a hand-maintained list.
function classifyItem(itemId) {
  const meta = itemMeta[itemId];
  if (!meta) return 'core';
  if (meta.tags.includes('Boots')) return 'boots';
  if (meta.cost > 0 && meta.cost <= 700 && meta.depth <= 1) return 'starting';
  if (meta.cost >= 2200) return 'core';
  return 'situational';
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

    // Playstyle tags are a second, slower call - render the profile first,
    // then fill them in so the page isn't blocked on the analysis.
    fetchJson(
      `${BACKEND_URL}/api/analytics/${searchPlatform.value}/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`
    )
      .then(renderAnalytics)
      .catch(() => {});
  } catch (err) {
    searchResult.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderAnalytics({ tags, teammates, sampleSize }) {
  const slot = document.getElementById('analyticsSlot');
  if (!slot) return;

  const tagsHtml = tags.length
    ? `<div class="tag-row">${tags
        .map(
          (t) =>
            `<span class="player-tag tone-${t.tone}"><span class="tag-label">${t.label}</span><span class="tag-detail">${t.detail}</span></span>`
        )
        .join('')}</div>`
    : `<div class="empty-state" style="padding:14px 0">No notable patterns in the last ${sampleSize} games.</div>`;

  const mateHtml = teammates.length
    ? `<div class="build-label" style="margin-top:16px">Frequent teammates</div>` +
      teammates
        .map(
          (t) =>
            `<div class="role-row" style="grid-template-columns:1fr auto auto">
               <span class="role-label" style="width:auto">${t.name}</span>
               <span class="role-games">${t.games}g</span>
               <span class="${t.winRate >= 50 ? 'wr-good' : 'wr-bad'}">${t.winRate}%</span>
             </div>`
        )
        .join('')
    : '';

  slot.innerHTML = `
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>Playstyle</h2><span style="margin-left:auto;font-size:10px;color:var(--text-faint)">last ${sampleSize} games</span></div>
      ${tagsHtml}
      ${mateHtml}
    </div>`;
}

function tierClass(tier) {
  return tier ? `tier-${tier}` : '';
}

function rankEmblem(tier) {
  if (!tier) return '';
  return `<img class="rank-emblem" src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png" alt="${tier}" onerror="this.style.visibility='hidden'" />`;
}

function positionLabel(pos) {
  const labels = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };
  return labels[pos] || pos;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function renderSearchResult(data) {
  const solo = data.ranks.find((r) => r.queue === 'Ranked Solo/Duo');

  const rankHtml = data.ranks.length
    ? data.ranks
        .map(
          (r) =>
            `<div class="stat-row"><span>${r.queue}</span><span class="${tierClass(r.tier)}">${r.tier} ${r.rank} <span style="color:var(--muted)">- ${r.leaguePoints} LP (${r.wins}W ${r.losses}L, ${Math.round((r.wins / (r.wins + r.losses)) * 100)}%)</span></span></div>`
        )
        .join('')
    : `<div class="stat-row"><span>Unranked</span></div>`;

  const masteryHtml = (data.topChampions || [])
    .map(
      (c) => `
      <div class="mastery-chip">
        ${champIconById(c.championId, 'md')}
        <div class="mastery-info">
          <div class="mastery-name">${champName(c.championId)}</div>
          <div class="mastery-pts">Lv${c.level} &middot; ${c.points.toLocaleString()} pts</div>
        </div>
      </div>`
    )
    .join('');

  const roleHtml = (data.roles || [])
    .map((r) => {
      const maxGames = Math.max(...data.roles.map((x) => x.games));
      const barWidth = Math.round((r.games / maxGames) * 100);
      const wrClass = r.winRate >= 52 ? 'wr-good' : r.winRate <= 48 ? 'wr-bad' : 'wr-mid';
      return `
        <div class="role-row">
          <span class="role-label">${positionLabel(r.position)}</span>
          <div class="role-bar-track"><div class="role-bar-fill" style="width:${barWidth}%"></div></div>
          <span class="role-games">${r.games}</span>
          <span class="${wrClass}">${r.winRate}%</span>
        </div>`;
    })
    .join('');

  const matchesHtml = data.recentMatches
    .map((m) => {
      const teammatesHtml = m.teammates.map((t) => champIconByName(t, 'xs')).join('');
      return `
      <div class="match-row ${m.win ? 'win' : 'loss'}">
        <span class="match-flag"></span>
        ${champIconByName(m.championName)}
        <div class="spell-stack">${spellIconById(m.summoner1Id)}${spellIconById(m.summoner2Id)}</div>
        <div class="match-body">
          <div class="match-champ">${champNameFromKey(m.championName)} <span style="color:var(--text-faint);font-weight:500">${positionLabel(m.position) || ''}</span></div>
          <div class="match-kda">${m.kills}/${m.deaths}/${m.assists} &middot; ${m.cs} CS${m.killParticipation != null ? ` &middot; ${m.killParticipation}% KP` : ''}</div>
        </div>
        <div class="teammates">${teammatesHtml}</div>
        <div class="match-meta">
          <div class="result-pill">${m.win ? 'Win' : 'Loss'}</div>
          <div class="match-time">${formatDuration(m.gameDurationSeconds)} &middot; ${timeAgo(m.gameCreation)}</div>
        </div>
      </div>`;
    })
    .join('');

  const soloLine = solo
    ? `<div class="rank-tier-big ${tierClass(solo.tier)}">${solo.tier} ${solo.rank}</div>
       <div class="rank-detail">${solo.leaguePoints} LP &middot; ${solo.wins}W ${solo.losses}L &middot; ${Math.round((solo.wins / (solo.wins + solo.losses)) * 100)}% win rate</div>`
    : `<div class="rank-tier-big">Unranked</div><div class="rank-detail">No solo queue games this season</div>`;

  searchResult.innerHTML = `
    <div class="profile-layout">
      <div>
        <div class="profile-hero">
          <div class="profile-hero-top">
            ${rankEmblem(solo?.tier)}
            <div>
              <div class="profile-name">${data.riotId.split('#')[0]}</div>
              <div class="profile-level">#${data.riotId.split('#')[1]} &middot; Level ${data.summonerLevel}</div>
            </div>
          </div>
          <div class="rank-line">${soloLine}</div>
          ${masteryHtml ? `<div class="mastery-row">${masteryHtml}</div>` : ''}
        </div>

        <div id="analyticsSlot"></div>

        ${
          roleHtml
            ? `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>Position breakdown</h2></div>${roleHtml}</div>`
            : ''
        }
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Recent matches</h2></div>
        ${matchesHtml || '<div class="empty-state">No recent ranked matches</div>'}
      </div>
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
    .map(([teamId, players], idx) => {
      const isBlue = idx === 0;
      const rows = players
        .map(
          (p) => `
            <div class="scout-player">
              ${champIconById(p.championId)}
              <div class="spell-stack">${spellIconById(p.spell1Id)}${spellIconById(p.spell2Id)}</div>
              <div class="scout-who">
                <div class="scout-champ">${champName(p.championId)}</div>
                <div class="scout-id">${p.riotId || 'Unknown'}</div>
              </div>
              <div class="scout-rank">
                ${
                  p.rank
                    ? `<div class="scout-rank-tier ${tierClass(p.rank.tier)}">${p.rank.tier} ${p.rank.rank}</div>
                       <div class="scout-rank-sub">${p.rank.winRate}% &middot; ${p.rank.games}g</div>`
                    : `<div class="scout-rank-sub">Unranked</div>`
                }
              </div>
            </div>`
        )
        .join('');
      return `
        <div>
          <div class="scout-team-head ${isBlue ? 'team-blue' : 'team-red'}">
            <span class="dot" style="background:currentColor;box-shadow:none"></span>
            ${isBlue ? 'Blue side' : 'Red side'}
          </div>
          ${rows}
        </div>`;
    })
    .join('');

  scoutResult.innerHTML = `
    <div class="panel accent-panel" style="margin-bottom:16px">
      <div class="panel-head"><h2>${data.queue}</h2><span class="live-pip">LIVE</span></div>
      <div class="stat-line">${Math.floor(data.gameLengthSeconds / 60)}m ${data.gameLengthSeconds % 60}s elapsed &middot; ${data.participants.length} players</div>
    </div>
    <div class="scout-teams">${teamHtml}</div>
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
      const wrClass = c.winRate >= 52 ? 'wr-good' : c.winRate <= 48 ? 'wr-bad' : 'wr-mid';
      return `
        <div class="champ-card" data-champion="${c.champion}">
          ${champIconByName(c.champion, 'md')}
          <div class="champ-card-body">
            <div class="champ-card-name">${champNameFromKey(c.champion)}</div>
            <div class="champ-card-roles">${c.roles.slice(0, 3).map(positionLabel).join(' · ')}</div>
          </div>
          <div class="champ-card-stats">
            <div class="champ-card-wr ${wrClass}">${c.winRate}%</div>
            <div class="champ-card-games">${c.games} games</div>
          </div>
        </div>`;
    })
    .join('');
}

championFilter.addEventListener('input', () => {
  const q = championFilter.value.toLowerCase();
  renderChampionList(allChampionStats.filter((c) => c.champion.toLowerCase().includes(q)));
});

loadChampionStats();

// ---------- Champion detail ----------
const championDetail = document.getElementById('championDetail');

championList.addEventListener('click', (e) => {
  const row = e.target.closest('.champ-card');
  if (row && row.dataset.champion) openChampionDetail(row.dataset.champion);
});

async function openChampionDetail(champion, position) {
  document.getElementById('championBrowse').hidden = true;
  championDetail.hidden = false;
  championDetail.innerHTML = `<div class="empty-state">Loading ${champNameFromKey(champion)}...</div>`;

  try {
    const url = `${BACKEND_URL}/api/champion/${encodeURIComponent(champion)}${position ? `?position=${position}` : ''}`;
    renderChampionDetail(await fetchJson(url));
  } catch (err) {
    championDetail.innerHTML = `<div class="empty-state">${err.message}</div><button id="champBackBtn">Back</button>`;
    document.getElementById('champBackBtn')?.addEventListener('click', closeChampionDetail);
  }
}

function closeChampionDetail() {
  championDetail.hidden = true;
  document.getElementById('championBrowse').hidden = false;
}

function tierBadge(winRate, games) {
  if (games < 8) return { label: 'Unrated', cls: '' };
  if (winRate >= 54) return { label: 'S Tier', cls: 'tier' };
  if (winRate >= 51) return { label: 'A Tier', cls: 'tier' };
  if (winRate >= 48.5) return { label: 'B Tier', cls: '' };
  return { label: 'C Tier', cls: '' };
}

function renderChampionDetail(d) {
  const roleStats = d.byRole.find((r) => r.role === d.position) || d.byRole[0];
  const tier = tierBadge(roleStats?.winRate ?? 0, roleStats?.games ?? 0);
  const splash = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${d.champion}_0.png`;

  const roleTabs = d.byRole
    .map(
      (r) =>
        `<button class="role-tab ${r.role === d.position ? 'active' : ''}" data-role="${r.role}">${positionLabel(r.role)} <span class="role-tab-sub">${r.games}</span></button>`
    )
    .join('');

  // ---- Rune page: primary tree (keystone + 3), secondary (2), shards (3)
  const page = d.bestPage;
  let runesHtml = `<div class="empty-state" style="padding:18px 0">Not enough rune data yet.</div>`;
  if (page) {
    const ids = page.selectedPerkIds;
    const [keystone, p2, p3, p4, s1, s2, sh1, sh2, sh3] = ids;
    runesHtml = `
      <div class="rune-page">
        <div>
          <div class="rune-tree-label">${treeIcon(page.primaryStyleId)}${treeName(page.primaryStyleId)}</div>
          <div class="keystone-row">
            <div class="keystone">${perkIcon(keystone, '')}</div>
            <div>
              <div class="keystone-name">${perkMeta[keystone]?.name || 'Keystone'}</div>
              <div class="keystone-sub">${(page.winRate * 100).toFixed(1)}% win rate &middot; ${page.games} games</div>
            </div>
          </div>
          <div class="rune-row">
            ${[p2, p3, p4].map((id) => `<span class="rune-slot" title="${perkMeta[id]?.name || ''}">${perkIcon(id, '')}</span>`).join('')}
          </div>
        </div>

        <div class="rune-divider"></div>

        <div>
          <div class="rune-tree-label">${treeIcon(page.subStyleId)}${treeName(page.subStyleId)}</div>
          <div class="rune-row">
            ${[s1, s2].map((id) => `<span class="rune-slot" title="${perkMeta[id]?.name || ''}">${perkIcon(id, '')}</span>`).join('')}
          </div>
        </div>

        <div>
          <div class="build-label">Shards</div>
          <div class="shard-row">${[sh1, sh2, sh3].map(shardChip).join('')}</div>
        </div>
      </div>`;
  }

  // ---- Items grouped into an actual build path
  const groups = { starting: [], boots: [], core: [], situational: [] };
  for (const item of d.items) groups[classifyItem(item.itemId)].push(item);

  const buildBlock = (label, list, arrows) => {
    if (!list.length) return '';
    const inner = list
      .map(
        (i) => `
        <div class="build-item" title="${itemMeta[i.itemId]?.name || ''} — ${i.winRate}% over ${i.games} games">
          ${itemIcon(i.itemId)}
          <span class="build-item-wr ${i.winRate >= 52 ? 'wr-good' : i.winRate <= 48 ? 'wr-bad' : 'wr-mid'}">${i.winRate}%</span>
        </div>`
      )
      .join(arrows ? '<span class="build-arrow">›</span>' : '');
    return `<div class="build-section"><div class="build-label">${label}</div><div class="build-path">${inner}</div></div>`;
  };

  const itemsHtml =
    d.items.length === 0
      ? `<div class="empty-state" style="padding:18px 0">Not enough item data yet.</div>`
      : buildBlock('Starting', groups.starting, false) +
        buildBlock('Core build', groups.core, true) +
        buildBlock('Boots', groups.boots, false) +
        buildBlock('Situational', groups.situational, false);

  const spellsHtml = d.spells.length
    ? `<div class="build-section"><div class="build-label">Summoner spells</div>
        ${d.spells
          .map(
            (s) => `<div class="matchup-row" style="grid-template-columns:auto 1fr 64px">
              <span class="spell-stack" style="flex-direction:row;gap:4px">${s.spellIds.map(spellIconById).join('')}</span>
              <span class="mu-name">${s.spellIds.map((id) => spellIdToImage[id]?.name || '').filter(Boolean).join(' + ')}</span>
              <span class="mu-stats"><span class="mu-wr ${s.winRate >= 52 ? 'wr-good' : 'wr-mid'}">${s.winRate}%</span><span class="mu-games">${s.games} games</span></span>
            </div>`
          )
          .join('')}
      </div>`
    : '';

  const matchupRow = (m, good) => `
    <div class="matchup-row">
      ${champIconByName(m.opponent, 'xs')}
      <div>
        <div class="mu-name">${champNameFromKey(m.opponent)}</div>
        <div class="mu-bar-track"><div class="mu-bar-fill ${good ? 'good' : 'bad'}" style="width:${Math.max(4, Math.min(100, m.winRate))}%"></div></div>
      </div>
      <div class="mu-stats">
        <div class="mu-wr ${good ? 'wr-good' : 'wr-bad'}">${m.winRate}%</div>
        <div class="mu-games">${m.games} games</div>
      </div>
    </div>`;

  const noMatchups = `<div class="empty-state" style="padding:14px 0">Not enough matchup data yet.</div>`;

  championDetail.innerHTML = `
    <button id="champBackBtn" class="back-btn">‹ All champions</button>

    <div class="champ-hero">
      <div class="hero-art" style="background-image:url('${splash}')"></div>
      <div class="hero-scrim"></div>
      <div class="hero-inner">
        <div class="hero-top">
          ${champIconByName(d.champion, 'lg')}
          <div>
            <div class="hero-name">${champNameFromKey(d.champion)}</div>
            <div class="hero-meta">
              <span class="hero-chip">${positionLabel(d.position)}</span>
              <span class="hero-chip ${tier.cls}">${tier.label}</span>
              <span class="hero-chip">${d.matchesInDataset.toLocaleString()} matches analysed</span>
            </div>
          </div>
          <div style="margin-left:auto"><div class="role-tabs">${roleTabs}</div></div>
        </div>

        <div class="stat-strip">
          <div class="stat-cell">
            <div class="stat-key">Win rate</div>
            <div class="stat-val ${roleStats?.winRate >= 52 ? 'wr-good' : roleStats?.winRate <= 48 ? 'wr-bad' : ''}">${roleStats?.winRate ?? '—'}%</div>
            <div class="stat-note">this role</div>
          </div>
          <div class="stat-cell">
            <div class="stat-key">Pick rate</div>
            <div class="stat-val">${d.pickRate ?? '—'}%</div>
            <div class="stat-note">of analysed games</div>
          </div>
          <div class="stat-cell">
            <div class="stat-key">Games</div>
            <div class="stat-val">${roleStats?.games ?? 0}</div>
            <div class="stat-note">in sample</div>
          </div>
          <div class="stat-cell">
            <div class="stat-key">Roles</div>
            <div class="stat-val">${d.byRole.length}</div>
            <div class="stat-note">${d.byRole.map((r) => positionLabel(r.role)).join(' · ')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="panel accent-panel">
        <div class="panel-head"><h2>Recommended runes</h2></div>
        ${runesHtml}
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Build path</h2></div>
        ${itemsHtml}
        ${spellsHtml}
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Matchups</h2></div>
        <div class="build-label" style="color:var(--teal)">Strong against</div>
        ${d.strongAgainst.length ? d.strongAgainst.map((m) => matchupRow(m, true)).join('') : noMatchups}
        <div class="build-label" style="color:var(--red);margin-top:16px">Struggles against</div>
        ${d.weakAgainst.length ? d.weakAgainst.map((m) => matchupRow(m, false)).join('') : noMatchups}
      </div>
    </div>
  `;

  document.getElementById('champBackBtn').addEventListener('click', closeChampionDetail);
  championDetail.querySelectorAll('.role-tab').forEach((btn) => {
    btn.addEventListener('click', () => openChampionDetail(d.champion, btn.dataset.role));
  });
}

// ---------- Rankings tab ----------
const rankTier = document.getElementById('rankTier');
const rankPlatform = document.getElementById('rankPlatform');
const rankLoadBtn = document.getElementById('rankLoadBtn');
const rankingsList = document.getElementById('rankingsList');

rankLoadBtn.addEventListener('click', async () => {
  rankingsList.innerHTML = `<div class="empty-state">Loading ladder...</div>`;
  try {
    const data = await fetchJson(
      `${BACKEND_URL}/api/rankings/${rankPlatform.value}?tier=${rankTier.value}&limit=50`
    );
    rankingsList.innerHTML = data.players
      .map(
        (p) => `
        <div class="rank-row">
          <span class="rank-pos">${p.rank}</span>
          <span class="rank-name">${p.riotId || 'Unknown'}${p.hotStreak ? ' <span class="hot">HOT</span>' : ''}</span>
          <span class="rank-lp">${p.leaguePoints.toLocaleString()} LP</span>
          <span class="${p.winRate >= 55 ? 'wr-good' : 'wr-mid'}">${p.winRate}%</span>
        </div>`
      )
      .join('');
  } catch (err) {
    rankingsList.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
});

// ---------- Global search (top bar) ----------
// Routes to the right tab based on what was typed: a Riot ID (Name#TAG)
// opens the player profile, anything else is treated as a champion.
const globalSearch = document.getElementById('globalSearch');

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
}

globalSearch?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const q = globalSearch.value.trim();
  if (!q) return;

  if (q.includes('#')) {
    switchTab('search');
    searchInput.value = q;
    runSearch();
  } else {
    const match = allChampionStats.find(
      (c) =>
        c.champion.toLowerCase() === q.toLowerCase() ||
        champNameFromKey(c.champion).toLowerCase() === q.toLowerCase()
    );
    switchTab('champions');
    if (match) openChampionDetail(match.champion);
    else {
      championFilter.value = q;
      championFilter.dispatchEvent(new Event('input'));
    }
  }
  globalSearch.value = '';
});
