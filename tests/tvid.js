const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const ctx=await b.newContext({viewport:{width:980,height:950},permissions:['camera','microphone']});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(700);
  // ドライブの通信を差し替える
  await p.evaluate(()=>{
    const t='C  G  Am  F\nあさのひかり';
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'朝',artist:'長渕剛',text:t,bpm:100,key:'C',capo:0,folder:'フォーク',transpose:0});
    songs=[s]; playlists=[]; tab='list'; openSong=null; render();
    driveState='on'; driveToken='FAKE'; driveRootId='ROOT';
    window._up=[];
    const realFetch = window.fetch;
    window.fetch = async (u, o)=>{
      u = String(u);
      if (u.indexOf('drive/v3/files?q=') >= 0)
        return new Response(JSON.stringify({files:[{id:'VIDFOLDER',name:'_動画'}]}),{status:200});
      if (u.indexOf('uploadType=resumable') >= 0){
        window._up.push({meta: JSON.parse(o.body), len: o.headers['X-Upload-Content-Length']});
        return new Response('', {status:200, headers:{Location:'https://upload.example/session'}});
      }
      if (u.indexOf('upload.example') >= 0){
        window._up.push({bytes: o.body.size, type: o.body.type});
        return new Response(JSON.stringify({id:'VID1', name:'x', webViewLink:'https://drive/x'}),{status:200});
      }
      return realFetch(u, o);
    };
    openSongView('a','list');
  });
  await p.waitForTimeout(400);
  await p.evaluate(()=>openSongMenu()); await p.waitForTimeout(250);
  console.log('メニュー:\n'+await p.locator('#popGrid').innerText());
  await p.screenshot({path:'v0.png'});
  await p.locator('.mnb', {hasText:'動画を録る'}).click(); await p.waitForTimeout(2200);
  console.log('録画中?', await p.locator('#vidbox').count(), '/ 時計:', await p.locator('#vidTime').innerText());
  await p.screenshot({path:'v1.png'});
  // 隠す
  await p.locator('#vidEye').click(); await p.waitForTimeout(250);
  console.log('最小化:', await p.locator('#vidbox').getAttribute('class'), '/ プレビュー見える:', await p.locator('#vidPrev').isVisible());
  await p.screenshot({path:'v2.png'});
  await p.waitForTimeout(1500);
  await p.locator('#vidbar .stop').click();
  await p.waitForTimeout(2500);
  console.log('アップロード:', await p.evaluate(()=>JSON.stringify(window._up)));
  console.log('曲に残った記録:', await p.evaluate(()=>JSON.stringify(songs[0].videos)));
  console.log('箱は消えた:', await p.locator('#vidbox').count()===0);
  await p.evaluate(()=>openSongMenu()); await p.waitForTimeout(250);
  console.log('メニュー後:\n'+await p.locator('#popGrid').innerText());
  await p.locator('.mnb', {hasText:'録った動画'}).click(); await p.waitForTimeout(300);
  console.log('一覧:\n'+await p.locator('#popGrid').innerText());
  await p.screenshot({path:'v3.png'});
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
