const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:900,height:900}});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);
const T=["F#m      C#m      D        A",
"きみのこえがきこえる　よあけのまちで",
"",
"Bm7-5  B♭m7   A7(#9)  Dm",
"とおくでなるかねのおと",
"間奏  D//   A//   Bm//  G//",
"C        G        （ここだけ2回し） Am       F",
"これはただのメモ行です"].join("\n");
for (const n of [-2, 2, -1]) {
  console.log(`=== ${n>0?'+':''}${n} 半音 ===`);
  console.log(await pg.evaluate(([t,n])=>retuneText(t,n,false), [T,n]));
  console.log('');
}
console.log('=== 桁がそろっているか（コード行と歌詞行の先頭位置）===');
console.log(await pg.evaluate(([t])=>{
  const out=[];
  for (const n of [-2,-1,1,2,3]){
    const r=retuneText(t,n,false).split('\n');
    const o=t.split('\n');
    const cols = s => tokenize(s).map(x=>x.col).join(',');
    for (const li of [0,3,6])
      out.push(`${n>0?'+':''}${n} 行${li+1}: 元[${cols(o[li])}] → 後[${cols(r[li])}]`);
  }
  return out.join('\n');
}, [T]));
console.log('\n=== 往復して元に戻るか ===');
console.log(await pg.evaluate(([t])=>{
  const there=retuneText(t,-2,false), back=retuneText(there,2,false);
  const a=t.split('\n'), c=back.split('\n');
  const diff=a.map((L,i)=>L===c[i]?null:`行${i+1}\n  元: 「${L}」\n  後: 「${c[i]}」`).filter(Boolean);
  return diff.length? diff.join('\n') : '全行そのまま戻った';
}, [T]));
await b.close();
})();
