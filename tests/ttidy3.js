const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:800}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  const out = await p.evaluate(()=>{
    const SAMPLES = [
      ['md書き出しを読み戻した', '---\ntitle: とんぼ\nartist: 長渕剛\nkey: F\ncapo: 3\nbpm: 96\n---\n\nD       G       A       D\nあさのひかり\nBm      G       A       D\nきみがわらう', {}],
      ['情報欄つき・歌詞から始まる', '---\ntitle: 朝\nkey: C\n---\n\nあさのひかりのなかで\nC    G    Am   F\nきみがわらう', {}],
      ['セクションから始まる', '---\ntitle: 夜\nkey: G\n---\n\n［イントロ］\nG  C  D  G\nよる', {}],
      ['ヘッダなし・カポあり', 'D       G       A       D\nあさのひかり', {key:'F',capo:3}],
      ['全角コード', 'Ｃ　　　Ｇ　　　Ａｍ　　Ｆ\nあさのひかり', {key:'C',capo:0}],
      ['セクション付き', '［Ａメロ］\nC    G    Am   F\nあさのひかり\n\n［サビ］\nF    G    C\nきみがわらう', {key:'C',capo:0}],
      ['空行たくさん', 'C  G  Am  F\n\n\nあさのひかり\n\n', {key:'C',capo:0}],
      ['末尾に空白', 'C  G  Am  F   \nあさのひかり  ', {key:'C',capo:0}],
      ['キーなし', 'G  C  D  G\nよるのうた', {key:'',capo:0}],
      ['マイナー', 'Am   Dm   E7   Am\nかなしいうた', {key:'Am',capo:0}],
      ['♭のキー', 'B♭  E♭  F  B♭\nあさのひかり', {key:'B♭',capo:0}],
      ['カポとマイナー', 'Em   Am   B7   Em\nよる', {key:'F#m',capo:2}],
      ['アーティスト空', 'title: 夜\n\nG  C  D  G\nよる', {}],
      ['オンコード', 'C    G/B   Am   F\nあさのひかり', {key:'C',capo:0}],
      ['拍スラッシュ', 'C／   G／   Am／  F／\nあさのひかり', {key:'C',capo:0}],
      ['メモ入り', 'C  G  Am  F （2回し）\nあさのひかり', {key:'C',capo:0}],
    ];
    songs = SAMPLES.map(([t,txt,ex],i)=>{
      const s = parseSheet(txt);
      return Object.assign(s, {id:'s'+i, title:t, text:txt, bpm:s.bpm||100, folder:'A',
                               transpose:0, v:2, sv:2}, ex);
    });
    playlists=[];
    const rounds=[];
    for (const rekey of [true,false]){
      // 状態を戻す
      songs = SAMPLES.map(([t,txt,ex],i)=>{
        const s = parseSheet(txt);
        return Object.assign(s, {id:'s'+i, title:t, text:txt, bpm:s.bpm||100, folder:'A',
                                 transpose:0, v:2, sv:2}, ex);
      });
      tidyRekey = rekey;
      const log=[`===== キーも推測し直す: ${rekey?'ON':'OFF'} =====`];
      for (let r=1;r<=3;r++){
        const plan = tidyPlan();
        log.push(`  ${r}周目: ${plan.length} 曲`);
        if (r>1 && plan.length) plan.forEach(x=>log.push(`    ★残る: ${x.title}\n       ${x.why.join('\n       ')}`));
        if (!plan.length) break;
        const byId=new Map(plan.map(x=>[x.id,x.next]));
        songs = songs.map(s=>{const n=byId.get(s.id); return n?{...n,v:2}:s;});
      }
      rounds.push(log.join('\n'));
    }
    return rounds.join('\n\n') + '\n\n最後の本文（歌詞が消えていないか）:\n' +
      songs.filter(s=>/歌詞から始まる|セクション/.test(s.title))
           .map(s=>'  '+s.title+': '+JSON.stringify(s.text)).join('\n');
  });
  console.log(out);
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
