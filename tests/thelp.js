const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    const t='C       G       Am      F\nあさのひかりのなかで';
    const mk=(id,ti)=>{const s=parseSheet(t);return Object.assign(s,{id,title:ti,artist:'長渕剛',text:t,bpm:100,key:'C',capo:0,folder:'フォーク',transpose:0});};
    songs=[mk('a','朝'),mk('b','夜')]; playlists=[{id:'p1',name:'ライブ',songs:['a']}];
    tab='list'; openSong=null; render(); openSongView('a','list');
  });
  await p.waitForTimeout(400);
  console.log('音源カード(閉):', await p.locator('#audioCard').count());
  await p.screenshot({path:'help1.png', clip:{x:0,y:0,width:980,height:330}});
  // ♪ を押す
  await p.evaluate(()=>{ openSongMenu(); }); await p.waitForTimeout(250);
  await p.locator('.mrow', {hasText:'音源'}).click(); await p.waitForTimeout(450);
  console.log('音源カード(開):', await p.locator('#audioCard').count());
  // 他のボタンを押しても消えないか（カポを変える → render が走る）
  await p.evaluate(()=>{ setCapo(2); }); await p.waitForTimeout(400);
  console.log('カポ変更後も開いたまま:', await p.locator('#audioCard').count());
  // 曲を移っても開いたまま
  await p.evaluate(()=>songStep(1)); await p.waitForTimeout(400);
  console.log('次の曲でも開いたまま:', await p.locator('#audioCard').count());
  // ? を押す
  await p.locator('#audioCard .qb').click(); await p.waitForTimeout(300);
  console.log('説明:', await p.locator('#popName').innerText(), '/', (await p.locator('.helpbody').innerText()).slice(0,60).replace(/\n/g,' '));
  await p.screenshot({path:'help2.png', clip:{x:0,y:0,width:980,height:700}});
  await p.locator('#popbox button', {hasText:'閉じる'}).click(); await p.waitForTimeout(250);
  // 閉じる
  await p.locator('#audioCard .mini', {hasText:'閉じる'}).click(); await p.waitForTimeout(400);
  console.log('閉じた:', await p.locator('#audioCard').count());
  // 全部のヘルプが開くか
  const keys = await p.evaluate(()=>Object.keys(HELP));
  for (const k of keys){
    const r = await p.evaluate(k=>{ try{ openHelp(k); const n=document.getElementById('popName').textContent;
      closePop(); return n; }catch(e){ return 'ERR '+e.message; } }, k);
    console.log('  ', k, '→', r);
  }
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
