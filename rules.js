// ===== 規則どうしの干渉チェック =====
// 「この操作は、これを変える／これは変えない」を1か所にまとめて検証する。
// 機能を足したり変えたりしたら、まずこれを走らせる。
const {chromium}=require('playwright');

const T_PLAIN = 'C       G       Am      F\nあさのひかりのなかで\n\nF       G       C\nきみがわらう';
const T_CAPO  = 'D       G       A       D\nあさのひかり\nBm      G       A       D\nきみがわらう';
const T_SLASH = 'ConG    D7onF#  F／   G/B    Am\nあさのひかりのなかできみが';
const T_TIGHT = 'C／G／Am／F\nあさのひかり';

let ok=0, ng=0; const fails=[];
function check(group, name, pass, detail){
  if (pass) ok++; else { ng++; fails.push(`${group} / ${name}${detail?'\n      '+detail:''}`); }
  console.log(`  ${pass?'OK  ':'★NG '} ${name}${pass||!detail?'':'  … '+detail}`);
}

(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1280,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+__dirname+'/build/index.html');
  await p.waitForTimeout(900);

  // 1曲を編集中の状態にして、関数を直接呼べるようにする
  const setup = (text, extra)=>p.evaluate(([t,ex])=>{
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'テスト',artist:'A',text:t,bpm:100,key:'C',capo:0,
      folder:'フォーク',transpose:0,v:2,sv:2,capoBase:'play'}, ex||{});
    songs=[s]; playlists=[]; tab='list'; openSong=null; render(); editSong('a');
    return true;
  },[text,extra]);

  // 曲の状態をまとめて取る
  const snap = ()=>p.evaluate(()=>{
    const s=curEdit()||songs[0];
    const ta=curEditText();
    return {key:s.key, capo:s.capo||0, textCapo:s.textCapo||0, base:capoBaseOf(s),
            transpose:s.transpose||0, acc:s.acc||'', bpm:s.bpm,
            text: ta?ta.value:s.text,
            sound: soundKeyOf(s), shown: shownKeyOf(s), shift: shiftOf(s)};
  });
  // コードの開始桁を並べる（桁が動いていないかを見る）
  const cols = ()=>p.evaluate(()=>{
    const ta=curEditText(); if(!ta) return '';
    return ta.value.split('\n').map(L=>{
      if (lineKind(L)!=='chord') return '';
      const r=[]; L.replace(/\S+/g,(m,o)=>{ r.push(dispWidth(L.slice(0,o))); return m; });
      return r.join(',');
    }).join(' | ');
  });
  const lyrics = ()=>p.evaluate(()=>{
    const ta=curEditText(); if(!ta) return [];
    return ta.value.split('\n').filter(L=>L.trim() && lineKind(L)==='lyric');
  });

  console.log('\n【A】鳴る音は、カポをどう動かしても変わらない');
  await setup(T_CAPO,{key:'F',capo:3});
  const a0=await snap();
  for (const n of [0,2,5,7,12,3]){
    await p.evaluate(n=>setEditCapo(n), n);
    const a=await snap();
    check('A','カポ'+n+' にしても鳴る音は '+a0.sound, a.sound===a0.sound, '→ '+a.sound);
  }
  const a1=await snap();
  check('A','カポを一周して戻すと譜面も元に戻る', a1.text===a0.text,
        JSON.stringify(a1.text.split('\n')[0])+' vs '+JSON.stringify(a0.text.split('\n')[0]));

  console.log('\n【B】原曲キーは覚え書き。譜面・カポ・移調を動かさない');
  await setup(T_CAPO,{key:'F',capo:3});
  const b0=await snap();
  for (const k of ['G','A','B♭','Em','C']){
    await p.evaluate(k=>setEditKey(k), k);
    const s=await snap();
    check('B','原曲キー '+k+' … 譜面不変', s.text===b0.text);
    check('B','原曲キー '+k+' … カポ不変', s.capo===b0.capo, 'capo='+s.capo);
    check('B','原曲キー '+k+' … 移調不変', s.transpose===b0.transpose);
  }

  console.log('\n【C】譜面の音の切り替えは、文字を動かさない');
  await setup(T_CAPO,{key:'F',capo:3});
  const c0=await snap();
  await p.evaluate(()=>toggleCapoBase());
  const c1=await snap();
  check('C','切り替えで文字不変', c1.text===c0.text);
  check('C','切り替えで鳴る音不変', c1.sound===c0.sound, c0.sound+' → '+c1.sound);
  check('C','表示のずれが切り替わる', c1.shift!==c0.shift, c0.shift+' → '+c1.shift);
  await p.evaluate(()=>toggleCapoBase());
  const c2=await snap();
  check('C','戻すと元どおり', c2.text===c0.text && c2.shift===c0.shift && c2.base===c0.base);

  console.log('\n【D】譜面を原曲キーに合わせる');
  await setup(T_CAPO,{key:'A',capo:3});
  const d0=await snap();
  await p.evaluate(()=>applyKeyToSheet());
  const d1=await snap();
  check('D','譜面が原曲キーとカポから決まるキーになる',
        await p.evaluate(()=>sameKeyName(writtenKeyOf(curEdit()),
          shiftKey(shiftKey(curEdit().key, curEdit().transpose||0), -(curEdit().capo||0)))),
        '譜面='+await p.evaluate(()=>writtenKeyOf(curEdit())));
  check('D','原曲キーは動かない', d1.key===d0.key);
  check('D','カポは動かない', d1.capo===d0.capo);
  check('D','もう一度押しても変わらない（二重移調しない）',
        await p.evaluate(async ()=>{ const before=curEditText().value; applyKeyToSheet();
          return curEditText().value===before; }));

  console.log('\n【E】自動で直す … 歌詞の行は触らない／桁は動かさない');
  // 「歌詞の行」は読み取り方で増減しうるので、
  // 日本語を含む行そのものが1文字も変わらないことを見る
  const jp = ()=>p.evaluate(()=>{
    const ta=curEditText(); if(!ta) return [];
    return ta.value.split('\n').filter(L=>/[ぁ-んァ-ヶ一-龠]/.test(L));
  });
  for (const [name,t] of [['ふつう',T_PLAIN],['分数',T_SLASH],['密',T_TIGHT]]){
    await setup(t);
    const before=await jp();
    for (const k of ['squeeze','loosen','slash','on']){
      await p.evaluate(k=>tidySheet(k), k);
    }
    const after=await jp();
    check('E',name+' … 歌詞の行が1文字も変わらない', JSON.stringify(before)===JSON.stringify(after),
          JSON.stringify(before)+' → '+JSON.stringify(after));
  }
  await setup(T_SLASH);
  const e0=await cols();
  await p.evaluate(()=>tidySheet('slash'));
  const e1=await cols();
  await p.evaluate(()=>tidySheet('on'));
  const e2=await cols();
  check('E','分数コードの書き換えで桁が動かない', e0===e1 && e1===e2, e0+' → '+e1+' → '+e2);

  console.log('\n【F】♯／♭ の切り替えは、音を変えない');
  await setup('A#      D#      G#      C#\nあさのひかり',{key:'A#'});
  const f0=await p.evaluate(()=>{
    const ta=curEditText();
    return ta.value.split('\n')[0].match(/\S+/g).map(x=>pc(normTok(x.replace(/m$/,''))));
  });
  await p.evaluate(()=>setKeySpell('flat'));
  const f1=await p.evaluate(()=>{
    const ta=curEditText();
    return ta.value.split('\n')[0].match(/\S+/g).map(x=>pc(normTok(x.replace(/m$/,''))));
  });
  check('F','♭に直しても音の高さは同じ', JSON.stringify(f0)===JSON.stringify(f1),
        JSON.stringify(f0)+' vs '+JSON.stringify(f1));
  const fw=await p.evaluate(()=>cols=>0||(()=>{const ta=curEditText();
    return ta.value.split('\n')[0];})());
  check('F','桁も動かない', (await cols()).split(' | ')[0]==='0,8,16,24', (await cols()));

  console.log('\n【G】整理し直す … 2周目は何も出ない（堂々巡りしない）');
  await p.evaluate(()=>{ go('list'); });
  const g=await p.evaluate(()=>{
    const mk=(id,t,txt,ex)=>{const s=parseSheet(txt);
      return Object.assign(s,{id,title:t,text:txt,bpm:s.bpm||100,folder:'A',transpose:0,v:2,sv:2},ex||{});};
    songs=[
      mk('1','情報欄つき','---\ntitle: とんぼ\nartist: 長渕剛\nkey: F\ncapo: 3\n---\n\nD  G  A  D\nあさのひかり'),
      mk('2','歌詞から','---\ntitle: 朝\nkey: C\n---\n\nあさのひかりのなかで\nC  G  Am  F\nきみ'),
      mk('3','カポあり','D  G  A  D\nあさ',{key:'F',capo:3}),
      mk('4','♭キー','B♭  E♭  F  B♭\nあさ',{key:'B♭'}),
      mk('5','キーなし','G  C  D  G\nよる',{key:''})
    ];
    const res=[];
    for (const rekey of [true,false]){
      const keep=songs.map(x=>({...x}));
      tidyRekey=rekey;
      const r=[];
      for (let i=0;i<3;i++){
        const plan=tidyPlan(); r.push(plan.length);
        if(!plan.length) break;
        const by=new Map(plan.map(x=>[x.id,x.next]));
        songs=songs.map(s=>{const n=by.get(s.id); return n?{...n,v:2}:s;});
      }
      res.push({rekey, rounds:r, 歌詞: songs.map(s=>s.text.split('\n').filter(L=>L.trim()&&lineKind(L)==='lyric').join('/'))});
      songs=keep;
    }
    return res;
  });
  g.forEach(r=>{
    check('G','推測し直す'+(r.rekey?'ON':'OFF')+' … 2周目で0件',
      r.rounds.length>=2 ? r.rounds[1]===0 : r.rounds[0]===0, '周ごと: '+r.rounds.join('→'));
    check('G','推測し直す'+(r.rekey?'ON':'OFF')+' … 歌詞が消えない',
      r.歌詞.every(x=>x.length>0), JSON.stringify(r.歌詞));
  });

  console.log('\n【H】スクロールの速さと BPM は別もの');
  await p.evaluate(()=>{
    const t='C G\nあ'; const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'x',text:t,bpm:100,key:'C',capo:0,folder:'A',transpose:0,v:2,sv:2});
    songs=[s]; openSongView('a','list');
  });
  await p.waitForTimeout(300);
  const h=await p.evaluate(()=>{
    const s=songs[0];
    setScrollPct(60); const px1=scrollPxPerSec(s), sec1=secPerLineOf(s);
    setBpm(200);      const px2=scrollPxPerSec(s), sec2=secPerLineOf(s);
    setScrollPct(30); const px3=scrollPxPerSec(s);
    return {同じ:Math.abs(px1-px2)<0.001, 倍率:+(px1/px3).toFixed(2), sec1:+sec1.toFixed(2), bpm:s.bpm};
  });
  check('H','BPM を変えてもスクロール速度は変わらない', h.同じ);
  check('H','% を半分にすると倍の時間がかかる', Math.abs(h.倍率-2)<0.3, '倍率='+h.倍率);

  console.log('\n【I】クラウドに送る形に undefined が混ざらない');
  const i1=await p.evaluate(()=>{
    const bad=[];
    const walk=(o,path,label)=>{ for(const k in o){ if(o[k]===undefined) bad.push(label+' '+path+k);
      else if(o[k]&&typeof o[k]==='object') walk(o[k],path+k+'.',label); } };
    songs.forEach((s,i)=>walk(forCloud(s),'','曲'+i));
    // ひととおり触ってから、もう一度
    const s=songs[0]; openSong=s.id; editing=s.id;
    setKeySpell('sharp'); setKeySpell('flat'); toggleCapoBase(); toggleCapoBase();
    toggleAlign(); autoSize(); bumpSize(1); setScrollPct(55); setBpm(120); setBeatTop(3);
    songs.forEach((s,i)=>walk(forCloud(s),'','操作後の曲'+i));
    return bad;
  });
  check('I','送信データに undefined なし', i1.length===0, i1.join(', '));

  console.log('\n【J】ドライブは、変わった曲だけ送る');
  const j=await p.evaluate(()=>{
    const s=songs[0];
    const a=driveSnap(s);
    s.plays=(s.plays||0)+1; s.lastOpen=Date.now();
    const b=driveSnap(s);
    s.folder='ロック';
    const c=driveSnap(s);
    return {開いただけでは不変:a===b, ジャンルを変えたら変わる:b!==c};
  });
  check('J','曲を開いただけでは書き出し対象にならない', j.開いただけでは不変);
  check('J','ジャンルを変えると書き出し対象になる', j.ジャンルを変えたら変わる);

  console.log('\n【K】曲画面の移調は、保存されている譜面を書き換えない');
  await p.evaluate(()=>{
    const t='C  G  Am  F\nあ'; const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'x',text:t,bpm:100,key:'C',capo:0,folder:'A',transpose:0,v:2,sv:2});
    songs=[s]; editing=null; openSongView('a','list');
  });
  await p.waitForTimeout(300);
  const k=await p.evaluate(()=>{
    const before=songs[0].text;
    tr(2); const t1=songs[0].text, sh1=shiftOf(songs[0]);
    tr(-2); const t2=songs[0].text;
    return {移調しても本文不変:before===t1 && before===t2, ずれ:sh1};
  });
  check('K','移調しても譜面の文字は変わらない', k.移調しても本文不変);
  check('K','移調ぶんは表示のずれとして持つ', k.ずれ===2, 'shift='+k.ずれ);

  console.log('\n【L】開いた回数（よく使う）は端末だけに持ち、同期で消えない');
  const l = await p.evaluate(()=>{
    const mk=(id,ex)=>Object.assign({id,title:id,text:'C G\nあ',bpm:100,key:'C',capo:0,
      folder:'A',transpose:0,v:2,sv:2}, ex||{});
    const out={};
    savePlays({});
    songs=[mk('a'),mk('b')]; pushed=new Map(); playlists=[];
    bumpPlays(songs[0]); bumpPlays(songs[0]); bumpPlays(songs[1]);
    out.置き場に入る = JSON.stringify(Object.keys(loadPlays()).sort())==='["a","b"]';
    out.クラウドに出さない = !/plays|lastOpen/.test(JSON.stringify(forCloud(songs[0])));
    // クラウドの中身（回数なし）で一覧が入れ替わった状態を作る
    songs=[mk('a'),mk('b')];
    applyPlays();
    out.入れ替わっても戻る = songs[0].plays===2 && songs[1].plays===1;
    // 1曲ぶんだけ足す。ほかの曲の記録を消さない
    savePlays({a:[2,1],b:[1,1],z:[9,1]});
    savePlay('a',3,2);
    const o=loadPlays();
    out.ほかの曲を消さない = o.b && o.b[0]===1 && o.z && o.z[0]===9 && o.a[0]===3;
    // 別バージョンぶんを合わせて数える
    songs=[mk('v1',{vgroup:'g',plays:3}), mk('v2',{vgroup:'g',plays:4})];
    out.版をまとめて数える = playsOf(songs[0])===7 && playsOf(songs[1])===7;
    // 消した曲の記録は外れる
    savePlays({a:[1,1],b:[2,2]}); forgetPlays(['a']);
    out.消した曲は外れる = JSON.stringify(Object.keys(loadPlays()))==='["b"]';
    savePlays({});
    return out;
  });
  check('L','回数は端末の置き場に入る', l.置き場に入る);
  check('L','回数はクラウドに送らない', l.クラウドに出さない);
  check('L','同期で一覧が入れ替わっても回数が戻る', l.入れ替わっても戻る);
  check('L','1曲足してもほかの曲の記録を消さない', l.ほかの曲を消さない);
  check('L','別バージョンぶんを合わせて数える', l.版をまとめて数える);
  check('L','消した曲の記録は置き場から外れる', l.消した曲は外れる);

  console.log('\n' + '='.repeat(60));
  console.log(`結果: OK ${ok} 件 / NG ${ng} 件`);
  if (fails.length){ console.log('\n■ 干渉しているもの:'); fails.forEach(f=>console.log('  - '+f)); }
  if (errs.length) console.log('\n■ ページ例外: '+errs.join(' / '));
  await b.close();
  process.exit(ng || errs.length ? 1 : 0);
})();
