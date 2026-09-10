/* global window */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = 'docs/screenshots/milestone-2';
const url = process.env.STUDIO_PROFILE_URL ?? 'http://127.0.0.1:5173/';
const baseline = process.env.STUDIO_PROFILE_BASELINE === '1';
await mkdir(output, { recursive: true });
async function settle(page) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const a = await page.evaluate(() => window.__HS_STUDIO__.snapshot().frames);
    await page.waitForTimeout(240);
    if (a === await page.evaluate(() => window.__HS_STUDIO__.snapshot().frames)) return;
  }
  throw new Error('Viewer did not settle');
}
try {
  for (const [name, settings] of [['desktop', {viewport:{width:1440,height:1000}}], ['mobile', devices['Pixel 7']]]) {
    const context = await browser.newContext(settings);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.getByTestId('device-viewer').waitFor();
    await page.waitForFunction(() => window.__HS_STUDIO__?.snapshot().calls > 0);
    await settle(page);
    const report = { testedAt: new Date().toISOString(), url, browser: browser.version(), viewport: page.viewportSize(), modes: {}, note: 'Installed Chrome headless on this Windows host. Same scripted orbit and wait interval as the before benchmark. Frame intervals measure render cadence, not GPU execution time or guaranteed FPS. Mobile is viewport/touch emulation.' };
    for (const mode of baseline ? ['solid'] : ['solid','translucent','exploded']) {
      if (mode === 'translucent') await page.getByRole('radio',{name:'Translucent',exact:true}).check();
      if (mode === 'exploded') {
        await page.getByRole('radio',{name:'Solid',exact:true}).check();
        await page.getByRole('button',{name:'Explode',exact:true}).click();
      }
      await settle(page);
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.move(box.x + box.width*.45, box.y + box.height*.5);
      await page.mouse.down();
      await page.evaluate(() => window.__HS_STUDIO__.beginMeasure());
      for(let i=0;i<90;i++) {
        await page.mouse.move(box.x+box.width*.45+Math.sin(i/15)*90, box.y+box.height*.5+Math.cos(i/20)*20);
        await page.waitForTimeout(16);
      }
      const intervals = await page.evaluate(() => window.__HS_STUDIO__.endMeasure());
      await page.mouse.up(); await settle(page);
      const snapshot = await page.evaluate(() => window.__HS_STUDIO__.snapshot());
      await page.waitForTimeout(1000);
      const idle = (await page.evaluate(() => window.__HS_STUDIO__.snapshot().frames))-snapshot.frames;
      intervals.sort((a,b)=>a-b);
      report.modes[mode] = { ...snapshot, samples: intervals.length, medianMs: intervals[Math.floor(intervals.length*.5)], p95Ms: intervals[Math.floor(intervals.length*.95)], idleFramesOverOneSecond: idle };
      assert.equal(idle,0);
      console.log(JSON.stringify({context:name,mode,calls:snapshot.calls,triangles:snapshot.triangles,medianMs:report.modes[mode].medianMs,p95Ms:report.modes[mode].p95Ms,idle}));
    }
    assert.deepEqual(errors,[]);
    report.errors = errors;
    await writeFile(`${output}/${baseline ? 'baseline-recheck' : 'after'}-${name}.json`,JSON.stringify(report,null,2));
    await context.close();
  }
} finally { await browser.close(); }
