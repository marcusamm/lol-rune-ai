// Applies a rune page via the LCU perks API. Reuses a single page named
// "RuneAI (auto)" - deletes and recreates it each time rather than
// accumulating pages, since accounts have a limited custom-page count.

const { request } = require('./lcu');

const PAGE_NAME = 'RuneAI (auto)';
// Account is at its custom-page limit with no free slot. Confirmed with
// the user which existing page this tool is allowed to take over.
const TAKEOVER_PAGE_NAME = 'teemo';

async function listPages(creds) {
  const { status, body } = await request(creds, 'GET', '/lol-perks/v1/pages');
  if (status !== 200) throw new Error(`Failed to list rune pages (status ${status})`);
  return body;
}

async function createPage(creds, { primaryStyleId, subStyleId, selectedPerkIds }) {
  return request(creds, 'POST', '/lol-perks/v1/pages', {
    name: PAGE_NAME,
    primaryStyleId,
    subStyleId,
    selectedPerkIds,
    current: true,
  });
}

async function applyRunePage(creds, runeChoice) {
  const pages = await listPages(creds);
  const ours = pages.find((p) => p.name === PAGE_NAME);
  if (ours) {
    await request(creds, 'DELETE', `/lol-perks/v1/pages/${ours.id}`);
  }

  let { status, body } = await createPage(creds, runeChoice);

  if (status === 400 && body?.message === 'Max pages reached') {
    const takeover = pages.find((p) => p.name === TAKEOVER_PAGE_NAME);
    if (!takeover) {
      throw new Error(
        `No free rune page slot, and the designated takeover page "${TAKEOVER_PAGE_NAME}" wasn't found.`
      );
    }
    await request(creds, 'DELETE', `/lol-perks/v1/pages/${takeover.id}`);
    ({ status, body } = await createPage(creds, runeChoice));
  }

  if (status !== 200 && status !== 201) {
    throw new Error(`Failed to create rune page (status ${status}): ${JSON.stringify(body)}`);
  }
  return body;
}

module.exports = { applyRunePage, listPages, PAGE_NAME };
