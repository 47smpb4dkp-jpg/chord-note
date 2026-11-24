const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    const t='C       G       Am      F\nあさのひかりのなかで\n\nF       G       C\nきみがわらう';
    const mk=(id,ti)=>{const s=parseSheet(t);return Object.assign(s,{id,title:ti,artist:'長渕剛',text:t,bpm:100,key:'C',capo:0,folder:'フォーク',transpose:0});};
    songs=[mk('a','朝'),mk('b','夜')]; playlists=[]; tab='list'; openSong=null; render(); openSongView('a','list');
  });
  await p.waitForTimeout(400);
  const st = async()=> p.evaluate(()=>{
    const sh=document.querySelector('#sheet');
    return {size:getComputedStyle(sh).fontSize, ctr:sh.classList.contains('ctr'),
      align:(sheetAlignOf(songs.find(x=>x.id===openSong))==='center'?'中央ぞろえ':'左ぞろえ'),
      sizeBtn:(sheetSizeIsAuto(songs.find(x=>x.id===openSong))?'ふつう':String(sheetSizeOf(songs.find(x=>x.id===openSong))))};
  });
  console.log('はじめ  ', JSON.stringify(await st()));
  await p.screenshot({path:'look1.png', clip:{x:0,y:0,width:900,height:460}});
  await p.evaluate(()=>{ openSongMenu(); menuAlign(); closePop(); }); await p.waitForTimeout(250);
  console.log('ぞろえ後', JSON.stringify(await st()));
  await p.evaluate(()=>openSongMenu()); await p.waitForTimeout(250);
  console.log('メニュー出た?', await p.locator('.mrow .mbig').first().isVisible());
  await p.screenshot({path:'look2.png', clip:{x:0,y:0,width:900,height:460}});
  for(let i=0;i<4;i++){ await p.locator('.mbig', {hasText:'＋'}).click(); await p.waitForTimeout(120); }
  await p.evaluate(()=>closePop());
  console.log('＋4回後 ', JSON.stringify(await st()));
  // 別の曲へ → 端末の設定を引き継ぐか
  await p.evaluate(()=>{ go('list'); openSongView('b','list'); }); await p.waitForTimeout(400);
  console.log('別の曲  ', JSON.stringify(await st()));
  // 自動に戻す
  await p.evaluate(()=>openSongMenu()); await p.waitForTimeout(250);
  await p.locator('.mrow .mini', {hasText:'自動'}).click(); await p.waitForTimeout(250);
  await p.evaluate(()=>closePop());
  console.log('自動後  ', JSON.stringify(await st()));
  // 保存されているか
  console.log('保存:', await p.evaluate(()=>JSON.stringify({
    a:{sz:songs[0].sheetSize,al:songs[0].sheetAlign}, b:{sz:songs[1].sheetSize,al:songs[1].sheetAlign},
    dev:{sz:localStorage.getItem('sheetSize'),al:localStorage.getItem('sheetAlign')}})));
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
