const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ songs=[]; playlists=[]; go('new'); localStorage.setItem('visionKey','K'); });
  await p.waitForTimeout(300);
  // Vision の応答をまねる（コード行が歌詞の上にある譜面）
  const out = await p.evaluate(async ()=>{
    const W=(str,x,y,w,h)=>({symbols:str.split('').map(t=>({text:t})),
      boundingBox:{vertices:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]}});
    const page={blocks:[{paragraphs:[{words:[
      W('C',  40, 40, 22, 30), W('G', 150, 40, 22, 30), W('Am', 260, 40, 44, 30), W('F', 390, 40, 22, 30),
      W('あさの', 40, 90, 90, 30), W('ひかりの', 150, 90, 120, 30),
      W('F',  40,150, 22, 30), W('G', 150,150, 22, 30), W('C', 260,150, 22, 30),
      W('きみが', 40,200, 90, 30), W('わらう', 150,200, 90, 30)
    ]}]}]};
    const real = window.fetch;
    window.fetch = async (u,o)=>{
      if (String(u).indexOf('vision.googleapis.com') >= 0)
        return new Response(JSON.stringify({responses:[{fullTextAnnotation:{pages:[page]}}]}),{status:200});
      return real(u,o);
    };
    // 画像を1枚こしらえて読み取らせる
    const c=document.createElement('canvas'); c.width=600; c.height=300;
    const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,600,300);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const f=new File([blob],'p1.png',{type:'image/png'});
    const t=await readImageVision(f, ()=>{});
    return t;
  });
  console.log('--- Vision の結果 ---');
  console.log(out);
  console.log('--- 行の判定 ---');
  console.log(await p.evaluate(t=>t.split('\n').map(L=>L?lineKind(L)+' | '+L:'(空)').join('\n'), out));
  // エラーの扱い
  console.log('鍵エラー:', await p.evaluate(async ()=>{
    const real=window.fetch;
    window.fetch=async(u,o)=>String(u).indexOf('vision.googleapis')>=0
      ? new Response(JSON.stringify({error:{message:'API key not valid. Please pass a valid API key.'}}),{status:400})
      : real(u,o);
    const c=document.createElement('canvas');c.width=50;c.height=50;
    const bl=await new Promise(r=>c.toBlob(r,'image/png'));
    try{ await readImageVision(new File([bl],'x.png',{type:'image/png'}),()=>{}); return 'エラーにならなかった'; }
    catch(e){ return e.message; }
  }));
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
