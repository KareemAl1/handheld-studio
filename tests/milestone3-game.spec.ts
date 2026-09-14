import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function enter(page:Page) {
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready','true');
  await page.getByRole('button',{name:'Explode',exact:true}).click();
  await page.getByRole('button',{name:'Play Signal Run',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeEnabled();
  expect((await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().assembly)).progress).toBe(0);
  await expect(page.getByRole('button',{name:'Exit Play',exact:true})).toBeVisible();
}
async function idle(page:Page) {
  await expect(async()=>{
    const frames=await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().frames);
    await page.waitForTimeout(250);
    expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().frames)).toBe(frames);
  }).toPass({timeout:12000});
}

test('game: actual screen completes start, collection, game over, restart and exit',async({page},info)=>{
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await enter(page);
  await mkdir('docs/screenshots/milestone-3',{recursive:true});
  await page.screenshot({path:`docs/screenshots/milestone-3/game-ready-${info.project.name}.png`,fullPage:true});
  const camera=await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().camera);
  const box=(await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);
  await page.mouse.down(); await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6,{steps:8}); await page.mouse.up();
  await page.mouse.wheel(0,-100);
  await idle(page);
  expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().camera)).toEqual(camera);
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','running');
  const initialTexture=await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.textureVersion);
  await expect(page.getByTestId('game-score')).toHaveText('10');
  expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.textureVersion)).toBeGreaterThan(initialTexture);
  await page.screenshot({path:`docs/screenshots/milestone-3/game-running-${info.project.name}.png`,fullPage:true});
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','over');
  await expect(page.getByRole('button',{name:'Restart game',exact:true})).toBeEnabled();
  await idle(page);
  await page.getByRole('button',{name:'Restart game',exact:true}).click();
  await expect(page.getByTestId('game-score')).toHaveText('0');
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','running');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Play Signal Run',exact:true})).toBeFocused();
  await idle(page);
  expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('game: keyboard and touch lanes, pause/resume and reduced-motion framing',async({page,isMobile})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await enter(page);
  await page.getByRole('button',{name:'Start game',exact:true}).click();
  if(isMobile) await page.getByRole('button',{name:'Move left',exact:true}).tap();
  else await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.game-panel')).toHaveAttribute('data-lane','0');
  if(isMobile) { await page.getByRole('button',{name:'Move right',exact:true}).tap(); await page.getByRole('button',{name:'Move right',exact:true}).tap(); }
  else { await page.keyboard.press('d'); await page.keyboard.press('ArrowRight'); }
  await expect(page.locator('.game-panel')).toHaveAttribute('data-lane','2');
  await page.getByRole('button',{name:'Pause game',exact:true}).click();
  await idle(page);
  const paused=await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game);
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game)).toEqual(paused);
  await page.getByRole('button',{name:'Resume game',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed)).toBeGreaterThan(paused!.elapsed);
  // Remain in the right lane through the opening center hazard: this is a real dodge.
  await expect.poll(()=>page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed),{timeout:10000}).toBeGreaterThan(5.1);
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','running');
  await page.getByRole('button',{name:'Exit Play',exact:true}).click();
  await idle(page);
});

test('game: visibility loss pauses without background ticks or automatic resume',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await enter(page); await page.getByRole('button',{name:'Start game',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed)).toBeGreaterThan(.2);
  // Automated Chrome reports even background targets as visible on this host.
  // Simulate the browser visibility boundary, then exercise the actual listener.
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','paused');
  await idle(page);
  const before=await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed);
  await page.waitForTimeout(1100);
  expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed)).toBe(before);
  await page.evaluate(()=>{ Reflect.deleteProperty(document,'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase','paused');
  await page.getByRole('button',{name:'Resume game',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed)).toBeGreaterThan(before);
  expect(await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().game!.elapsed)).toBeLessThan(before+.5);
  await page.getByRole('button',{name:'Exit Play',exact:true}).click(); await idle(page);
});
