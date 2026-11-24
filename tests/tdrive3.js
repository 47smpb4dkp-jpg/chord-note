const { chromium } = require('playwright');
// ドライブ側をまねて、フォルダ移動・名前変更・新規作成が本当に起きるか調べる。
// 一覧の応答に parents を入れない場合（実機で起きうる）も試す。
async function run(withParents){
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:430,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+__dirname+'/../index.html');
  await pg.waitForTimeout(800);
  await pg.evaluate(wp=>{
    window._wp = wp;
    window._drive={files:{},next:1,calls:[]};
    const mk=(name,parent,mime,body,props)=>{const id='f'+(_drive.next++);
      _drive.files[id]={id,name,parents:[parent],mimeType:mime||'text/markdown',body:body||'',appProperties:props||{}};return id;};
    const view=f=>{const o={id:f.id,name:f.name,appProperties:f.appProperties};
      if(_wp) o.parents=f.parents.slice(); return o;};   // ここで parents を出すか決める
    window.fetch=async(url,opts)=>{
      opts=opts||{};
      const auth=(opts.headers||{}).Authorization||'';
      if(!/^Bearer /.test(auth)) return {status:401,ok:false,json:async()=>({error:{message:'no auth'}})};
      const U=new URL(url); const ok=v=>({status:200,ok:true,json:async()=>v,text:async()=>v});
      _drive.calls.push((opts.method||'GET')+' '+U.pathname+U.search);
      // 書き込み（本文つき）
      if(U.pathname.includes('/upload/drive/v3/files')){
        const body=String(opts.body||'');
        const meta=JSON.parse((body.match(/\{[\s\S]*?\}(?=\r\n--)/)||['{}'])[0]);
        const content=body.split('\r\n\r\n').slice(2).join('\r\n\r\n').replace(/\r\n--.*--$/,'');
        const add=U.searchParams.get('addParents'), rm=U.searchParams.get('removeParents');
        if(opts.method==='PATCH'){
          const id=U.pathname.split('/').pop(); const f=_drive.files[id];
          if(!f) return {status:404,ok:false,json:async()=>({error:{message:'nf'}})};
          f.body=content;
          if(meta.name) f.name=meta.name;
          if(meta.appProperties) f.appProperties=Object.assign(f.appProperties||{},meta.appProperties);
          if(meta.parents) return {status:400,ok:false,json:async()=>({error:{message:"parents は PATCH で渡せません"}})};
          if(rm){ const gone=rm.split(','); f.parents=f.parents.filter(p=>!gone.includes(p)); }
          if(add){ if(!f.parents.includes(add)) f.parents.push(add); }
          return ok(view(f));
        }
        return ok({id:mk(meta.name,(meta.parents||['root'])[0],'text/markdown',content,meta.appProperties)});
      }
      // 1件だけ見る（parents を聞き直すとき）
      const one=/^\/drive\/v3\/files\/([^/]+)$/.exec(U.pathname);
      if(one && (opts.method||'GET')==='GET'){
        const f=_drive.files[one[1]]; if(!f) return {status:404,ok:false,json:async()=>({error:{message:'nf'}})};
        return ok({id:f.id,name:f.name,parents:f.parents.slice()});
      }
      if(one && opts.method==='PATCH'){
        const f=_drive.files[one[1]];
        if(f){ const m=JSON.parse(opts.body||'{}');
          if(m.name)f.name=m.name;
          if(m.appProperties)f.appProperties=Object.assign(f.appProperties||{},m.appProperties);
          if(m.trashed)f.trashed=true;
          const add=U.searchParams.get('addParents'), rm=U.searchParams.get('removeParents');
          if(rm){ const gone=rm.split(','); f.parents=f.parents.filter(p=>!gone.includes(p)); }
          if(add&&!f.parents.includes(add)) f.parents.push(add); }
        return ok({id:one[1]});
      }
      if(U.searchParams.get('alt')==='media'){const id=U.pathname.split('/').pop();
        return {status:200,ok:true,text:async()=>(_drive.files[id]||{}).body||''};}
      if(U.pathname.endsWith('/files')&&(opts.method||'GET')==='GET'){
        const q=U.searchParams.get('q')||'';
        const nm=(q.match(/name='([^']*)'/)||[])[1];
        const par=(q.match(/'([^']*)' in parents/)||[])[1];
        const tag=(q.match(/value='([^']*)'/)||[])[1];
        const anyTag=/value!=''/.test(q);
        const wantF=/mimeType='application\/vnd\.google-apps\.folder'/.test(q);
        const notF=/mimeType!='application\/vnd\.google-apps\.folder'/.test(q);
        const files=Object.values(_drive.files).filter(f=>!f.trashed&&
          (!nm||f.name===nm)&&(!par||f.parents.includes(par))&&
          (!wantF||f.mimeType.includes('folder'))&&(!notF||!f.mimeType.includes('folder'))&&
          (!tag||(f.appProperties||{}).cnId===tag)&&(!anyTag||!!(f.appProperties||{}).cnId));
        return ok({files:files.map(view)});
      }
      if(U.pathname.endsWith('/files')&&opts.method==='POST'){
        const m=JSON.parse(opts.body);
        return ok({id:mk(m.name,(m.parents||['root'])[0],m.mimeType)});
      }
      return {status:404,ok:false,json:async()=>({error:{message:'nf'}})};
    };
    rememberDriveToken('TOKEN'); driveState='on'; driveRootId=null;
    const mks=(id,t,g)=>{const txt='C G Am F\nあ'; const s=parseSheet(txt);
      return Object.assign(s,{id,title:t,text:txt,bpm:100,key:'C',capo:0,folder:g,transpose:0,v:2,sv:2});};
    songs=[mks('s1','フラグメント','オリジナル'),mks('s2','夜明け','オリジナル')];
    playlists=[]; drivePushed=new Map();
  }, withParents);

  const tree=async()=>pg.evaluate(()=>{
    const nm=id=>(_drive.files[id]||{}).name||'root';
    return Object.values(_drive.files).filter(f=>!f.trashed&&!f.mimeType.includes('folder'))
      .map(f=>nm(f.parents[0])+'/'+f.name).sort().join('\n');
  });
  console.log(`\n========== 一覧の応答に parents を ${withParents?'入れる':'入れない'} ==========`);
  await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(900);
  console.log('① はじめの書き出し\n'+await tree());
  console.log('  しらせ:', await pg.evaluate(()=>driveLastNote));

  // ジャンルを変える
  await pg.evaluate(()=>{ songs[0].folder='フォーク'; });
  await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(900);
  console.log('② ジャンルをフォークに変えた\n'+await tree());
  console.log('  しらせ:', await pg.evaluate(()=>driveLastNote));

  // 曲名を変える
  await pg.evaluate(()=>{ songs[0].title='フラグメント（改訂）'; });
  await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(900);
  console.log('③ 曲名を変えた\n'+await tree());
  console.log('  しらせ:', await pg.evaluate(()=>driveLastNote));

  // ジャンルと曲名を同時に
  await pg.evaluate(()=>{ songs[1].folder='ロック'; songs[1].title='夜明けのブルース'; });
  await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(900);
  console.log('④ ジャンルと曲名を同時に変えた\n'+await tree());
  console.log('  しらせ:', await pg.evaluate(()=>driveLastNote));

  // 曲を消す
  await pg.evaluate(()=>{ songs=[songs[0]]; });
  await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(900);
  console.log('⑤ 曲を消した\n'+await tree());
  console.log('  しらせ:', await pg.evaluate(()=>driveLastNote));
  console.log('  ゴミ箱:', await pg.evaluate(()=>Object.values(_drive.files).filter(f=>f.trashed).map(f=>f.name).join(',')||'なし'));
  console.log('  中身が新しいか:', await pg.evaluate(()=>{
    const f=Object.values(_drive.files).find(x=>!x.trashed&&/改訂/.test(x.name));
    return f && /title: フラグメント（改訂）/.test(f.body) ? 'OK' : 'NG: '+(f?f.body.slice(0,60):'なし');
  }));
  // 開き直しても全曲を送り直さないか（覚えた内容が端末に残っているか）
  const saved = await pg.evaluate(()=>localStorage.getItem('cn_drivepushed'));
  console.log('  覚えた件数:', saved ? Object.keys(JSON.parse(saved)).length : 0);
  await pg.evaluate(()=>{ drivePushed = loadDrivePushed(); _drive.calls=[]; });
  await pg.evaluate(()=>runDriveBackup(false)); await pg.waitForTimeout(700);
  console.log('  開き直して「変わった曲だけ」→ 書き込み回数:',
    await pg.evaluate(()=>_drive.calls.filter(c=>/upload/.test(c)).length), '（0ならOK）');
  console.log('  しらせ:', await pg.evaluate(()=>driveLastNote));
  // 1曲だけ直したら1曲だけ送る
  await pg.evaluate(()=>{ songs[0].title='さらに改訂'; _drive.calls=[]; });
  await pg.evaluate(()=>runDriveBackup(false)); await pg.waitForTimeout(700);
  console.log('  1曲直して → 書き込み回数:',
    await pg.evaluate(()=>_drive.calls.filter(c=>/upload/.test(c)).length), '（1ならOK）');

  // 設定画面に「終わりました」が出るか
  await pg.evaluate(()=>{ tab='list'; openSong=null; toggleSettings(); });
  await pg.waitForTimeout(900);
  const t=(await pg.locator('#driveBox').innerText()).replace(/\n/g,' | ');
  console.log('  ドライブ欄:', t.match(/書き出し[^|]*/)?t.match(/書き出しが終わりました[^|]*/)||'(表示なし)':'(表示なし)');
  console.log('ページ例外:', errs.length?errs.join(' / '):'なし');
  await b.close();
}
(async()=>{ await run(true); await run(false); })();
