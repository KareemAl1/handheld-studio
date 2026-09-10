import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

async function settle(page: Page) {
  await expect(async () => {
    const before = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().frames);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().frames)).toBe(before);
  }).toPass({timeout:12000});
}

test('Fit interrupts a camera preset and clears component focus', async ({page}) => {
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready','true');
  await settle(page);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.waitForTimeout(80);
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  const direction = await page.evaluate(() => { const p=window.__HS_STUDIO__!.snapshot().camera; return p.map(v=>v/Math.hypot(...p)); });
  await settle(page);
  const after = await page.evaluate(() => { const p=window.__HS_STUDIO__!.snapshot().camera; return p.map(v=>v/Math.hypot(...p)); });
  after.forEach((value,index)=>expect(value).toBeCloseTo(direction[index],4));
  expect(after[2]).toBeGreaterThan(-.99);
  await expect(page.getByRole('button',{name:'Back',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Display',exact:true}).click();
  await settle(page);
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await settle(page);
  await expect(page.getByRole('button',{name:'Display',exact:true})).toHaveAttribute('aria-pressed','false');
  const state = await page.evaluate(()=>window.__HS_STUDIO__!.snapshot());
  expect(state.zoom.target).toEqual([0,0,0]); expect(state.zoom.zoom).toBe(1);
});

test('WebGL context restoration redraws the same assembly, materials, light and shadow', async ({page}) => {
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready','true');
  await page.getByRole('radio',{name:'Graphite',exact:true}).check();
  await page.getByRole('radio',{name:'Translucent',exact:true}).check();
  await page.getByRole('button',{name:'Explode',exact:true}).click();
  await settle(page);
  const before = await page.evaluate(()=>window.__HS_STUDIO__!.snapshot());
  const reference=PNG.sync.read(await page.locator('canvas').screenshot());
  for(let cycle=0;cycle<2;cycle++) {
    await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
      const canvas=document.querySelector('canvas')!;
      const extension=canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
      if(!extension) { reject(new Error('Context loss extension unavailable')); return; }
      canvas.addEventListener('webglcontextlost',()=>setTimeout(()=>extension.restoreContext(),150),{once:true});
      canvas.addEventListener('webglcontextrestored',()=>resolve(),{once:true});
      extension.loseContext();
    }));
    await expect.poll(()=>page.evaluate(()=>window.__HS_STUDIO__!.snapshot().frames)).toBeGreaterThan(before.frames);
    await settle(page);
    const restored=await page.evaluate(()=>window.__HS_STUDIO__!.snapshot());
    expect(restored.camera).toEqual(before.camera);
    expect(restored.materials).toEqual(before.materials);
    expect(restored.assembly).toEqual(before.assembly);
    const actual=PNG.sync.read(await page.locator('canvas').screenshot());
    expect([actual.width,actual.height]).toEqual([reference.width,reference.height]);
    let changed=0;
    for(let i=0;i<actual.data.length;i+=4) {
      if([0,1,2].some(c=>Math.abs(actual.data[i+c]-reference.data[i+c])>18)) changed++;
    }
    expect(changed/(actual.width*actual.height)).toBeLessThan(.012);
  }
  await page.getByRole('button',{name:'Reset build'}).click(); await settle(page);
  expect((await page.evaluate(()=>window.__HS_STUDIO__!.snapshot().assembly)).progress).toBe(0);
  expect(errors).toEqual([]);
});
