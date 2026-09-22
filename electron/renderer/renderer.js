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

// Rune/perk icons come from Community Dragon; Data Dragon's runesReforged
// only carries paths relative to that CDN.
let perkIdToIcon = {};
(async () => {
  try {
    const trees = await fetch(
      'https://ddragon.leagueoflegends.com/cdn/14.1.1/data/en_US/runesReforged.json'
    ).then((r) => r.json());
    for (const tree of trees) {
      perkIdToIcon[tree.id] = tree.icon;
      for (const slot of tree.slots) {
        for (const rune of slot.runes) perkIdToIcon[rune.id] = rune.icon;
      }
    }
  } catch (err) {
    console.error('Failed to load rune data', err);
  }
})();

function perkIcon(perkId) {
  const icon = perkIdToIcon[perkId];
  if (!icon) return '';
  return `<img class="perk-icon" src="https://ddragon.leagueoflegends.com/cdn/img/${icon}" alt="Perk ${perkId}" onerror="this.style.visibility='hidden'" />`;
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
            `<span class="player-tag tone-${t.tone}" title="${t.detail}">${t.label}<span class="tag-detail">${t.detail}</span></span>`
        )
        .join('')}</div>`
    : `<div class="empty-state" style="padding:10px 0">No notable patterns in the last ${sampleSize} games.</div>`;

  const mateHtml = teammates.length
    ? `<h3 style="margin:14px 0 8px">Frequent teammates</h3>` +
      teammates
        .map(
          (t) =>
            `<div class="stat-row"><span>${t.name}</span><span class="${t.winRate >= 50 ? 'wr-good' : 'wr-bad'}">${t.games} games &middot; ${t.winRate}%</span></div>`
        )
        .join('')
    : '';

  slot.innerHTML = `
    <div class="player-card">
      <h3 style="margin-bottom:10px">Playstyle <span style="color:var(--muted-soft);font-weight:400;font-size:11px">last ${sampleSize} games</span></h3>
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
        <div class="left">
          ${champIconByName(m.championName)}
          <div class="spell-stack">${spellIconById(m.summoner1Id)}${spellIconById(m.summoner2Id)}</div>
          <div>
            <div class="name">${champNameFromKey(m.championName)} <span style="color:var(--muted-soft);font-weight:400">&middot; ${positionLabel(m.position) || '-'}</span></div>
            <div class="kda">${m.kills}/${m.deaths}/${m.assists} &middot; ${m.cs} CS${m.killParticipation != null ? ` &middot; ${m.killParticipation}% KP` : ''}</div>
          </div>
        </div>
        <div class="match-right">
          <div class="teammates">${teammatesHtml}</div>
          <div class="match-meta">
            <span class="result-pill">${m.win ? 'Win' : 'Loss'}</span>
            <span class="match-time">${formatDuration(m.gameDurationSeconds)} &middot; ${timeAgo(m.gameCreation)}</span>
          </div>
        </div>
      </div>`;
    })
    .join('');

  searchResult.innerHTML = `
    <div class="player-card">
      <div class="profile-head">
        ${rankEmblem(solo?.tier)}
        <div>
          <h3>${data.riotId}</h3>
          <div class="sub">Level ${data.summonerLevel}</div>
        </div>
      </div>
      ${rankHtml}
      ${masteryHtml ? `<div class="mastery-row">${masteryHtml}</div>` : ''}
    </div>
    <div id="analyticsSlot"></div>
    ${roleHtml ? `<div class="player-card"><h3 style="margin-bottom:10px">Positions</h3>${roleHtml}</div>` : ''}
    <div class="player-card">
      <h3 style="margin-bottom:8px">Recent Matches</h3>
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
    .map(([teamId, players], idx) => {
      const rows = players
        .map((p) => {
          const rankText = p.rank
            ? `<span class="rank-tier ${tierClass(p.rank.tier)}">${p.rank.tier} ${p.rank.rank}</span> ${p.rank.winRate}% WR (${p.rank.games})`
            : 'Unranked';
          return `
            <div class="scout-player">
              <div class="left">
                ${champIconById(p.championId)}
                <div class="spell-stack">${spellIconById(p.spell1Id)}${spellIconById(p.spell2Id)}</div>
                <span class="who">${champName(p.championId)} &middot; ${p.riotId || 'Unknown'}</span>
              </div>
              <span class="rank">${rankText}</span>
            </div>`;
        })
        .join('');
      return `<div class="scout-team"><h4>Team ${idx + 1}</h4>${rows}</div>`;
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
      const wrClass = c.winRate >= 52 ? 'wr-good' : c.winRate <= 48 ? 'wr-bad' : 'wr-mid';
      return `
        <div class="champion-row" data-champion="${c.champion}">
          <div class="left">
            ${champIconByName(c.champion)}
            <div>
              <div class="name">${champNameFromKey(c.champion)}</div>
              <div class="roles">${c.roles.join(' / ')}</div>
            </div>
          </div>
          <div class="stats">
            <span class="${wrClass}">${c.winRate}% WR</span>
            <span class="games">${c.games} games</span>
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
  const row = e.target.closest('.champion-row');
  if (row && row.dataset.champion) openChampionDetail(row.dataset.champion);
});

async function openChampionDetail(champion, position) {
  championList.hidden = true;
  championFilter.parentElement.hidden = true;
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
  championList.hidden = false;
  championFilter.parentElement.hidden = false;
}

function renderChampionDetail(d) {
  const roleTabs = d.byRole
    .map(
      (r) =>
        `<button class="role-tab ${r.role === d.position ? 'active' : ''}" data-role="${r.role}">${positionLabel(r.role)} <span class="role-tab-sub">${r.games}g</span></button>`
    )
    .join('');

  const page = d.bestPage;
  const runesHtml = page
    ? `<div class="rune-strip">${page.selectedPerkIds.map(perkIcon).join('')}</div>
       <div class="sub">${(page.winRate * 100).toFixed(1)}% win rate over ${page.games} games</div>`
    : `<div class="empty-state" style="padding:10px 0">Not enough rune data yet.</div>`;

  const itemsHtml = d.items.length
    ? `<div class="item-strip">${d.items
        .map(
          (i) =>
            `<div class="item-chip" title="${i.winRate}% WR over ${i.games} games">${itemIcon(i.itemId)}<span class="${i.winRate >= 52 ? 'wr-good' : i.winRate <= 48 ? 'wr-bad' : 'wr-mid'}">${i.winRate}%</span></div>`
        )
        .join('')}</div>`
    : `<div class="empty-state" style="padding:10px 0">Not enough item data yet.</div>`;

  const spellsHtml = d.spells.length
    ? d.spells
        .map(
          (s) =>
            `<div class="stat-row"><span class="left">${s.spellIds.map(spellIconById).join('')}</span><span>${s.winRate}% &middot; ${s.games} games</span></div>`
        )
        .join('')
    : '';

  const matchupRow = (m, good) =>
    `<div class="stat-row"><span class="left">${champIconByName(m.opponent, 'xs')} ${champNameFromKey(m.opponent)}</span><span class="${good ? 'wr-good' : 'wr-bad'}">${m.winRate}% &middot; ${m.games}g</span></div>`;

  championDetail.innerHTML = `
    <button id="champBackBtn" class="back-btn">&larr; All champions</button>
    <div class="player-card">
      <div class="profile-head">
        ${champIconByName(d.champion, 'md')}
        <div>
          <h3>${champNameFromKey(d.champion)}</h3>
          <div class="sub">${d.pickRate != null ? `${d.pickRate}% pick rate in dataset` : ''}</div>
        </div>
      </div>
      <div class="role-tabs">${roleTabs}</div>
    </div>

    <div class="player-card">
      <h3 style="margin-bottom:10px">Best runes</h3>
      ${runesHtml}
    </div>

    <div class="player-card">
      <h3 style="margin-bottom:10px">Most successful items</h3>
      ${itemsHtml}
    </div>

    ${spellsHtml ? `<div class="player-card"><h3 style="margin-bottom:10px">Summoner spells</h3>${spellsHtml}</div>` : ''}

    <div class="player-card">
      <h3 style="margin-bottom:10px">Strong against</h3>
      ${d.strongAgainst.length ? d.strongAgainst.map((m) => matchupRow(m, true)).join('') : '<div class="empty-state" style="padding:10px 0">Not enough matchup data yet.</div>'}
    </div>

    <div class="player-card">
      <h3 style="margin-bottom:10px">Struggles against</h3>
      ${d.weakAgainst.length ? d.weakAgainst.map((m) => matchupRow(m, false)).join('') : '<div class="empty-state" style="padding:10px 0">Not enough matchup data yet.</div>'}
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
