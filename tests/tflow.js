const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html');
  await p.waitForTimeout(700);
  // --- 編集：保存まで ---
  await p.evaluate(()=>{
    const t='Dm/     G7/     C       Am\nきみのこえ';
    const s=parseSheet(t);
    Object.assign(s,{id:'x1',title:'テスト',artist:'A',text:t,bpm:100,key:'Dm',capo:0,folder:'オリジナル',transpose:0});
    songs=[s]; playlists=[]; openSong=null; tab='list'; render(); editSong('x1');
  });
  await p.waitForTimeout(400);
  await p.locator('#genreBtn').click(); await p.waitForTimeout(200);
  await p.locator('#popGrid .pk', {hasText:'ロック'}).first().click(); await p.waitForTimeout(200);
  await p.locator('#eTitle').fill('テスト改');
  // メモを入れる
  await p.locator('#eText').click();
  await p.locator('.pk.sub', {hasText:'間奏'}).first().click(); await p.waitForTimeout(200);
  // コードを入れる
  await p.locator('#palette .pk').first().click(); await p.waitForTimeout(150);
  await p.locator('button.act', {hasText:'上書き保存'}).click(); await p.waitForTimeout(400);
  console.log('saved:', await p.evaluate(()=>JSON.stringify({t:songs[0].title,f:songs[0].folder,acc:songs[0].acc,txt:songs[0].text.slice(0,60)})));
  // --- 新規登録 ---
  await p.evaluate(()=>{ go('new'); });
  await p.waitForTimeout(400);
  await p.locator('#draftText').fill('G  Am  Bm  C\nこいごころ');
  await p.waitForTimeout(400);
  await p.locator('#draftTitle').fill('新曲');
  await p.locator('#keyBtn').click(); await p.waitForTimeout(300);
  await p.locator('#popGrid .pk', {hasText:/^G$/}).first().click(); await p.waitForTimeout(250);
  await p.locator('#capoBtn').click(); await p.waitForTimeout(200);
  await p.locator('#popGrid .pk').nth(2).click(); await p.waitForTimeout(250);
  console.log('draft text after capo2:', await p.locator('#draftText').inputValue());
  await p.locator('#genreBtn').click(); await p.waitForTimeout(200);
  await p.locator('#popGrid #newGenre').fill('ニュー');
  await p.locator('#popGrid button.act', {hasText:'決める'}).click(); await p.waitForTimeout(200);
  await p.locator('#draftText').click();
  await p.locator('#memoBox').fill('ここから2回し');
  await p.locator('#memoBox').press('Enter'); await p.waitForTimeout(250);
  await p.locator('button.act', {hasText:'保存する'}).click(); await p.waitForTimeout(500);
  console.log('new song:', await p.evaluate(()=>JSON.stringify(songs.map(s=>({t:s.title,f:s.folder,k:s.key,c:s.capo,txt:s.text.replace(/\n/g,' | ')})))));
  console.log('errs', errs);
  await b.close();
})();
