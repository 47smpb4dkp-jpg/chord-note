const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:900,height:800}});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(700);
console.log(await pg.evaluate(()=>{
  const t=(c,n)=>`${c} を ${n>=0?'+':''}${n} → ${transposeChord(c,n)}`;
  return [
    t('B♭m7',1), t('B♭m7',2), t('E♭',1), t('A♭add9',2),
    t('C',1), t('F#m7',1), t('Bb',1), t('G',3),
    t('B♭onD',1), t('D7onC／',1), t('D//',3)
  ].join('\n');
}));
console.log('\nキー:', await pg.evaluate(()=>
  [['B♭',-3],['E♭m',2],['G',3],['C',1],['A♭',-1]].map(([k,n])=>`${k} ${n>=0?'+':''}${n} → ${shiftKey(k,n)}`).join(' / ')));
await b.close();
})();
