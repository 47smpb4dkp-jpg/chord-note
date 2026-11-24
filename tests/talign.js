const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);

const TEXT = [
"Hold Your Last Chance",
"",
"イントロ",
"Dm/     G7/     C       Am",
"",
"Dm/   G7/   C      Am",
"きみのこえがきこえる　よあけのまちで",
"Bm7-5  B♭m7   A7(#9)  Dm",
"とおくでなるかねのおと",
"",
"間奏  D//   A//   Bm//  G//",
"",
"C      G/B    Am     F     G7sus4  G7",
"さいごのチャンスをにぎりしめて",
"これはとてもながい歌詞の行で　画面の幅をこえるくらい長く書いてあります　さらにのばしてよこスクロールが出るようにします　もっともっと長く"
].concat(Array.from({length:30},(_,i)=>i%3===0?`C      Am     F      G   (${i})`:i%3===1?`${i}ばんめのかしのぎょうです`:"").toString().split(',')).join("\n");

await pg.evaluate((t)=>{
  const s = parseSheet(t);
  Object.assign(s, {id:'x1', title:'Hold Your Last Chance', text:t,
    bpm:100, barsPerLine:8, transpose:0, plays:0, folder:'オリジナル'});
  songs=[s]; playlists=[]; openSong=null; tab='list'; render();
  editSong('x1');
}, TEXT);
await pg.waitForTimeout(500);

console.log('=== 窓の寸法 ===');
console.log(await pg.evaluate(()=>{
  const a=document.getElementById('eText').getBoundingClientRect();
  const b=document.getElementById('editPrev').getBoundingClientRect();
  const r=x=>({top:Math.round(x.top),h:Math.round(x.height),w:Math.round(x.width)});
  const ca=getComputedStyle(document.getElementById('eText'));
  const cb=getComputedStyle(document.getElementById('editPrev').querySelector('.aligned'));
  return JSON.stringify({入力欄:r(a), 確認:r(b),
    文字:{入力:ca.fontSize+'/'+ca.lineHeight+' '+ca.fontFamily.split(',')[0],
          確認:cb.fontSize+'/'+cb.lineHeight+' '+cb.fontFamily.split(',')[0]}}, null, 1);
}));

console.log('\n=== 1行ごとの縦位置（入力欄 vs 確認）===');
console.log(await pg.evaluate(()=>{
  const ta=document.getElementById('eText');
  const prev=document.getElementById('editPrev');
  const rows=[...prev.querySelectorAll('.arow')];
  const cs=getComputedStyle(ta);
  const lh=parseFloat(cs.lineHeight);
  const top0=ta.getBoundingClientRect().top + parseFloat(cs.paddingTop) - ta.scrollTop;
  const p0=prev.getBoundingClientRect().top - prev.scrollTop;
  return rows.map((r,i)=>{
    const want = top0 + i*lh;
    const got  = r.getBoundingClientRect().top;
    const d = Math.round((got-want)*10)/10;
    return `行${String(i+1).padStart(2)}  ずれ ${d>=0?'+':''}${d}px`;
  }).join('\n');
}));

console.log('\n=== コード文字が書いたとおりか ===');
console.log(await pg.evaluate(()=>{
  const prev=document.getElementById('editPrev');
  const src=document.getElementById('eText').value.split('\n');
  const rows=[...prev.querySelectorAll('.arow')];
  const out=[];
  rows.forEach((r,i)=>{
    const shown=r.querySelector('.atx').textContent.replace(/ /g,'');
    if (shown !== src[i]) out.push(`行${i+1} 食い違い\n  入力: 「${src[i]}」\n  確認: 「${shown}」`);
  });
  return out.length ? out.join('\n') : '全' + rows.length + '行、1文字も違いなし';
}));

console.log('\n=== コードとして色が付いたもの ===');
console.log(await pg.evaluate(()=>
  [...document.querySelectorAll('#editPrev .at-c')].map(e=>e.textContent).join(' | ')));

console.log('\n=== スクロール同期 ===');
console.log(await pg.evaluate(()=>{
  const ta=document.getElementById('eText'), pv=document.getElementById('editPrev');
  ta.scrollTop = 60; ta.dispatchEvent(new Event('scroll'));
  const v = `縦: 入力${ta.scrollTop} → 確認${Math.round(pv.scrollTop)}`;
  ta.scrollLeft = 80; ta.dispatchEvent(new Event('scroll'));
  return v + ` / 横: 入力${ta.scrollLeft} → 確認${Math.round(pv.scrollLeft)}`;
}));

await pg.evaluate(()=>{document.getElementById('eText').scrollTop=0;document.getElementById('eText').scrollLeft=0;
  document.getElementById('editPrev').scrollTop=0;document.getElementById('editPrev').scrollLeft=0;});
await pg.waitForTimeout(200);
await pg.locator('.split').screenshot({path:'align.png'});
await b.close();
})();
