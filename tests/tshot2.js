const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ songs=[]; playlists=[]; go('new'); });
  await p.waitForTimeout(400);
  // 読み取り部分だけ差し替えて、通しの流れを見る
  const res = await p.evaluate(async ()=>{
    window.readImageAuto = async (file, onP)=>{
      if (onP) onP(50, null);
      await new Promise(r=>setTimeout(r,120));
      if (onP) onP(100, null);
      return file.name === 'p1.png'
        ? 'とんぼ / 長渕剛\n\nC       G       Am      F\nあさのひかりのなかで'
        : 'F       G       C\nきみがわらう';
    };
    const mk=async(n)=>{const c=document.createElement('canvas');c.width=60;c.height=40;
      const bl=await new Promise(r=>c.toBlob(r,'image/png'));
      return new File([bl],n,{type:'image/png'});};
    takeShots([await mk('p1.png'), await mk('p2.png')]);
    await runShots();
    await new Promise(r=>setTimeout(r,400));
    return JSON.stringify({
      draftText: draft.text, title: draft.title, artist: draft.artist, key: draft.key,
      ta: (document.getElementById('draftText')||{}).value,
      shotsLeft: shots.length,
      prev: (document.getElementById('draftPrev')||{}).innerText
    });
  });
  const o = JSON.parse(res);
  console.log('draft.text:\n' + o.draftText);
  console.log('---');
  console.log('画面のコード譜欄と一致:', o.ta === o.draftText);
  console.log('曲名:', o.title, '/ アーティスト:', o.artist, '/ キー:', o.key);
  console.log('写真は片付いた:', o.shotsLeft === 0);
  console.log('表示の確認:\n' + (o.prev||'').slice(0,160));
  await p.screenshot({path:'shot2.png', clip:{x:0,y:0,width:980,height:1000}});
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
