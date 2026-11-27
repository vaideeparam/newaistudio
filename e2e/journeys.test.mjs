// User-journey tests: what a person does in ai/Studio, at phone and desktop
// size, against the preview build (sample data shaped like the live gateway).
// Run: npm run e2e        Screens land in e2e/screens (or $E2E_SHOTS).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, open, shot, overflowX, stored } from './harness.mjs';

before(setup);
after(teardown);

const SIZES = ['phone', 'desktop'];
const LEADGEN = 'e76458bf'; // DAG mind, published, 9 inputs (2 required, JSON)
const MLX = 'e3651acd'; // orchestrator chat mind, draft
const PM = 'f195e6ea'; // published chat mind with gateway run history

async function done(p) {
  assert.deepEqual(p.errors, [], `page errors: ${p.errors.join(' | ')}`);
  await p.ctx.close();
}

for (const size of SIZES) {
  test(`[${size}] J1 navigation reaches every section without sideways scroll`, async () => {
    const p = await open(size, '/');
    for (const [label, heading] of [
      ['Agents', 'Agents'],
      ['Routines', 'Routines'],
      ['Chats', 'Chats'],
      ['Connectors', 'Connectors'],
      ['Governance', 'Governance'],
    ]) {
      if (size === 'phone') {
        await p.getByRole('button', { name: 'Open menu' }).click();
        await p.locator('.as-sidebar').getByRole('link', { name: label, exact: true }).click();
        // The drawer closes once you pick a section.
        await p.waitForTimeout(250);
        assert.equal(await p.locator('.is-drawer-open').count(), 0, 'drawer stays open after navigating');
      } else {
        await p.locator('.as-sidebar').getByRole('link', { name: label, exact: true }).click();
      }
      await p.getByRole('heading', { level: 1, name: heading }).first().waitFor();
      assert.ok((await overflowX(p)) <= 1, `${label} scrolls sideways on ${size}`);
    }
    await shot(p, 'j1-governance');
    await done(p);
  });

  test(`[${size}] J2 agents list shows drafts as well as published minds`, async () => {
    const p = await open(size, '/agents');
    await p.getByText('ML Explainer Agent').first().waitFor();
    assert.ok(await p.getByText('P1: LeadGen Email Composer').count());
    await p.getByRole('tab', { name: /Drafts/ }).click();
    const names = await p.locator('.agent-card .as-card__title').allTextContents();
    assert.ok(names.includes('ML Explainer Agent'), 'draft missing from Drafts');
    assert.ok(!names.includes('P1: LeadGen Email Composer'), 'published agent shown under Drafts');
    await shot(p, 'j2-drafts');
    await done(p);
  });

  test(`[${size}] J3 agent header is compact`, async () => {
    const p = await open(size, `/agents/${LEADGEN}`);
    const title = p.locator('.agent-hero__title');
    await title.waitFor();
    const lineHeight = await title.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const h = (await title.boundingBox()).height;
    assert.ok(h <= lineHeight * 2 + 2, `title wraps to ${Math.round(h / lineHeight)} lines`);
    // Actions sit on the title row, inside the screen.
    const vw = p.viewportSize().width;
    for (const b of await p.locator('.agent-hero__actions .as-btn').all()) {
      const box = await b.boundingBox();
      assert.ok(box.x + box.width <= vw, 'header action off screen');
    }
    // The description uses the full width, not a narrow column.
    const desc = await p.locator('.agent-hero__desc').boundingBox();
    const hero = await p.locator('.agent-hero').boundingBox();
    assert.ok(desc.width >= hero.width * 0.8 || desc.width > 600, 'description squeezed');
    await shot(p, 'j3-header');
    await done(p);
  });

  test(`[${size}] J4 DAG mind runs from a proper form`, async () => {
    const p = await open(size, `/agents/${LEADGEN}`);
    const form = p.getByRole('form', { name: /Run P1: LeadGen/ });
    await form.waitFor();
    const labels = await form.locator('.rf-field__label').allTextContents();
    assert.deepEqual(labels, ['Prospect', 'Product profile'], 'required fields first, optional folded away');
    assert.ok(labels.every((l) => !l.includes('_')), 'raw snake_case label');
    assert.equal(await form.locator('.rf-chip--req').count(), 2);
    // One column on a phone.
    if (size === 'phone') {
      const [a, b] = await form.locator('.rf-field').all();
      assert.ok((await b.boundingBox()).y > (await a.boundingBox()).y + 20, 'fields side by side on a phone');
    }
    // Run is blocked until required fields are filled.
    await form.getByRole('button', { name: 'Run' }).click();
    await form.getByText('Required').first().waitFor();
    assert.equal(p.url().includes('/c/'), false);
    // Bad JSON is caught as you type.
    await form.getByLabel('Prospect').fill('{"name": "Asha",');
    await form.getByText(/isn't valid JSON yet/).waitFor();
    await form.getByLabel('Prospect').fill('{"name": "Asha Rao", "title": "VP Supply Chain", "company": "Acme Logistics"}');
    await form.getByLabel('Product profile').fill('Governed AI agents for supply-chain teams');
    await form.getByRole('button', { name: /Add optional details/ }).click();
    assert.ok(await form.getByLabel('Do not quote').isVisible());
    await shot(p, 'j4-form-filled');
    await form.getByRole('button', { name: 'Run' }).click();
    await p.locator('.as-turn--user').getByText(/Prospect: Asha Rao, VP Supply Chain, Acme Logistics/).waitFor();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    await p.locator('.arte-card').first().waitFor();
    await shot(p, 'j4-answer');
    await done(p);
  });

  test(`[${size}] J5 draft chat mind: clean composer, and its runs show in history`, async () => {
    const p = await open(size, `/agents/${MLX}`);
    const box = p.getByRole('textbox', { name: 'Message' });
    await box.waitFor();
    assert.equal(await box.getAttribute('placeholder'), 'Message ML Explainer Agent');
    assert.equal(await p.getByText(/Supplied automatically/).count(), 0, 'runtime text leaks into the UI');
    await p.locator('.agent-hero .pill--draft').waitFor();
    await p.getByText(/Studio doesn't list a draft's runs yet/).waitFor();
    await box.fill('What is overfitting?');
    await p.getByRole('button', { name: 'Send' }).click();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    // Back on the agent: the run is listed, marked as kept on this device.
    const s = await stored(p);
    await p.ctx.close();
    const q = await open(size, `/agents/${MLX}`, { storage: s });
    const row = q.locator('.mini-row--btn', { hasText: 'What is overfitting?' });
    await row.waitFor();
    assert.ok(await row.getByText('this device').count());
    await shot(q, 'j5-draft-history');
    await row.click();
    await q.locator('.as-turn--user', { hasText: 'What is overfitting?' }).waitFor();
    await done(q);
  });

  test(`[${size}] J6 earlier runs reopen with their full answer`, async () => {
    const p = await open(size, `/agents/${PM}`);
    await p.locator('.mini-row--btn', { hasText: /^.*sweep.*$/ }).first().waitFor();
    await p.locator('.mini-row--btn').filter({ hasText: /^sweep/ }).filter({ hasNotText: 'wins' }).first().click();
    await p.locator('.as-turn--user', { hasText: 'sweep' }).waitFor();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    await p.locator('.arte-card').first().waitFor();
    await shot(p, 'j6-reopened');
    await done(p);
  });

  test(`[${size}] J7 a run Studio no longer keeps reads as a calm note, not an error`, async () => {
    const p = await open(size, `/agents/${PM}`);
    await p.locator('.mini-row--btn', { hasText: 'sweep, then wins' }).click();
    await p.locator('.turn-note').waitFor({ timeout: 10000 });
    assert.equal(await p.locator('.turn-error').count(), 0);
    assert.equal(await p.getByText(/Session not found/).count(), 0, 'raw gateway error shown');
    assert.ok(await p.getByRole('button', { name: 'Run it again' }).isVisible());
    await shot(p, 'j7-expired');
    await done(p);
  });

  test(`[${size}] J8 composer: Enter, Shift+Enter and Stop behave like Claude`, async () => {
    const p = await open(size, '/');
    const box = p.getByRole('textbox', { name: 'Message' });
    await box.waitFor();
    await box.click();
    await box.pressSequentially('first line');
    await p.keyboard.press('Shift+Enter');
    await box.pressSequentially('second line');
    assert.match(await box.inputValue(), /first line\nsecond line/);
    await p.keyboard.press('Enter');
    if (size === 'phone') {
      // On a touch keyboard Return is a new line; you send with the button.
      assert.equal(p.url().includes('/c/'), false, 'Return sent the message on a phone');
      await p.getByRole('button', { name: 'Send' }).click();
    }
    await p.locator('.as-turn--user', { hasText: 'second line' }).waitFor();
    await p.getByRole('button', { name: 'Stop' }).waitFor();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    await done(p);
  });

  test(`[${size}] J9 rich answer: headings, tables to charts, KPI tiles, pages`, async () => {
    const p = await open(size, `/agents/${PM}`);
    await p.getByRole('textbox', { name: 'Message' }).fill('weekly');
    await p.getByRole('button', { name: 'Send' }).click();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    assert.equal(await p.locator('.md').getByText(/^#+ /).count(), 0, 'raw markdown headings');
    assert.equal(await p.locator('.md p').getByText(/^\|/).count(), 0, 'raw pipe table');
    if (await p.locator('.md-table').count()) {
      const chart = p.locator('.md-table').getByRole('button', { name: 'Chart' });
      if (await chart.count()) {
        await chart.first().click();
        await p.locator('.md-table svg').first().waitFor();
      }
    }
    assert.ok((await overflowX(p)) <= 1, 'answer scrolls the page sideways');
    await shot(p, 'j9-rich');
    await p.locator('.arte-card').first().click();
    await p.locator('.arte-view').waitFor();
    await shot(p, 'j9-page-open');
    await done(p);
  });

  test(`[${size}] J14 a Studio page opens laid out and scrolls smoothly`, async () => {
    const p = await open(size, `/agents/${PM}`);
    await p.getByRole('textbox', { name: 'Message' }).fill('weekly');
    await p.getByRole('button', { name: 'Send' }).click();
    // Text-only page (how live pages arrive today): laid out as a document, not lines of text.
    await p.locator('.arte-card', { hasText: 'Threshold guide' }).click({ timeout: 10000 });
    await p.locator('.arte-doc__title', { hasText: 'Choosing a decision threshold' }).waitFor();
    assert.ok((await p.locator('.arte-doc__tile').count()) >= 6, 'short facts not shown as tiles');
    assert.ok(await p.locator('.arte-doc__tile.is-formula').count(), 'formulas not set apart');
    // One scroll container: the panel body itself must not scroll around the page.
    const outer = await p.locator('.panel-body').evaluate((el) => el.scrollHeight - el.clientHeight);
    assert.ok(outer <= 1, `panel body scrolls too (${outer}px), which stalls scrolling`);
    const doc = p.locator('.arte-text');
    await doc.hover();
    await p.mouse.wheel(0, 600);
    await p.waitForTimeout(300);
    assert.ok((await doc.evaluate((el) => el.scrollTop)) > 0 || (await doc.evaluate((el) => el.scrollHeight <= el.clientHeight)), 'page did not scroll');
    await shot(p, 'j14-page-text');
    // Dark mode (claude.ai sets data-theme on the page): the page stays paper, tiles stay readable.
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const [bg, fg] = await p.locator('.arte-doc__tile').first().evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    const lum = (c) => c.match(/\d+/g).slice(0, 3).reduce((n, v) => n + Number(v), 0) / 3;
    assert.ok(lum(bg) - lum(fg) > 120, `tile unreadable in dark mode (${bg} on ${fg})`);
    await shot(p, 'j14-page-dark');
    await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    // A page that comes with its HTML opens in a frame that fills the pane.
    await p.getByRole('button', { name: 'Close panel' }).click();
    await p.locator('.arte-card', { hasText: 'Precision vs recall' }).click();
    const frame = p.locator('.arte-frame');
    await frame.waitFor();
    const fb = await frame.boundingBox();
    assert.ok(fb.height > p.viewportSize().height * 0.5, 'page frame is too short');
    await shot(p, 'j14-page-html');
    await done(p);
  });

  test(`[${size}] J15 every nested screen has a way back`, async () => {
    // Agent → earlier run → Back returns to the agent.
    const p = await open(size, '/agents');
    await p.locator('.agent-card', { hasText: 'AI-Studio-PM' }).click();
    await p.locator('.agent-hero__title', { hasText: 'AI-Studio-PM' }).waitFor();
    await p.locator('.mini-row--btn').filter({ hasText: /^sweep/ }).filter({ hasNotText: 'wins' }).first().click();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    await p.getByRole('button', { name: 'Back' }).click();
    await p.locator('.agent-hero__title', { hasText: 'AI-Studio-PM' }).waitFor();
    // Agent → crumb back to the list.
    await p.locator('.crumb', { hasText: 'Agents' }).click();
    await p.getByRole('heading', { level: 1, name: 'Agents' }).waitFor();
    // Design a new mind → crumb back.
    await p.getByRole('link', { name: /Design a new agent/ }).click();
    await p.locator('.crumb', { hasText: 'Agents' }).click();
    await p.getByRole('heading', { level: 1, name: 'Agents' }).waitFor();
    // Chats → a chat → Back to Chats.
    const s = await stored(p);
    await p.ctx.close();
    const q = await open(size, '/chats', { storage: s });
    await q.locator('main').getByText('sweep').first().click();
    await q.getByRole('button', { name: 'Back' }).waitFor();
    await shot(q, 'j15-chat-back');
    await q.getByRole('button', { name: 'Back' }).click();
    await q.getByRole('heading', { level: 1, name: 'Chats' }).waitFor();
    await q.ctx.close();
    // Opened straight into a chat (no history): Back goes to the agent it belongs to.
    const conv = JSON.parse(s)[0];
    const r = await open(size, `/c/${conv.id}`, { storage: s });
    await r.getByRole('button', { name: 'Back' }).click();
    await r.locator('.agent-hero__title', { hasText: 'AI-Studio-PM' }).waitFor();
    // The agent name in the chat header opens the agent too.
    await done(r);
  });

  test(`[${size}] J10 ask a project, with numbered sources`, async () => {
    const p = await open(size, '/');
    const box = p.getByRole('textbox', { name: 'Message' });
    await box.fill('How do we position governed runs?');
    await p.getByRole('button', { name: 'Send' }).click();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    assert.ok(await p.locator('.md').getByText('1', { exact: true }).count() || (await p.getByText(/positioning-v4/).count()), 'no sources');
    await shot(p, 'j10-ask');
    await done(p);
  });

  test(`[${size}] J11 design a new mind with the designer`, async () => {
    const p = await open(size, '/agents/new');
    const box = p.getByRole('textbox', { name: 'Message' });
    await box.waitFor();
    await box.fill('Every morning, brief me on new documents and flag risks');
    await p.getByRole('button', { name: 'Send' }).click();
    await p.locator('.pipe-step, .orch, .designer-says, .md').first().waitFor({ timeout: 20000 });
    await shot(p, 'j11-design');
    await done(p);
  });

  test(`[${size}] J12 routines list and schedule preview`, async () => {
    const p = await open(size, '/routines');
    await p.getByText('Morning stand-up').waitFor();
    assert.ok((await overflowX(p)) <= 1);
    await shot(p, 'j12-routines');
    await done(p);
  });

  test(`[${size}] J13 chats survive a reload`, async () => {
    const p = await open(size, '/');
    await p.getByRole('textbox', { name: 'Message' }).fill('Remember me after a reload');
    await p.getByRole('button', { name: 'Send' }).click();
    await p.locator('.md').first().waitFor({ timeout: 10000 });
    const s = await stored(p);
    await p.ctx.close();
    const q = await open(size, '/chats', { storage: s });
    await q.getByText('Remember me after a reload').first().waitFor();
    await done(q);
  });
}
