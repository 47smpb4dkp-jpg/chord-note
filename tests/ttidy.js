const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:900,height:950}});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);
console.log('=== カポ付きでキーが押さえ方のままの曲を見つけられるか ===');
console.log(await pg.evaluate(()=>{
  const mk=(id,title,key,capo,txt)=>{const s=parseSheet(txt);
    Object.assign(s,{id,title,key,capo,text:s.body,bpm:100,barsPerLine:8,transpose:0,plays:0}); return s;};
  songs=[
    // 譜面は D の形。カポ3 → 鳴る音は F。キー欄が D のままなのは誤り
    mk('a','Fの曲（キー欄が誤り）','D',3,"D        A        Bm       G\nあいうえお\nD        G        A        D\nかきくけこ"),
    // 正しく F が入っている曲（触らないはず）
    mk('b','Fの曲（正しい）','F',3,"D        A        Bm       G\nあいうえお\nD        G        A        D\nかきくけこ"),
    // カポなし（触らないはず）
    mk('c','カポなし','C',0,"C G Am F\nあいうえお"),
  ];
  playlists=[]; tidyRekey=false;
  return tidyPlan().map(x=>`${x.title}\n   ${x.why.join('\n   ')}`).join('\n') || '(変更なし)';
}));
console.log('\n=== 整理を実行 ===');
console.log(await pg.evaluate(()=>{ applyTidy();
  return songs.map(s=>`${s.title}: キー=${s.key} カポ=${s.capo}`).join('\n'); }));
console.log('\n=== もう一度かけても二重に上がらないか ===');
console.log(await pg.evaluate(()=>{
  const p=tidyPlan();
  applyTidy();
  return (p.length?'2回目に変更あり: '+p.length+'件':'2回目は変更なし（OK）')
   +'\n'+songs.map(s=>`${s.title}: キー=${s.key}`).join('\n');
}));
await b.close();
})();
