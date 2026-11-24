const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:2});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(900);
await pg.evaluate(()=>{
  const t="C        G        Am       F\nきみのこえがきこえる\n\nDm       G7       C\nよあけのまちで";
  const s=parseSheet(t);
  Object.assign(s,{id:'m1',title:'テスト',text:t,key:'C',capo:0,bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; playlists=[]; openSong=null; tab='list'; render(); editSong('m1');
});
await pg.waitForTimeout(400);

console.log('=== ① コード行の途中に差し込む ===');
await pg.evaluate(()=>{ const ta=document.getElementById('eText');
  const p=ta.value.indexOf('Am'); ta.focus(); ta.setSelectionRange(p,p); });
await pg.fill('#memoBox','ここだけ2回し');
await pg.click('.card:has(#memoBox) button:has-text("入れる")');
await pg.waitForTimeout(300);
console.log(await pg.evaluate(()=>document.getElementById('eText').value.split('\n')[0]));
console.log('その行の判定:', await pg.evaluate(()=>lineKind(document.getElementById('eText').value.split('\n')[0])));

console.log('\n=== ② 何もない行に差し込む ===');
await pg.evaluate(()=>{ const ta=document.getElementById('eText');
  const lines=ta.value.split('\n'); let p=0;
  for (let i=0;i<2;i++) p+=lines[i].length+1;
  ta.focus(); ta.setSelectionRange(p,p); });
await pg.click('.card:has(#memoBox) button:has-text("2回し")');
await pg.waitForTimeout(300);
console.log(JSON.stringify(await pg.evaluate(()=>document.getElementById('eText').value.split('\n').slice(0,4))));

console.log('\n=== ③ 確認画面での見え方 ===');
console.log(await pg.evaluate(()=>[...document.querySelectorAll('#editPrev .arow')].map(r=>
  (r.querySelector('.lntg')?r.querySelector('.lntg').textContent:' ')+' '+r.querySelector('.atx').textContent).join('\n')));
console.log('メモの色分け:', await pg.evaluate(()=>
  [...document.querySelectorAll('#editPrev .at-n')].map(e=>e.textContent).join(' | ') || '(なし)'));

console.log('\n=== ④ 保存して曲画面で見る ===');
await pg.evaluate(()=>saveEdit());
await pg.waitForTimeout(400);
console.log(await pg.evaluate(()=>{
  openSongView('m1','list');
  return [...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean).join(' | ');
}));

console.log('\n=== ⑤ 移調してもメモは動かないか ===');
console.log(await pg.evaluate(()=>{ tr(2);
  return [...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean).join(' | '); }));

console.log('\n版の表示:', await pg.evaluate(()=>{ tr(-2); go('list');
  const e=document.querySelector('.buildline'); return e?e.textContent.trim():'(なし)'; }));
await pg.evaluate(()=>{ editSong('m1'); });
await pg.waitForTimeout(400);
await pg.locator('.card:has(#memoBox)').screenshot({path:'memo.png'});
await b.close();
})();
