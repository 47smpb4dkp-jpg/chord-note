const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:980,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  // あらゆる曲について、クラウドへ送る形に undefined が混ざらないか調べる
  const out = await p.evaluate(async ()=>{
    const bad = [];
    const check = (label, s)=>{
      const o = forCloud(s);
      for (const k in o) if (o[k] === undefined) bad.push(label + ' の ' + k);
      // ネストした値も見る
      const walk=(v,path)=>{ if (v && typeof v==='object'){ for(const k in v){
        if (v[k] === undefined) bad.push(label+' の '+path+k);
        else walk(v[k], path+k+'.'); } } };
      walk(o, '');
    };
    // 新規登録して保存
    go('new');
    draft.text = 'C  G  Am  F\nあさのひかり';
    draft.title = 'テスト';
    previewDraft();
    saveDraft();
    check('新規保存', songs[songs.length-1]);
    // ♯♭ を一周させる
    const s = songs[songs.length-1];
    openSong = s.id; editing = s.id;
    for (const v of ['sharp','flat','sharp']){ setKeySpell(v); check('♯♭ '+v, s); }
    toggleCapoBase(); check('譜面の音を切替', s);
    toggleCapoBase(); check('譜面の音を戻す', s);
    // 文字サイズ・ぞろえ・速さ
    s.sheetSize = null; check('文字サイズnull', s);
    autoSize && (openSong=s.id, autoSize()); check('自動に戻す', s);
    toggleAlign(); check('ぞろえ', s);
    setScrollPct(60); check('スクロール%', s);
    setBpm(130); check('BPM', s);
    // 動画の記録
    s.videos = [{id:'v1', name:'x.mp4', at:new Date().toISOString(), mb:12.3}];
    check('動画つき', s);
    // 全曲まとめて
    songs.forEach((x,i)=>check('曲'+i, x));
    return bad.length ? bad.join('\n') : 'undefined は見つかりませんでした';
  });
  console.log(out);
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
