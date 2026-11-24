const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:800}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  const out = await p.evaluate(()=>{
    const mk=(id,t,txt,extra)=>{const s=parseSheet(txt);
      return Object.assign(s,{id,title:t,text:txt,bpm:100,folder:'A',transpose:0,v:2,sv:2},extra||{});};
    songs=[
      mk('a','カポ3の曲','D       G       A       D\nあさのひかり\nBm      G       A       D\nきみがわらう',{key:'F',capo:3}),
      mk('b','カポなし',  'C       G       Am      F\nあさのひかり',{key:'C',capo:0}),
      mk('c','♭表記',     'B♭      E♭      F       B♭\nあさのひかり',{key:'B♭',capo:0}),
      mk('d','ヘッダ付き','title: 夜\nkey: G\n\nG  C  D  G\nよるのうた',{key:'',capo:0})
    ];
    playlists=[];
    const rep=[];
    for (let round=1; round<=4; round++){
      tidyRekey = true;
      const plan = tidyPlan();
      rep.push(`【${round}周目】${plan.length} 曲\n` + plan.map(x=>
        '  ' + x.title + '\n' + x.why.map(w=>'    - '+w).join('\n')).join('\n'));
      if (!plan.length) break;
      const byId = new Map(plan.map(x=>[x.id, x.next]));
      songs = songs.map(s=>{ const n=byId.get(s.id); return n ? {...n, v:2} : s; });
    }
    return rep.join('\n') + '\n\n最後の状態: ' +
      JSON.stringify(songs.map(s=>({t:s.title,key:s.key,capo:s.capo})));
  });
  console.log(out);
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
