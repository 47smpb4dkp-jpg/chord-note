const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);

await pg.evaluate(()=>{
  window._drive={files:{},next:1};
  const mk=(name,parent,mime,body,props)=>{const id='f'+(_drive.next++);
    _drive.files[id]={id,name,parents:[parent],mimeType:mime||'text/markdown',body:body||'',appProperties:props||{}};return id;};
  window.fetch=async(url,opts)=>{
    opts=opts||{};
    const auth=(opts.headers||{}).Authorization||'';
    if(!/^Bearer /.test(auth)) return {status:401,ok:false,json:async()=>({error:{message:'no auth'}})};
    const U=new URL(url); const ok=v=>({status:200,ok:true,json:async()=>v,text:async()=>v});
    if(U.pathname.includes('/upload/drive/v3/files')){
      const body=String(opts.body||'');
      const meta=JSON.parse((body.match(/\{[\s\S]*?\}(?=\r\n--)/)||['{}'])[0]);
      const content=body.split('\r\n\r\n').slice(2).join('\r\n\r\n').replace(/\r\n--.*--$/,'');
      if(opts.method==='PATCH'){const id=U.pathname.split('/').pop(); const f=_drive.files[id];
        if(f){ f.body=content;
          if(meta.name) f.name=meta.name;
          if(meta.appProperties) f.appProperties=Object.assign(f.appProperties||{},meta.appProperties);
          const add=U.searchParams.get('addParents'), rm=U.searchParams.get('removeParents');
          if(rm){ const gone=rm.split(','); f.parents=f.parents.filter(p=>!gone.includes(p)); }
          if(add&&!f.parents.includes(add)) f.parents.push(add); }
        return ok({id});}
      return ok({id:mk(meta.name,(meta.parents||['root'])[0],'text/markdown',content,meta.appProperties)});
    }
    if(U.pathname.startsWith('/drive/v3/files/')&&opts.method==='PATCH'){
      const id=U.pathname.split('/').pop(); const f=_drive.files[id];
      if(f){ const m=JSON.parse(opts.body||'{}');
        if(m.name)f.name=m.name;
        if(m.appProperties)f.appProperties=Object.assign(f.appProperties||{},m.appProperties);
        if(m.trashed)f.trashed=true;
        const add=U.searchParams.get('addParents'), rm=U.searchParams.get('removeParents');
        if(add){ f.parents=f.parents.filter(p=>p!==rm); f.parents.push(add); } }
      return ok({id});
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
        (!tag||(f.appProperties||{}).cnId===tag)&&
        (!anyTag||!!(f.appProperties||{}).cnId));
      return ok({files:files.map(f=>({id:f.id,name:f.name,parents:f.parents.slice(),appProperties:f.appProperties}))});
    }
    if(U.pathname.endsWith('/files')&&opts.method==='POST'){
      const m=JSON.parse(opts.body);
      return ok({id:mk(m.name,(m.parents||['root'])[0],m.mimeType)});
    }
    return {status:404,ok:false,json:async()=>({error:{message:'nf'}})};
  };
  rememberDriveToken('TOKEN'); driveState='on'; driveRootId=null;
  const mks=(id,t,g,txt)=>{const s=parseSheet(txt);
    Object.assign(s,{id,title:t,folder:g,key:'C',capo:0,text:s.body,bpm:100,barsPerLine:8,transpose:0,plays:0});return s;};
  songs=[mks('a','フラグメント','オリジナル',"C G Am F\nあ"),
         mks('b','夜明け','オリジナル',"C G\nい")];
  playlists=[]; openSong=null; tab='list';
});

const tree = ()=>pg.evaluate(()=>{
  const n=id=>_drive.files[id]?_drive.files[id].name:'';
  return Object.values(_drive.files).filter(f=>!f.trashed&&!f.mimeType.includes('folder'))
    .map(f=>(n(f.parents[0])?n(f.parents[0])+'/':'')+f.name+(f.appProperties.cnId?'':'  ←目印なし'))
    .sort().join('\n')||'(なし)';
});

console.log('=== ① 最初の書き出し ===');
await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(900);
console.log(await tree());

console.log('\n=== ② ジャンルを「オリジナル」→「フォーク」に変える ===');
await pg.evaluate(()=>{ songs[0].folder='フォーク'; });
await pg.evaluate(()=>runDriveBackup(false)); await pg.waitForTimeout(900);
console.log(await tree());

console.log('\n=== ③ 曲名を変える ===');
await pg.evaluate(()=>{ songs[0].title='フラグメント（改訂）'; });
await pg.evaluate(()=>runDriveBackup(false)); await pg.waitForTimeout(900);
console.log(await tree());

console.log('\n=== ④ バージョン名を付ける ===');
await pg.evaluate(()=>{ songs[0].vname='女性キー'; });
await pg.evaluate(()=>runDriveBackup(false)); await pg.waitForTimeout(900);
console.log(await tree());

console.log('\n=== ⑤ 曲を消して「いますぐ全部書き出す」 ===');
await pg.evaluate(()=>{ songs=songs.filter(x=>x.id!=='b'); });
await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(1200);
console.log(await tree());
console.log('ゴミ箱:', await pg.evaluate(()=>Object.values(_drive.files).filter(f=>f.trashed).map(f=>f.name).join(', ')||'(なし)'));

console.log('\n=== ⑥ いまのドライブの状態を再現（古い版が作った重複あり）===');
await pg.evaluate(async()=>{
  _drive.files={}; _drive.next=1; driveRootId=null; drivePushed=new Map();
  const root=await driveFindRoot();
  const a=await driveFolder('オリジナル',root), f=await driveFolder('フォーク',root);
  const put=(name,par,body)=>{const id='f'+(_drive.next++);
    _drive.files[id]={id,name,parents:[par],mimeType:'text/markdown',body,appProperties:{}};};
  // ジャンルを変えたせいで両方に残っている状態
  put('フラグメント（改訂） - 女性キー.md', a, 'ふるい内容');
  put('フラグメント（改訂） - 女性キー.md', f, 'ふるい内容');
  put('夜明け.md', a, 'ふるい内容');
  songs[0].folder='フォーク';
});
console.log('前:');
console.log(await tree());
await pg.evaluate(()=>runDriveBackup(true)); await pg.waitForTimeout(1500);
console.log('後:');
console.log(await pg.evaluate(()=>{
  const n=id=>_drive.files[id]?_drive.files[id].name:'';
  return Object.values(_drive.files).filter(f=>!f.mimeType.includes('folder'))
    .map(f=>(f.trashed?'[ゴミ箱] ':'')+(n(f.parents[0])?n(f.parents[0])+'/':'')+f.name)
    .sort().join('\n');
}));
console.log('中身:', await pg.evaluate(()=>{
  const f=Object.values(_drive.files).find(x=>/フラグメント/.test(x.name)&&!x.trashed&&
    _drive.files[x.parents[0]].name==='フォーク');
  return f? (/ふるい内容/.test(f.body)?'古いまま（NG）':'新しくなった（OK）'):'(無い)';
}));
console.log('トースト:', await pg.evaluate(()=>document.getElementById('shareToast').textContent));
console.log('\nページ例外:', errs.length?errs.join(' / '):'なし');
await b.close();
})();
