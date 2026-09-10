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
  await page.locator('canvas').hover();
  await page.keyboard.down('Control');
  // Windows display scaling can amplify the CDP wheel delta in headed Chrome.
  // A small gesture verifies interpolation without immediately reaching a limit.
  await page.mouse.wheel(0, -5);
  await page.keyboard.up('Control');
  await settle(page);
  const trackpad = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom.zoom);
  expect(trackpad).toBeGreaterThan(.56); expect(trackpad).toBeLessThan(1);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  const outsideScroll = await page.evaluate(() => scrollY);
  await page.mouse.move(4, 300);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(outsideScroll);
});

test('camera: two-finger pinch zooms and releases cleanly back to rotation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch uses the mobile context.');
  await open(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const direction = await page.evaluate(() => { const p = window.__HS_STUDIO__!.snapshot().camera; const length = Math.hypot(...p); return p.map(v => v / length); });
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  for (let d=35;d<=95;d+=5) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:x-d,y,id:1},{x:x+d,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(0.56);
  const afterPinch = await page.evaluate(() => { const p = window.__HS_STUDIO__!.snapshot().camera; const length = Math.hypot(...p); return p.map(v => v / length); });
  afterPinch.forEach((value,index) => expect(value).toBeCloseTo(direction[index],4));
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
  await page.screenshot({path:`docs/screenshots/milestone-2/camera-check-${info.project.name}.png`,fullPage:true});
  const zoom = page.getByRole('button',{name:'Zoom in',exact:true});
  await zoom.focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(0.82);
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(0.82);
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(1);
});

test('materials: every shell, button and finish combination settles and retains independence', async ({ page }, info) => {
  test.setTimeout(100_000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [shell, hex] of [['Chalk','dad5c8'],['Graphite','363d3b'],['Ember','cf532f']]) {
    await page.getByRole('radio',{name:shell,exact:true}).check();
    for (const [button, buttonHex] of [['Charcoal','333b37'],['Ivory','ddd6c5'],['Signal','cf532f']]) {
      await page.getByRole('radio',{name:button,exact:true}).check();
      for (const finish of ['Solid','Translucent']) {
        await page.getByRole('radio',{name:finish,exact:true}).check();
        await settle(page);
        const state = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
        if (finish === 'Solid') expect(state.materials.shell).toBe(hex);
        else expect(state.materials.shell).not.toBe(hex);
        expect(state.materials.buttons).toBe(buttonHex);
        expect(state.materials.transmission).toBe(finish === 'Solid' ? 0 : 0.76);
        await expect(page.getByRole('radio',{name:shell,exact:true})).toBeChecked();
        await expect(page.getByRole('radio',{name:button,exact:true})).toBeChecked();
        await page.getByRole('button',{name:'Explode',exact:true}).click();
        await settle(page);
        expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly)).progress).toBe(1);
        await page.getByRole('button',{name:'Assemble',exact:true}).click();
        await settle(page);
        expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly)).progress).toBe(0);
      }
    }
  }
  expect(errors).toEqual([]);
  await page.getByRole('radio',{name:'Ivory',exact:true}).check();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await settle(page);
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:`docs/screenshots/milestone-2/material-translucent-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Reset build'}).click();
  await settle(page);
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:`docs/screenshots/milestone-2/material-solid-${info.project.name}.png`,fullPage:true});
  const reset = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
  expect(reset.materials).toEqual({shell:'dad5c8',buttons:'333b37',transmission:0});
});

test('assembly: interrupted transitions and slider always return all five layers exactly', async ({page}, info) => {
  test.setTimeout(65000);
  await open(page);
  const initial = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly);
  expect(initial.layers).toHaveLength(5);
  for(let i=0;i<5;i++) {
    await page.getByRole('button',{name:'Explode',exact:true}).click();
    await page.waitForTimeout(95);
    await page.getByRole('button',{name:'Assemble',exact:true}).click();
    await page.waitForTimeout(65);
  }
  await settle(page);
  expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly)).toEqual(initial);
  const slider = page.getByRole('slider',{name:'Assembly',exact:true});
  await slider.focus();
  await page.keyboard.press('End');
  await settle(page);
  const exploded = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly);
  expect(exploded.progress).toBe(1);
  expect(exploded.layers.map(layer => layer.position[2])).toEqual([2.6,1.7,.6,-.65,-2.4]);
  exploded.layers.forEach(layer => expect(layer.position.slice(0,2)).toEqual([0,0]));
  await page.getByRole('button',{name:'Explode',exact:true}).click();
  await settle(page);
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:`docs/screenshots/milestone-2/exploded-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Concept board',exact:true}).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).target[2]).toBe(-.65);
  await expect(page.getByRole('button',{name:'Concept board',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Reset build'}).click();
  await settle(page);
  expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly)).toEqual(initial);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(1);
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:`docs/screenshots/milestone-2/final-${info.project.name}.png`,fullPage:true});
});

test('assembly: reduced motion and all component detail views remain operable', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page);
  for(const name of ['Front shell','Controls','Display','Concept board','Rear shell']) {
    await page.getByRole('button',{name,exact:true}).click();
    await settle(page);
    await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().zoom)).zoom).toBe(.74);
  }
  await page.getByRole('button',{name:'Assemble',exact:true}).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().assembly)).progress).toBe(0);
  await page.getByRole('button',{name:'Display',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Zoom out',exact:true})).toBeFocused();
});

test('materials: color changes interpolate after idle and then stop rendering', async ({page}) => {
  await open(page);
  const samples = page.evaluate(() => new Promise<string[]>(resolve => {
    const colors: string[] = [], start = performance.now();
    function frame() {
      colors.push(window.__HS_STUDIO__!.snapshot().materials.shell);
      if(performance.now()-start > 350) resolve(colors); else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  await page.getByRole('radio',{name:'Ember',exact:true}).check();
  expect(new Set(await samples).size).toBeGreaterThan(2);
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().materials)).shell).toBe('cf532f');
});
