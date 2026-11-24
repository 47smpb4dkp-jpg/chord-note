const { chromium } = require('playwright');
const R=[]; const ok=(n,d)=>R.push(['OK',n,d||'']); const ng=(n,d)=>R.push(['NG',n,d||'']);
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:950}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);
const E=(f,...a)=>pg.evaluate(f,...a);

// ---- 1. @マーカー ----
let r = await E(()=>{
  const L='@これは　コードじゃない　語';
  return {parse: parseBody(L)[0] && !!parseBody(L)[0].chords, kind: lineKind(L)};
});
r.parse ? ok('@ マーカー: 本体の解釈','コード行として扱う') : ng('@ マーカー: 本体の解釈');
r.kind==='chord' ? ok('@ マーカー: lineKind') : ng('@ マーカー: lineKind', `lineKind='${r.kind}' → 確認画面では歌詞行に見える`);

// ---- 2. 編集プレビューでの @ 行 ----
r = await E(()=>{
  const t="@これは　コードじゃない　語\nC G Am F\nかしのぎょう";
  const s=parseSheet(t); Object.assign(s,{id:'z',title:'t',text:t,bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; playlists=[]; openSong=null; tab='list'; render(); editSong('z');
  return null;
});
await pg.waitForTimeout(400);
r = await E(()=>[...document.querySelectorAll('#editPrev .arow')].map(x=>{
  const t=x.querySelector('.lntg'); return (t?t.textContent:'?')+' '+x.querySelector('.atx').textContent;
}));
r[0].startsWith('♪') ? ok('@ 行の確認画面','♪ が付く') : ng('@ 行の確認画面', `「${r[0]}」← ♪ でなく ＋ になっている`);

// ---- 3. 行の切り替えボタン ----
await E(()=>toggleLineAt(2));
await pg.waitForTimeout(250);
r = await E(()=>document.getElementById('eText').value.split('\n')[2]);
r.startsWith('@') ? ok('行の切り替え','歌詞行→コード行にできる') : ng('行の切り替え', r);

// ---- 4. カポの上限が画面ごとに違わないか ----
r = await E(()=>{
  const s=songs[0]; s.capo=0; openSong=s.id; editing=null;
  let hdr=0; for(let i=0;i<14;i++){ capo(1); } hdr=s.capo;
  s.capo=0; setCapo(12); const pick=s.capo;
  return {hdr, pick};
});
r.hdr===r.pick ? ok('カポの上限','どの画面でも同じ')
  : ng('カポの上限', `ヘッダーの＋は ${r.hdr} まで / カポを選ぶ画面は ${r.pick} まで / 編集画面は 12 まで`);

// ---- 5. 共有に持っていく項目 ----
r = await E(()=>{
  const s=songs[0]; s.capoView=true; s.vname='女性キー'; s.vgroup='g9'; s.capo=2;
  const p=shareablePayload([s])[0];
  return {capoView:'capoView' in p, vname:'vname' in p, vgroup:'vgroup' in p, capo:'capo' in p};
});
r.vname&&r.vgroup ? ok('共有: バージョン情報','乗る') : ng('共有: バージョン情報');
r.capoView ? ok('共有: 押さえ方表示') : ng('共有: 押さえ方表示','capoView が乗らないので相手には書いたまま出る');

// ---- 6. 書き出し→読み込みの往復 ----
r = await E(()=>{
  const s=songs[0]; s.key='Em'; s.capo=2; s.transpose=0; s.vname='女性キー'; s.capoView=true;
  const md=songToMd(s); const p=parseSheet(md);
  return {key:p.key, capo:p.capo, ver:p.vname, hasCapoView:/capoView/.test(md)};
});
(r.key==='Em'&&r.capo===2&&r.ver==='女性キー') ? ok('書き出し→読み込み','キー・カポ・バージョン名が戻る')
  : ng('書き出し→読み込み', JSON.stringify(r));

// ---- 7. 移調とカポ ----
// カポは鳴る音を変えず、押さえる形だけ変える
r = await E(()=>{
  const s=songs[0]; s.key='F'; s.capo=3; s.textCapo=3; s.transpose=0; s.capoBase='play';
  const at3={shift:shiftOf(s), sound:soundKeyOf(s), play:playKeyOf(s)};
  s.capo=5; const at5={shift:shiftOf(s), sound:soundKeyOf(s), play:playKeyOf(s)};
  s.capo=0; const at0={shift:shiftOf(s), sound:soundKeyOf(s), play:playKeyOf(s)};
  s.capo=3; s.transpose=2; const tr2={shift:shiftOf(s), sound:soundKeyOf(s)};
  return {at3, at5, at0, tr2};
});
(r.at3.shift===0 && r.at3.sound==='F' && r.at3.play==='D'
 && r.at5.shift===-2 && r.at5.sound==='F' && r.at5.play==='C'
 && r.at0.shift===3  && r.at0.sound==='F' && r.at0.play==='F'
 && r.tr2.sound==='G')
  ? ok('カポと移調','カポを動かしても鳴る音は F のまま／押さえ方だけ変わる')
  : ng('カポと移調', JSON.stringify(r));

// ---- 8. コード図は画面に出ている形か ----
r = await E(()=>{
  const t="Em    Bm\nあ";
  const s=parseSheet(t); Object.assign(s,{id:'y',title:'t',text:t,key:'Em',capo:2,textCapo:0,capoBase:'play',bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; editing=null; openSong=null; tab='list'; render(); openSongView('y','list');
  const shown=[...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean);
  const el=document.querySelector('#sheet .sc.c');
  let look=null; const orig=window.showChord; window.showChord=n=>{look=n;};
  if (el) el.onclick();
  window.showChord=orig;
  return {shown, look};
});
(r.look===r.shown[0]) ? ok('コード図','画面に出ている押さえ方と同じ') : ng('コード図', JSON.stringify(r));

// ---- 9. 新規登録のプレビュー ----
r = await E(()=>{
  draft={text:"C G Am F\nあいうえお",title:'',artist:'',key:'',capo:0,folder:'',keyEdited:false,keyGuessed:false};
  go('new'); previewDraft();
  const p=document.getElementById('draftPrev');
  return p ? p.textContent.replace(/\s+/g,' ').trim().slice(0,60) : '(なし)';
});
/C/.test(r) ? ok('新規登録のプレビュー', r.slice(0,40)) : ng('新規登録のプレビュー', r);

// ---- 10. キー自動推測とボタンの同期 ----
r = await E(()=>{
  draft={text:'',title:'',artist:'',key:'',capo:0,folder:'',keyEdited:false,keyGuessed:false};
  go('new');
  draft.text="G D Em C\nあ"; previewDraft();
  const btn=document.getElementById('keyBtn');
  const note=document.getElementById('keyNote');
  return {key:draft.key,
          btn: btn ? btn.textContent.trim().split('\n')[0] : '(なし)',
          note: note ? note.textContent.replace(/\s+/g,' ').trim().slice(0,80) : '(なし)'};
});
(r.key && r.btn.indexOf(r.key) === 0 && r.note.indexOf(r.key + ' で鳴る曲') >= 0)
  ? ok('キー自動推測とボタン',`${r.key} がボタンにも説明にも出る`)
  : ng('キー自動推測とボタン', JSON.stringify(r));

// ---- 11. fitSheet が消えた窓を触っていないか ----
r = await E(()=>{ try{ const a=document.getElementById('editPrev'); if(a) fitSheet(a); return 'ok'; }catch(e){ return 'ERROR '+e.message; } });
r==='ok' ? ok('画面サイズ変更','落ちない') : ng('画面サイズ変更', r);

// ---- 12. ♭表記の一貫性 ----
r = await E(()=>({ そのまま: transposeChord('B♭m7',0), 移調: transposeChord('B♭m7',2),
                   カポで下げる: shiftKey('B♭',-3) }));
R.push(['--','♭ の表記', JSON.stringify(r)]);

console.log(errs.length? 'ページ例外: '+errs.join(' / ') : '');
for (const [s,n,d] of R) console.log(`${s==='OK'?'  OK':s==='NG'?'★ NG':'  --'}  ${n}${d?'\n          '+d:''}`);
await b.close();
})();
