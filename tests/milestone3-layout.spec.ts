import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('layout: starting play keeps the complete screen and movement buttons in view',async({page,isMobile})=>{
  test.skip(isMobile,'The viewport matrix includes touch-sized screens and runs once.');
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const viewport of [{width:722,height:894},{width:900,height:600},{width:412,height:839}]) {
    await page.setViewportSize(viewport); await page.goto('/');
    await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready','true');
    await page.getByRole('button',{name:'Play Signal Run',exact:true}).click();
    const start = page.getByRole('button',{name:'Start game',exact:true});
    await expect(start).toBeEnabled();
    // A user can scroll to read the instructions before pressing Start.
    await start.evaluate(element=>element.scrollIntoView({block:'center'}));
    await start.click();
    await expect(async()=>{
      const bounds = await page.evaluate(()=>{
        const screen=document.querySelector('canvas')!.getBoundingClientRect();
        const controls=document.querySelector('.game-controls')!.getBoundingClientRect();
        return {screenTop:screen.top, screenBottom:screen.bottom, controlsBottom:controls.bottom,height:innerHeight};
      });
      expect(bounds.screenTop).toBeGreaterThanOrEqual(0);
      expect(bounds.screenBottom).toBeLessThanOrEqual(bounds.height);
      expect(bounds.controlsBottom).toBeLessThanOrEqual(bounds.height);
    }).toPass();
    await page.getByRole('button',{name:'Exit Play',exact:true}).click();
  }
});

test('layout: game and build actions reflow with enlarged text',async({page,isMobile})=>{
  test.skip(isMobile,'The viewport/text matrix runs once.');
  test.setTimeout(65000);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,768,1024,1440]) for(const font of [16,32]) {
    await page.setViewportSize({width,height:1000}); await page.goto('/');
    await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready','true');
    await page.evaluate(size=>document.documentElement.style.fontSize=`${size}px`,font);
    for(const play of [false,true]) {
      if(play) { await page.getByRole('button',{name:'Play Signal Run',exact:true}).click(); await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeEnabled(); }
      const problems=await page.evaluate(()=>{
        const issues:string[]=[];
        if(document.documentElement.scrollWidth>innerWidth+2) issues.push('page overflows horizontally');
        for(const element of document.querySelectorAll<HTMLElement>('.build-action-buttons button,.game-controls button,.exit-play,.play-launch button')) {
          if(!element.checkVisibility()) continue;
          const rect=element.getBoundingClientRect();
          if(rect.width<44 || rect.height<44) issues.push(`${element.textContent}: small target`);
          if(rect.left<0 || rect.right>innerWidth+2 || element.scrollWidth>element.clientWidth+2) issues.push(`${element.textContent}: clipped`);
        }
        return issues;
      });
      expect(problems,`${width}px / ${font}px font / play=${play}`).toEqual([]);
    }
  }
});

test('layout: capture final desktop and mobile build actions',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready','true');
  await page.getByRole('radio',{name:'Ember',exact:true}).check();
  await page.getByRole('radio',{name:'Ivory',exact:true}).check();
  await page.getByRole('radio',{name:'Translucent',exact:true}).check();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.waitForTimeout(350);
  await mkdir('docs/screenshots/milestone-3',{recursive:true});
  await page.screenshot({path:`docs/screenshots/milestone-3/final-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Reset build'}).click();
  await page.getByRole('button',{name:'Play Signal Run',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeEnabled();
  await page.screenshot({path:`docs/screenshots/milestone-3/play-${info.project.name}.png`,fullPage:true});
});
