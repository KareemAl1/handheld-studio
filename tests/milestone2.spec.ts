import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function settle(page: Page) {
  await expect(async () => {
    const a = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
    await page.waitForTimeout(200);
    const b = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
    expect(b.frames).toBe(a.frames);
    expect(b.camera).toEqual(a.camera);
  }).toPass({ timeout: 12000 });
}
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await settle(page);
}

test('camera: wheel and accessible controls clamp zoom, Fit retains angle, reset restores both', async ({ page }) => {
  await open(page);
  const initial = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const scroll = await page.evaluate(() => scrollY);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -500);
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(0.56);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  for (let i = 0; i < 10; i++) await page.getByRole('button', {name:'Zoom out', exact:true}).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(1.5);
  await page.getByRole('button', {name:'Back', exact:true}).click();
  await page.getByRole('button', {name:'Zoom in', exact:true}).click();
  await settle(page);
  await page.getByRole('button', {name:'Fit', exact:true}).click();
  await settle(page);
  const fitted = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
  expect(fitted.zoom.zoom).toBe(1);
  expect(fitted.camera[2]).toBeLessThan(0);
  await page.getByRole('button', {name:'Reset build'}).click();
  await settle(page);
  const reset = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
  expect(reset.zoom.zoom).toBe(1);
  reset.camera.forEach((v,i) => expect(v).toBeCloseTo(initial[i],3));
  await page.mouse.move(4, 300);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
});

test('camera: two-finger pinch zooms and releases cleanly back to rotation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch uses the mobile context.');
  await open(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  for (let d=35;d<=95;d+=5) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:x-d,y,id:1},{x:x+d,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(0.56);
  const before = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y,id:3}]});
  for(let d=5;d<=60;d+=5) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x+d,y,id:3}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await settle(page);
  expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera)).not.toEqual(before);
});

test('camera: stage one screenshots and reduced-motion keyboard zoom', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await open(page);
  await mkdir('docs/screenshots/milestone-2', {recursive:true});
  await page.screenshot({path:`docs/screenshots/milestone-2/camera-${info.project.name}.png`,fullPage:true});
  const zoom = page.getByRole('button',{name:'Zoom in',exact:true});
  await zoom.focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(0.82);
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(1);
});
