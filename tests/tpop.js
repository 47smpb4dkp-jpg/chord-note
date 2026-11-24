const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:900}});
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{ songs=[]; playlists=[]; go('new'); });
  await p.waitForTimeout(300);
  for (const [id,name] of [['genreBtn','ジャンル'],['keyBtn','キー'],['capoBtn','カポ']]){
    await p.locator('#'+id).click(); await p.waitForTimeout(250);
    const n = await p.locator('#popbox button', {hasText:'閉じる'}).count();
    console.log(name, '閉じるボタン数:', n, '/', await p.locator('#popName').innerText());
    await p.locator('#popbox button', {hasText:'閉じる'}).first().click(); await p.waitForTimeout(200);
  }
  await p.locator('#capoBtn').click(); await p.waitForTimeout(250);
  await p.screenshot({path:'pop1.png'});
  await b.close();
})();
