const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:1050},deviceScaleFactor:2});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(900);
await pg.evaluate(()=>{ songs=[]; playlists=[]; openSong=null;
  draft={text:'',title:'',artist:'',key:'',capo:0,folder:'',capoBase:'play',transpose:0,keyEdited:false,keyGuessed:false};
  go('new'); });
await pg.waitForTimeout(400);
console.log('=== 新規登録の画面にあるもの ===');
console.log(await pg.evaluate(()=>[...document.querySelectorAll('#view .card h2, #view .card > label')]
  .map(x=>x.textContent.trim()).join(' / ')));
console.log('キー・カポの欄:', await pg.evaluate(()=>!!document.getElementById('keyCard')));
console.log('左右の窓:', await pg.evaluate(()=>!!document.getElementById('draftText') && !!document.getElementById('draftPrev')));

await pg.fill('#draftText', "F#m      C#m      D        A\nきみのこえがきこえる\nBm       E        F#m\nよあけのまちで");
await pg.waitForTimeout(500);
console.log('\n自動推測されたキー:', await pg.evaluate(()=>draft.key));
console.log('左右一致:', await pg.evaluate(()=>{
  const src=document.getElementById('draftText').value.split('\n');
  const rows=[...document.querySelectorAll('#draftPrev .arow')];
  const bad=rows.map((r,i)=>r.querySelector('.atx').textContent.replace(/ /g,'')===src[i]?null:i+1).filter(Boolean);
  return bad.length? '食い違う行 '+bad.join(',') : '全'+rows.length+'行 一致';
}));

console.log('\n=== 新規登録でもカポを押すとコード譜が変わるか ===');
await pg.evaluate(()=>setEditKey('F#m'));
await pg.waitForTimeout(250);
await pg.evaluate(()=>setEditCapo(2));
await pg.waitForTimeout(400);
console.log('カポ2:', await pg.evaluate(()=>document.getElementById('draftText').value.split('\n')[0]));
console.log('draft.text も同じか:', await pg.evaluate(()=>draft.text.split('\n')[0]));
await pg.evaluate(()=>setEditCapo(0));
await pg.waitForTimeout(400);
console.log('カポ0:', await pg.evaluate(()=>document.getElementById('draftText').value.split('\n')[0]));

console.log('\n=== 行の切り替えが効くか ===');
await pg.evaluate(()=>toggleLineAt(1));
await pg.waitForTimeout(350);
console.log(await pg.evaluate(()=>document.getElementById('draftText').value.split('\n')[1]));
console.log('確認画面:', await pg.evaluate(()=>
  [...document.querySelectorAll('#draftPrev .arow')].slice(0,2).map(r=>
    (r.querySelector('.lntg')||{}).textContent+' '+r.querySelector('.atx').textContent).join(' // ')));

console.log('\n=== 保存すると引き継がれるか ===');
await pg.evaluate(()=>{ toggleLineAt(1); setEditCapo(2); });
await pg.waitForTimeout(400);
await pg.evaluate(()=>saveDraft());
await pg.waitForTimeout(500);
console.log(await pg.evaluate(()=>songs.map(x=>
  `${x.title} key=${x.key} capo=${x.capo} textCapo=${x.textCapo} base=${x.capoBase}\n  ${x.text.split('\n')[0]}`).join('\n')));
console.log('\nページ例外:', errs.length? errs.join(' / ') : 'なし');
await pg.evaluate(()=>{ go('new'); });
await pg.waitForTimeout(400);
await pg.locator('#keyCard').screenshot({path:'newkey.png'});
await b.close();
})();
