const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950},deviceScaleFactor:2,hasTouch:true,isMobile:true});
pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);
await pg.evaluate(()=>{
  const mk=(id,title,key,capo,txt)=>{const s=parseSheet(txt);
    Object.assign(s,{id,title,key,capo,text:s.body,bpm:100,barsPerLine:8,transpose:0,plays:0,folder:'オリジナル'});
    return s;};
  songs=[
    mk('a','フラグメント','C',0,"C G Am F\nきみのこえがきこえる\nよあけのまちで"),
    mk('b','フラグメント ','F',2,"F C Dm B♭\nきみのこえが きこえる\nよあけの街で"),       // 誤字・表記ゆれ
    mk('c','フラグメント（2015）','G',0,"G D Em C\nきみのこえがきこえる\nよあけのまちで"),
    mk('d','べつの曲','D',0,"D A Bm G\nぜんぜんちがう")];
  playlists=[]; tab='list'; openSong=null; selectMode=true;
  selected=new Set(['a','b','c']); render();
});
await pg.waitForTimeout(300);
console.log('まとめる前のリスト行数:', await pg.evaluate(()=>document.querySelectorAll('.songrow').length));
await pg.click('.selbar button:has-text("バージョンにまとめる")');
await pg.waitForTimeout(400);
console.log('\n--- 画面 ---');
console.log(await pg.evaluate(()=>document.getElementById('popName').textContent+'\n'+
  [...document.querySelectorAll('.mgr')].map(r=>r.textContent.replace(/\s+/g,' ').trim()).join('\n')));
await pg.screenshot({path:'merge.png',clip:{x:0,y:0,width:430,height:720}});

console.log('\n--- 2つ目を「もとの版」にしてみる ---');
await pg.evaluate(()=>setMergeBase('c'));
await pg.waitForTimeout(250);
console.log(await pg.evaluate(()=>[...document.querySelectorAll('.mgr')].map(r=>
  (r.classList.contains('on')?'★ ':'  ')+r.textContent.replace(/\s+/g,' ').trim().slice(0,60)).join('\n')));

console.log('\n--- 名前を入れてまとめる ---');
await pg.evaluate(()=>{ mergeName('a','2020年版'); mergeName('b','女性キー'); });
await pg.click('#popGrid button:has-text("まとめる")');
await pg.waitForTimeout(500);
console.log(await pg.evaluate(()=>songs.map(s=>
  `${s.title} [${s.vname||'-'}] group=${s.vgroup||'(なし)'} key=${s.key}`).join('\n')));
console.log('\nリスト行:', await pg.evaluate(()=>
  [...document.querySelectorAll('.songrow .nm')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join(' | ')));
console.log('トースト:', await pg.evaluate(()=>document.getElementById('shareToast').textContent));
console.log('\n曲を開いたときのバージョンボタン:');
await pg.evaluate(()=>{ const r=groupReps().find(x=>x.title.includes('フラグメント')); openSongView(r.id,'list'); });
await pg.waitForTimeout(300);
console.log(await pg.evaluate(()=>[...document.querySelectorAll('.vb')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join(' | ')));
await b.close();
})();
