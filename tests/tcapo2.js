const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950},deviceScaleFactor:2,hasTouch:true,isMobile:true});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);
await pg.evaluate(()=>{
  // 原曲 F、カポ3、譜面は D の形で書いてある
  const t="D        A        Bm       G\nきみのこえがきこえる";
  const s=parseSheet(t);
  Object.assign(s,{id:'f1',title:'Fの曲',text:t,key:'F',capo:3,bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; playlists=[]; openSong=null; tab='list'; render(); openSongView('f1','list');
});
await pg.waitForTimeout(400);
const look = ()=>pg.evaluate(()=>({
  Key: document.querySelector('.chipbtn b').textContent,
  Capo: document.querySelectorAll('.chipbtn b')[1].textContent,
  コード: [...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean).join(' ')
}));
console.log('=== はじめ（カポ3・譜面は D）===');
console.log(JSON.stringify(await look(),null,1));

for (const [label, times] of [['カポ ＋1 → 4',1],['カポ ＋1 → 5',1],['カポ −5 → 0',-5],['カポ ＋3 → 3（元に戻す）',3]]){
  await pg.evaluate((t)=>{ for(let i=0;i<Math.abs(t);i++) capo(t>0?1:-1); }, times);
  await pg.waitForTimeout(250);
  const r = await look();
  console.log(`\n--- ${label} ---`);
  console.log(`Key=${r.Key}（動かない）  コード: ${r.コード}`);
  console.log(`帯: ${r.帯}`);
}

console.log('\n=== 検算 ===');
console.log(await pg.evaluate(()=>{
  const s=songs[0]; const out=[];
  for (const c of [0,1,2,3,4,5,7]){
    s.capo=c;
    const shift=shiftOf(s);
    out.push(`カポ${String(c).padStart(2)} → 押さえ方 ${playKeyOf(s).padEnd(3)} / 鳴る音 ${soundKeyOf(s)} / ずらし ${shift>=0?'+':''}${shift}`);
  }
  s.capo=3;
  return out.join('\n');
}));

console.log('\n=== 移調（Key ±）はちゃんと鳴る音を変えるか ===');
await pg.evaluate(()=>{ const s=songs[0]; s.capo=3; s.textCapo=3; s.transpose=0; render(); tr(2); });
await pg.waitForTimeout(250);
console.log(JSON.stringify(await look(),null,1));
await pg.screenshot({path:'capo2.png',clip:{x:0,y:0,width:430,height:420}});
await b.close();
})();
