const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    const t='C       G       Am      F\nあさのひかりのなかで\n\nF    G    C\nきみがわらう';
    const mk=(id,ti)=>{const s=parseSheet(t);return Object.assign(s,{id,title:ti,artist:'長渕剛',text:t,bpm:100,key:'C',capo:0,folder:'フォーク',transpose:0});};
    songs=[mk('a','朝'),mk('b','夜')]; playlists=[{id:'p1',name:'ライブ',songs:['a']}];
    tab='list'; openSong=null; render();
  });
  await p.waitForTimeout(300);
  console.log('一覧のスイッチ:', (await p.locator('.swbtn').innerText()).trim(), '/ 数:', await p.locator('.swbtn').count());
  await p.screenshot({path:'m0.png', clip:{x:0,y:0,width:980,height:120}});
  await p.locator('.swbtn').click(); await p.waitForTimeout(400);
  console.log('押したあと   :', (await p.locator('.swbtn').innerText()).trim(),
    '/ 保存:', await p.evaluate(()=>localStorage.getItem('keepAwake')));
  await p.evaluate(()=>openSongView('a','list')); await p.waitForTimeout(400);
  console.log('曲画面の帯:', (await p.locator('.meta').innerText()).replace(/\n/g,' | '));
  await p.screenshot({path:'m1.png', clip:{x:0,y:0,width:980,height:300}});
  // BPM を押す
  await p.locator('.chipbtn.tap', {hasText:'BPM'}).click(); await p.waitForTimeout(400);
  console.log('速度カード:', await p.locator('#speedCard').count(), (await p.locator('#speedCard').innerText()).replace(/\n/g,' '));
  await p.screenshot({path:'m2.png', clip:{x:0,y:0,width:980,height:330}});
  await p.locator('#speedCard .mini').click(); await p.waitForTimeout(350);
  console.log('閉じた:', await p.locator('#speedCard').count());
  // メニュー
  await p.locator('.meta button', {hasText:'メニュー'}).click(); await p.waitForTimeout(350);
  console.log('メニュー:\n' + await p.locator('#popGrid').innerText());
  await p.screenshot({path:'m3.png'});
  // 文字サイズ ＋
  await p.locator('.mbig', {hasText:'＋'}).click(); await p.waitForTimeout(300);
  await p.locator('.mbig', {hasText:'＋'}).click(); await p.waitForTimeout(300);
  console.log('サイズ:', await p.evaluate(()=>getComputedStyle(document.querySelector('#sheet')).fontSize), songsz=await p.evaluate(()=>songs[0].sheetSize));
  // ぞろえ
  await p.locator('.mrow', {hasText:'左ぞろえ'}).click(); await p.waitForTimeout(300);
  console.log('ぞろえ:', await p.evaluate(()=>document.querySelector('#sheet').classList.contains('ctr')),
    '/ 行:', (await p.locator('.mrow').first().innerText()).replace(/\n/g,' '));
  // 音源を開く
  await p.locator('.mrow', {hasText:'音源'}).click(); await p.waitForTimeout(450);
  console.log('音源カード:', await p.locator('#audioCard').count(), '/ pop閉じた:', await p.locator('#pop').getAttribute('hidden')!==null);
  await p.screenshot({path:'m4.png', clip:{x:0,y:0,width:980,height:430}});
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
