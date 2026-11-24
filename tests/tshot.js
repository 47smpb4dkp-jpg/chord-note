const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ songs=[]; playlists=[]; go('new'); });
  await p.waitForTimeout(400);
  console.log('新規登録の見出し:', (await p.locator('#view h2').allInnerTexts()).join(' / '));
  // 偽の写真を2枚入れる
  await p.evaluate(()=>{
    const mk=(txt)=>{const c=document.createElement('canvas');c.width=600;c.height=200;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,600,200);
      x.fillStyle='#000';x.font='28px monospace';x.fillText(txt,20,60);
      return new Promise(r=>c.toBlob(bl=>r(new File([bl],txt+'.png',{type:'image/png'})),'image/png'));};
    return Promise.all([mk('C  G  Am  F'),mk('page2')]).then(fs=>takeShots(fs));
  });
  await p.waitForTimeout(500);
  console.log('ページ数:', await p.locator('.shot').count(), '/ 番号:', (await p.locator('.shot .pno').allInnerTexts()).join(','));
  await p.screenshot({path:'shot1.png', fullPage:false, clip:{x:0,y:0,width:980,height:900}});
  // 並べ替え
  await p.locator('.shot').nth(0).locator('.mini', {hasText:'→'}).click(); await p.waitForTimeout(300);
  console.log('入れ替え後の名前順:', await p.evaluate(()=>shots.map(s=>s.name).join(',')));
  // 1枚外す
  await p.locator('.shot').nth(0).locator('.mini', {hasText:'×'}).click(); await p.waitForTimeout(300);
  console.log('外したあと:', await p.locator('.shot').count(), await p.evaluate(()=>shots.map(s=>s.name).join(',')));
  // 設定の鍵欄
  await p.evaluate(()=>{ go('list'); toggleSettings(); }); await p.waitForTimeout(900);
  console.log('鍵の欄:', await p.locator('#vkey').count());
  await p.locator('#vkey').fill('TESTKEY123');
  await p.locator('.mrow .act', {hasText:'入れる'}).click(); await p.waitForTimeout(600);
  console.log('保存:', await p.evaluate(()=>localStorage.getItem('visionKey')), '/ visionKey():', await p.evaluate(()=>visionKey()));
  await p.screenshot({path:'set2.png', clip:{x:0,y:0,width:980,height:560}});
  // 新規登録の文言が切り替わるか
  await p.evaluate(()=>go('new')); await p.waitForTimeout(400);
  console.log('文言:', (await p.locator('#view .sub').allInnerTexts()).find(t=>t.includes('手書き')));
  // 鍵を消す
  await p.evaluate(()=>{ go('list'); toggleSettings(); }); await p.waitForTimeout(800);
  await p.locator('.mrow .ghost', {hasText:'消す'}).click(); await p.waitForTimeout(500);
  console.log('消したあと:', await p.evaluate(()=>localStorage.getItem('visionKey')));
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
