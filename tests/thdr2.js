const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    const mk=(id,t,a,g)=>{const t2='C G Am F\nあいうえお';const s=parseSheet(t2);
      return Object.assign(s,{id,title:t,artist:a,text:t2,bpm:100,key:'C',capo:0,folder:g,transpose:0});};
    songs=[mk('a','あの日の歌','長渕剛','フォーク'),mk('b','夜明け','長渕剛','ブルース'),
           mk('c','三叉路','三叉路','オリジナル'),mk('d','乾杯','長渕剛','フォーク')];
    playlists=[{id:'p1',name:'2026ライブ',songs:['a','c']}];
    folderFilter=null; groupMode='folder'; tab='list'; openSong=null; render();
  });
  await p.waitForTimeout(300);
  const sub = async ()=> (await p.locator('.hdr-sub2').innerText()).replace(/\n/g,' ');
  await p.evaluate(()=>openSongView('a','list')); await p.waitForTimeout(250);
  console.log('すべて     :', await sub());
  await p.evaluate(()=>{ go('list'); setFolder('フォーク'); }); await p.waitForTimeout(250);
  await p.evaluate(()=>openSongView('a','list')); await p.waitForTimeout(250);
  console.log('ジャンル絞り:', await sub());
  await p.evaluate(()=>{ go('list'); setGroupMode('artist'); setFolder('長渕剛'); }); await p.waitForTimeout(250);
  await p.evaluate(()=>openSongView('b','list')); await p.waitForTimeout(250);
  console.log('作者絞り   :', await sub());
  await p.evaluate(()=>{ go('list'); setFolder('fav'); }); await p.waitForTimeout(200);
  await p.evaluate(()=>{ toggleFav('c'); go('list'); }); await p.waitForTimeout(250);
  await p.evaluate(()=>openSongView('c','list')); await p.waitForTimeout(250);
  console.log('お気に入り :', await sub());
  await p.evaluate(()=>{ openSong=null; go('pl'); openPl('p1'); }); await p.waitForTimeout(250);
  await p.evaluate(()=>openSongView('c','pl')); await p.waitForTimeout(250);
  console.log('セットリスト:', await sub());
  await p.screenshot({path:'hdr2.png', clip:{x:0,y:0,width:900,height:200}});
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
