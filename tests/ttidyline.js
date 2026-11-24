const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:1050}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  const show=(t)=>t.split('\n').map(l=>'    |'+l+'|').join('\n');
  const out = await p.evaluate(()=>{
    const log=[];
    const T1 = 'C                                   G                    Am       F\nあさのひかりのなかで\nきみがわらう';
    log.push('① あきすぎを詰める\n  前:\n'+T1.split('\n').map(l=>'    |'+l+'|').join('\n')
      +'\n  後:\n'+squeezeGaps(T1).split('\n').map(l=>'    |'+l+'|').join('\n'));

    const T2 = 'CGAmF Dm Em\nあさのひかり';
    log.push('\n② 詰まりすぎをあける\n  前:\n    |'+T2.split('\n')[0]+'|\n  後:\n    |'+loosenGaps(T2).split('\n')[0]+'|');

    const T3 = 'ConG    D7onF#   F／   G/B    Am\nあさのひかりのなかできみが';
    log.push('\n③ 分数コードを / に\n  前:\n    |'+T3.split('\n')[0]+'|\n  後:\n    |'+slashStyle(T3,'slash').split('\n')[0]+'|');
    log.push('   分数コードを on に\n  後:\n    |'+slashStyle(T3,'on').split('\n')[0]+'|');
    log.push('   全角 ／ は触っていない: ' + (slashStyle(T3,'on').indexOf('F／')>=0 ||
             slashStyle(T3,'on').indexOf('F ／')>=0 || /／/.test(slashStyle(T3,'on'))));

    // 桁が動いていないか（コードの開始位置）
    const cols = t => { const r=[]; let i=0; t.replace(/\S+/g,(m,o)=>{r.push(dispWidth(t.slice(0,o)));return m;}); return r.join(','); };
    log.push('   桁（前）: ' + cols(T3.split('\n')[0]));
    log.push('   桁（後）: ' + cols(slashStyle(T3,'slash').split('\n')[0]));

    // 歌詞は触らない
    const T4 = 'C    G\nあさの       ひかり    のなかで';
    log.push('\n④ 歌詞の行は不変: ' + (squeezeGaps(T4).split('\n')[1] === T4.split('\n')[1]));
    log.push('   ' + JSON.stringify(squeezeGaps(T4).split('\n')[1]));
    return log.join('\n');
  });
  console.log(out);
  // ボタンが出ているか
  await p.evaluate(()=>{
    const t='ConG                                        G/B   Am\nあさのひかり';
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'朝',text:t,bpm:100,key:'C',capo:0,folder:'A',transpose:0,v:2,sv:2});
    songs=[s]; playlists=[]; tab='list'; openSong=null; render(); editSong('a');
  });
  await p.waitForTimeout(500);
  console.log('\nボタン:', (await p.locator('.card .picker.cp .pk.sub').allInnerTexts()).join(' / '));
  const line=async()=>(await p.locator('#eText').inputValue()).split('\n')[0];
  console.log('前      :', JSON.stringify(await line()));
  await p.locator('.pk.sub', {hasText:'あきすぎを詰める'}).click(); await p.waitForTimeout(400);
  console.log('詰めた後:', JSON.stringify(await line()));
  await p.locator('.pk.sub', {hasText:'on'}).last().click(); await p.waitForTimeout(400);
  console.log('on にした:', JSON.stringify(await line()));
  await p.screenshot({path:'tl1.png', clip:{x:0,y:330,width:1280,height:260}});
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
