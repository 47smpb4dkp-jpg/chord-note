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
  await p.goto('file://'+__dirname+'/../index.html');
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

  console.log('\n【M】自動スクロール中に画面を触っても止まらない（止めるのは停止ボタンだけ）');
  await p.evaluate(()=>{
    let t=''; for(let i=0;i<120;i++) t+='C       G\nあさのひかりのなかで'+i+'\n';
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'x',text:t,bpm:100,key:'C',capo:0,folder:'A',transpose:0,v:2,sv:2,scrollPct:100});
    songs=[s]; openSongView('a','list'); document.getElementById('main').scrollTop=0;
  });
  await p.waitForTimeout(300);
  const fire = (type)=>p.evaluate((ty)=>{
    const m=document.getElementById('main');
    const tc=new Touch({identifier:1,target:m,clientX:200,clientY:300});
    m.dispatchEvent(new TouchEvent(ty,{bubbles:true,touches:ty==='touchstart'?[tc]:[],changedTouches:[tc]}));
  }, type);
  const top = ()=>p.evaluate(()=>document.getElementById('main').scrollTop);
  await p.evaluate(()=>startScroll());
  await p.waitForTimeout(600);
  await fire('touchstart');
  const m1 = await p.evaluate(()=>({scrolling, hold:scrollHold}));
  const y1 = await top(); await p.waitForTimeout(500); const y2 = await top();
  // 指で動かしたぶんはそのまま残す
  await p.evaluate(()=>{ document.getElementById('main').scrollTop += 300; });
  const y3 = await top();
  await fire('touchend');
  await p.waitForTimeout(900);
  const y4 = await top();
  const m2 = await p.evaluate(()=>({scrolling, hold:scrollHold}));
  await p.evaluate(()=>stopScroll());
  const m3 = await p.evaluate(()=>({scrolling, hold:scrollHold}));
  check('M','触れても自動スクロールは止まらない', m1.scrolling && m1.hold);
  check('M','指が触れている間は送らない', y2===y1, `${y1}→${y2}`);
  check('M','離すと、指で動かした位置から続きを送る', m2.scrolling && !m2.hold && y4>y3, `${y3}→${y4}`);
  check('M','停止ボタンでは止まる', !m3.scrolling && !m3.hold);

  console.log('\n【N】小節線の整理と、コードのうしろの余白（2026-11-24 追加）');
  const nn = await p.evaluate(()=>{
    const o={};
    // 半角 / を小節線に。離れている / だけを全角にし、分数コードには触らない
    o.半角を小節線に = barsToFull('C / G / Am / F\n') === 'C ／ G ／ Am ／ F\n';
    o.分数は触らない = barsToFull('C/G / D/A\n') === 'C/G ／ D/A\n';
    // 小節線4つごとに改行する
    const w = wrapBars('C／ G／ Am／ F／ D／ A／ Bm／ G／ C／ F／\n').trim().split('\n');
    o.小節4つで折り返す = w.length === 3 && w[0] === 'C／ G／ Am／ F／';
    o.折り返しの単位は4 = w[1] === 'D／ A／ Bm／ G／';
    // 歌詞が下に付いている行は、位置関係が崩れるので折り返さない
    const keep = 'C／ G／ Am／ F／ D／ A／\nあさのひかり\n';
    o.歌詞つきは折り返さない = wrapBars(keep) === keep;
    return o;
  });
  check('N','離れた半角 / を小節線（全角）に直す', nn.半角を小節線に);
  check('N','分数コードの / は小節線にしない', nn.分数は触らない);
  check('N','小節線4つごとに改行する', nn.小節4つで折り返す);
  check('N','折り返しの単位は4小節', nn.折り返しの単位は4);
  check('N','歌詞が下にある行は折り返さない', nn.歌詞つきは折り返さない);

  // 歌詞が短くてもコードどうしがくっつかない（コードのうしろに全角1つぶんの余白）
  const gap = await p.evaluate(()=>{
    const t = 'C   G   Am  F\nあ\n';
    const s2 = parseSheet(t);
    Object.assign(s2,{id:'g',title:'g',text:t,bpm:100,key:'C',capo:0,folder:'A',transpose:0,v:2,sv:2});
    songs=[s2]; openSongView('g','list');
    const sc = [...document.querySelectorAll('#sheet .seg .sc')];
    if (sc.length < 2) return {n:sc.length};
    const pad = parseFloat(getComputedStyle(sc[0]).paddingRight) || 0;
    // 隣り合うコードの字のあいだに、すきまがあること
    const a1 = sc[0].getBoundingClientRect(), a2 = sc[1].getBoundingClientRect();
    return {n:sc.length, pad, すきま: Math.round(a2.left - a1.right + pad)};
  });
  check('N','コードのうしろに余白がある（歌詞が短くてもくっつかない）',
        gap.n >= 2 && gap.pad > 4, `段 ${gap.n} / 余白 ${gap.pad}px`);

  console.log('\n【O】「歌詞のみ」は見え方だけ。本文・同期・送りの速さを変えない（2026-11-24 追加）');
  await p.evaluate(()=>{
    let t='Aメロ\nC       G       Am      F\nあさのひかりのなかで\nC       G\n\n';
    for(let i=0;i<60;i++) t+='F       G       C\nきみがわらう'+i+'\n';
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'x',text:t,bpm:100,key:'C',capo:0,folder:'A',transpose:0,v:2,sv:2,scrollPct:60});
    songs=[s]; editing=null; if (lyricsOnly) toggleLyricsOnly(); openSongView('a','list');
    document.getElementById('main').scrollTop=0;
  });
  await p.waitForTimeout(300);
  const look = ()=>p.evaluate(()=>{
    const sh=document.getElementById('sheet');
    const txt=sh.innerText;
    // 歌詞はコードの位置で細切れになっているので、かたまりごとにつなげて数える
    const lyrText=[...sh.querySelectorAll('.blk')].map(bk=>
      [...bk.querySelectorAll('.sl, .lrow:not(.lsec)')].map(e=>e.textContent).join('').replace(/\s+/g,'')).join('\n');
    return {sc:sh.querySelectorAll('.seg .sc').length, txt,
      lyr:(lyrText.match(/きみがわらう\d+/g)||[]).length, first:/あさのひかりのなかで/.test(lyrText),
      sec:/Aメロ/.test(txt), chordName:/\bAm\b/.test(txt),
      perRow: scrollPxPerSec(songs[0]) / sheetRowH(), btn:document.getElementById('lyrBtn').classList.contains('on')};
  });
  const o0 = await look();
  const before = await p.evaluate(()=>songs[0].text);
  await p.evaluate(()=>{ startScroll(); toggleLyricsOnly(); });
  await p.waitForTimeout(200);
  const o1 = await look();
  const o1x = await p.evaluate(()=>({scrolling, stored:localStorage.getItem('cn_lyricsOnly'),
    cloud:/lyricsOnly/.test(JSON.stringify(forCloud(songs[0]))), text:songs[0].text}));
  await p.evaluate(()=>{ toggleLyricsOnly(); stopScroll(); });
  await p.waitForTimeout(200);
  const o2 = await look();
  const o2x = await p.evaluate(()=>({stored:localStorage.getItem('cn_lyricsOnly'), text:songs[0].text}));
  check('O','押すとコード行が消える', o0.sc>0 && o1.sc===0 && !o1.chordName && o1.btn, `${o0.sc}→${o1.sc}`);
  check('O','歌詞は1行も欠けない', o1.first && o1.lyr===60 && o0.lyr===60, `${o0.lyr}→${o1.lyr}`);
  check('O','区切りの見出し（Aメロなど）は残る', o0.sec && o1.sec);
  check('O','もう一度押すと元どおりに出る', o2.sc===o0.sc && !o2.btn && o2.txt===o0.txt);
  check('O','譜面の本文（text）は書き換えない', o1x.text===before && o2x.text===before);
  check('O','端末の設定に持ち、曲のデータ（クラウド）には入れない', o1x.stored==='1' && o2x.stored===null && !o1x.cloud);
  check('O','切り替えても自動スクロールは止まらない', o1x.scrolling);
  check('O','送りの速さは「1行あたりの秒数」のまま', Math.abs(o1.perRow-o0.perRow)<1e-9 && Math.abs(o2.perRow-o0.perRow)<1e-9);

  console.log('\n' + '='.repeat(60));
  console.log(`結果: OK ${ok} 件 / NG ${ng} 件`);
  if (fails.length){ console.log('\n■ 干渉しているもの:'); fails.forEach(f=>console.log('  - '+f)); }
  if (errs.length) console.log('\n■ ページ例外: '+errs.join(' / '));
  await b.close();
  process.exit(ng || errs.length ? 1 : 0);
})();
