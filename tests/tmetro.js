const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage({viewport:{width:980,height:800}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    const lines=[]; for(let i=0;i<20;i++){ lines.push('C       G       Am      F'); lines.push('あさのひかりのなかできみがわらっている'); lines.push(''); }
    const t=lines.join('\n'); const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'朝',artist:'長渕剛',text:t,bpm:120,key:'C',capo:0,folder:'フォーク',transpose:0});
    songs=[s]; playlists=[]; tab='list'; openSong=null; render(); openSongView('a','list');
  });
  await p.waitForTimeout(400);
  console.log('帯:', (await p.locator('.meta').innerText()).replace(/\n/g,' | '));
  await p.locator('#bpmChip').click(); await p.waitForTimeout(400);
  console.log('速さカード:\n' + await p.locator('#speedCard').innerText());
  await p.screenshot({path:'sp1.png', clip:{x:0,y:0,width:980,height:380}});
  // 計算の筋が通っているか
  console.log('計算:', await p.evaluate(()=>{
    const s=songs[0];
    return JSON.stringify({rowH:+sheetRowH().toFixed(1), pct:scrollPctOf(s),
      秒per行:+secPerLineOf(s).toFixed(2), pxPerSec:+scrollPxPerSec(s).toFixed(2)});
  }));
  console.log('注記:', await p.locator('#speedNote').innerText());
  // % を変える
  await p.evaluate(()=>setScrollPct(50)); await p.waitForTimeout(300);
  console.log('50%:', await p.evaluate(()=>JSON.stringify({pct:songs[0].scrollPct, 秒:+secPerLineOf(songs[0]).toFixed(2), px:+scrollPxPerSec(songs[0]).toFixed(2)})),
    '/', await p.locator('#speedNote').innerText());
  // BPM を倍にしてもスクロールは変わらないこと
  const before = await p.evaluate(()=>+scrollPxPerSec(songs[0]).toFixed(2));
  await p.evaluate(()=>setBpm(240)); await p.waitForTimeout(300);
  const after = await p.evaluate(()=>+scrollPxPerSec(songs[0]).toFixed(2));
  console.log('BPM240 にしてもスクロールは不変:', before===after, before, after, '/ chip:', (await p.locator('#bpmChip').innerText()).replace(/\n/g,''));
  // メトロノーム
  await p.locator('#metroBtn').click(); await p.waitForTimeout(900);
  console.log('メトロ:', await p.evaluate(()=>JSON.stringify({on:metroOn, beat:metroBeat, state:metroCtx&&metroCtx.state})),
    '/ ボタン:', await p.locator('#metroBtn').innerText());
  await p.waitForTimeout(1000);
  const bA = await p.evaluate(()=>metroBeat);
  await p.waitForTimeout(1000);
  const bB = await p.evaluate(()=>metroBeat);
  console.log('1秒あたりの拍:', bB-bA, '（240BPM なら 4 前後）');
  await p.locator('#metroBtn').click(); await p.waitForTimeout(300);
  console.log('止めた:', await p.evaluate(()=>metroOn));
  // スクロールと同時
  await p.evaluate(()=>{ setBpm(120); setScrollPct(50); startMetro(); startScroll(); }); await p.waitForTimeout(2000);
  console.log('同時:', await p.evaluate(()=>JSON.stringify({scroll:scrolling, metro:metroOn, top:Math.round(document.getElementById('main').scrollTop)})));
  await p.evaluate(()=>{ stopScroll(); stopMetro(); });
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
