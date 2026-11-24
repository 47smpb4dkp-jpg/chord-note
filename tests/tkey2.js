const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  const T='D       G       A       D\nあさのひかり\nBm      G       A       D\nきみがわらう';
  const open=async()=>{ await p.evaluate(t=>{
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'朝',artist:'長渕剛',text:t,bpm:100,key:'F',capo:3,
      folder:'フォーク',transpose:0,v:2,sv:2,capoBase:'play'});
    songs=[s]; playlists=[]; tab='list'; openSong=null; render(); editSong('a');
  }, T); await p.waitForTimeout(450); };
  const txt = async ()=> (await p.locator('#eText').inputValue()).split('\n')[0].trim();
  const st  = async ()=> p.evaluate(()=>JSON.stringify({key:curEdit().key,capo:curEdit().capo,base:capoBaseOf(curEdit()),acc:curEdit().acc||'-'}));

  await open();
  console.log('欄の並び:', (await p.locator('#view .field label').allInnerTexts()).map(x=>x.replace('?','').trim()).join(' → '));
  console.log('はじめ    :', await st(), '| 譜面:', await txt());
  console.log('まとめ文  :', (await p.locator('#keyNote').innerText()).replace(/\n/g,' '));

  // ① 原曲キーを変えても、譜面もカポも動かない
  await p.locator('#keyBtn').click(); await p.waitForTimeout(300);
  console.log('\n① キー選択画面の ♯ 一覧:', (await p.locator('#popGrid .kprow').first().innerText()).replace(/\n/g,' '));
  await p.locator('#popGrid .pk', {hasText:/^G$/}).first().click(); await p.waitForTimeout(400);
  console.log('   原曲キーGに:', await st(), '| 譜面:', await txt(), '（譜面とカポが不動ならOK）');

  // ② ♭表示に切り替える
  await p.locator('#keyBtn').click(); await p.waitForTimeout(300);
  await p.locator('#popGrid .pk.sub', {hasText:'♭ で表示'}).click(); await p.waitForTimeout(400);
  console.log('\n② ♭一覧:', (await p.locator('#popGrid .kprow').first().innerText()).replace(/\n/g,' '));
  await p.locator('#popGrid .pk', {hasText:'B♭'}).first().click(); await p.waitForTimeout(400);
  console.log('   原曲キーB♭に:', await st(), '| 譜面:', await txt());

  // ③ カポを変えると譜面が書き換わる
  await open();
  await p.locator('#capoBtn').click(); await p.waitForTimeout(300);
  console.log('\n③ カポ画面の説明:', await p.locator('#popDesc').innerText());
  await p.locator('#popGrid .pk', {hasText:/^5/}).first().click(); await p.waitForTimeout(450);
  console.log('   カポ5に:', await st(), '| 譜面:', await txt(), '（D→Bに下がればOK）');

  // ④ 「譜面の音」をワンタップで切り替え → 文字は動かない
  await open();
  const before = await p.locator('#eText').inputValue();
  await p.locator('#baseBtn').click(); await p.waitForTimeout(400);
  console.log('\n④ 譜面の音:', (await p.locator('#baseBtn').innerText()).replace(/\n/g,' / '),
    '| 文字は不動:', (await p.locator('#eText').inputValue())===before);
  await p.locator('#baseBtn').click(); await p.waitForTimeout(400);
  console.log('   戻した:', (await p.locator('#baseBtn').innerText()).replace(/\n/g,' / '), await st());

  // ⑤ 食い違いの表示と「合わせる」
  await open();
  await p.evaluate(()=>{ curEdit().key='A'; redrawKeyCard(); }); await p.waitForTimeout(400);
  console.log('\n⑤ 食い違い:', (await p.locator('#keyNote').innerText()).replace(/\n/g,' '));
  await p.locator('#keyNote .mini', {hasText:'合わせる'}).click(); await p.waitForTimeout(400);
  console.log('   画面の案内:', (await p.locator('#popGrid .sub').last().innerText()).replace(/\n/g,' '));
  await p.locator('#popGrid button', {hasText:'移調する'}).click(); await p.waitForTimeout(500);
  console.log('   合わせたあと:', await st(), '| 譜面:', await txt(), '（A-3=F#/G♭ になればOK）');
  console.log('   まとめ文:', (await p.locator('#keyNote').innerText()).replace(/\n/g,' '));
  await p.screenshot({path:'key2.png', clip:{x:0,y:0,width:1280,height:420}});
  console.log('\nerrs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
