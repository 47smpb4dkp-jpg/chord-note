const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950}});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);
console.log(await pg.evaluate(()=>{
  // 鳴る音で書いてある譜面：キーも譜面も D でそろっている
  const t="D        A        Bm       G\nあいうえお";
  const s=parseSheet(t);
  Object.assign(s,{id:'s1',title:'Dの曲',text:t,key:'D',capo:0,capoBase:'sound',bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; playlists=[]; openSong=null; tab='list'; render(); openSongView('s1','list');
  const out=[];
  for (const c of [0,2,5]){
    s.capo=c; render();
    out.push(`カポ${c}: 鳴る音 ${soundKeyOf(s)} / 押さえ方 ${playKeyOf(s)} / コード `
      + [...document.querySelectorAll('#sheet .sc')].map(e=>e.textContent.trim()).filter(Boolean).join(' '));
  }
  return out.join('\n');
}));
await b.close();
})();
