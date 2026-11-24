const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950},deviceScaleFactor:2,hasTouch:true,isMobile:true});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);

console.log('=== 三好さんが挙げた例 ===');
console.log(await pg.evaluate(()=>{
  const f=(k,c)=>`鳴る音 ${k} ＋ カポ${c} → 押さえ方 ${shiftKey(k,-c)}`;
  return [f('Em',2), f('C',3)].join('\n');
}));

console.log('\n=== ほかの組み合わせ ===');
console.log(await pg.evaluate(()=>{
  const cases=[['D',2],['A',2],['B♭',3],['F',1],['E♭',3],['Am',5],['F#m',2],['G',7],['C',0]];
  return cases.map(([k,c])=>`${k} + カポ${c} → ${shiftKey(k,-c)}`).join('\n');
}));

console.log('\n=== 戻る向きも合うか（押さえ方＋カポ＝鳴る音）===');
console.log(await pg.evaluate(()=>{
  const cases=[['Em',2],['C',3],['B♭',3],['F#m',2]];
  return cases.map(([k,c])=>{
    const play=shiftKey(k,-c), back=shiftKey(play,c);
    return `${k} → 押さえ方${play} → 戻すと${back}  ${back===k||pc(normTok(back).replace(/m$/,''))===pc(normTok(k).replace(/m$/,''))?'OK':'✗'}`;
  }).join('\n');
}));

// 実際の曲画面
await pg.evaluate(()=>{
  const t="Em              Bm\nきみのこえがきこえる\nC               D\nよあけのまちで";
  const s=parseSheet(t);
  Object.assign(s,{id:'x1',title:'テスト',text:t,key:'Em',capo:2,bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; playlists=[]; openSong=null; tab='list'; render(); openSongView('x1','list');
});
await pg.waitForTimeout(400);
console.log('\n=== 曲画面（カポ2、Em の曲）===');
console.log(await pg.evaluate(()=>{
  const row=document.querySelector('.caporow');
  return 'ヘッダー: '+document.querySelector('.chipbtn b').textContent
    +'\n帯: '+(row?row.textContent.replace(/\s+/g,' ').trim():'(なし)')
    +'\nコード: '+[...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean).join(' ');
}));

console.log('\n--- カポを選ぶ ---');
await pg.evaluate(()=>{ openCapo(); });
await pg.waitForTimeout(350);
console.log(await pg.evaluate(()=>document.getElementById('popDesc').textContent));
console.log(await pg.evaluate(()=>[...document.querySelectorAll('.capor')].map(r=>
  (r.classList.contains('on')?'● ':'  ')+r.textContent.replace(/\s+/g,' ').trim()).join('\n')));
await pg.screenshot({path:'capo.png',clip:{x:0,y:0,width:430,height:780}});

console.log('\n--- カポ5 を選ぶ ---');
await pg.click('.capor:nth-child(6)');
await pg.waitForTimeout(350);
console.log(await pg.evaluate(()=>{
  const b=[...document.querySelectorAll('.chipbtn b')];
  return 'Key '+b[0].textContent+' / Capo '+b[1].textContent
    +'\nコード: '+[...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean).join(' ');
}));
await b.close();
})();
