const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  await p.goto('http://127.0.0.1:8899/index.html');
  await p.waitForTimeout(900);
  await p.evaluate(()=>{
    const t='C G Am F\nあいうえお';
    const s=parseSheet(t);
    Object.assign(s,{id:'x1',title:'テスト',text:t,bpm:100,folder:'オリジナル'});
    songs=[s]; playlists=[]; openSong=null; tab='list'; render();
  });
  await p.waitForTimeout(300);
  console.log('ヘッダー:', (await p.locator('#hdrInner').innerText()).replace(/\n/g,' | '));
  await p.locator('#hdrInner button', {hasText:'設定'}).click();
  await p.waitForTimeout(1500);
  console.log('storageBox count', await p.locator('#storageBox').count());
  console.log('----\n'+(await p.locator('#view').innerText().catch(()=>'(none)')).slice(0,1200));
  // 整理ダイアログ
  await p.evaluate(()=>{ driveState='on'; openTidy(); });
  await p.waitForTimeout(300);
  console.log('==== tidy ====\n'+(await p.locator('#popGrid').innerText()).slice(0,900));
  console.log('errs', errs.slice(0,6));
  await b.close();
})();
