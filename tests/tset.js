const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  await p.evaluate(()=>{
    const mk=(id,t,g)=>{const s=parseSheet('C G Am F\nあ');
      return Object.assign(s,{id,title:t,text:'C G Am F\nあ',bpm:100,key:'C',capo:0,folder:g,transpose:0,v:2,sv:2});};
    songs=[mk('a','朝','フォーク'),mk('b','夜','ブルース')];
    playlists=[]; tab='list'; openSong=null; settingsOpen=false; render();
  });
  await p.waitForTimeout(400);
  console.log('ヘッダー:', (await p.locator('#hdrInner').innerText()).replace(/\n/g,' | '));
  console.log('一覧の下に残っていないか:', (await p.locator('#view').innerText()).includes('端末の空き容量を見る') ? '残っている' : 'なし',
    '/ すべての曲を消す:', (await p.locator('#view').innerText()).includes('すべての曲を消す') ? '残っている' : 'なし');
  await p.locator('#hdrInner button', {hasText:'設定'}).click(); await p.waitForTimeout(1300);
  console.log('--- 設定画面 ---\n' + (await p.locator('#view').innerText()).slice(0,1100));
  await p.screenshot({path:'set1.png', fullPage:true});
  // 整理ダイアログが開くか
  await p.locator('.mnb', {hasText:'整理し直す'}).click(); await p.waitForTimeout(400);
  console.log('整理:', await p.locator('#popName').innerText());
  await p.evaluate(()=>closePop()); await p.waitForTimeout(200);
  // スイッチ
  await p.locator('#view .swbtn').click(); await p.waitForTimeout(500);
  console.log('スイッチ:', (await p.locator('#view .swbtn').innerText()).trim(),
    '/ 保存:', await p.evaluate(()=>localStorage.getItem('keepAwake')),
    '/ 設定画面のまま:', await p.evaluate(()=>settingsOpen));
  // 閉じる
  await p.locator('#view .mini', {hasText:'閉じる'}).click(); await p.waitForTimeout(400);
  console.log('閉じたあと一覧:', (await p.locator('#view').innerText()).slice(0,60).replace(/\n/g,' '));
  // 容量エラーからの導線
  await p.evaluate(()=>openStorage()); await p.waitForTimeout(1200);
  console.log('openStorage:', await p.evaluate(()=>settingsOpen), '/ 容量欄:', (await p.locator('#storageBox').innerText()).slice(0,80).replace(/\n/g,' '));
  // タブを移ると閉じる
  await p.evaluate(()=>go('pl')); await p.waitForTimeout(300);
  console.log('タブ移動で閉じる:', await p.evaluate(()=>settingsOpen));
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
