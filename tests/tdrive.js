const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);

// Google ドライブのふりをする
await pg.evaluate(()=>{
  window._drive = {files:{}, next:1, calls:[]};
  const mk=(name,parent,mime,body)=>{ const id='f'+(_drive.next++);
    _drive.files[id]={id,name,parents:[parent],mimeType:mime||'text/markdown',body:body||'',appProperties:{}}; return id; };
  window._mkFile = mk;
  window.fetch = async (url, opts)=>{
    opts = opts || {};
    _drive.calls.push((opts.method||'GET')+' '+url.split('?')[0].replace('https://www.googleapis.com',''));
    const auth = (opts.headers||{}).Authorization||'';
    if (!/^Bearer /.test(auth)) return {status:401, ok:false, json:async()=>({error:{message:'no auth'}})};
    if (auth === 'Bearer EXPIRED') return {status:401, ok:false, json:async()=>({error:{message:'expired'}})};
    const U = new URL(url);
    const ok = v => ({status:200, ok:true, json:async()=>v, text:async()=>v});
    if (U.pathname.includes('/upload/drive/v3/files')){
      const body = String(opts.body||'');
      const meta = JSON.parse((body.match(/\{[\s\S]*?\}(?=\r\n--)/)||['{}'])[0]);
      const content = body.split('\r\n\r\n').slice(2).join('\r\n\r\n').replace(/\r\n--.*--$/,'');
      if (opts.method==='PATCH'){
        const id = U.pathname.split('/').pop();
        if (_drive.files[id]) _drive.files[id].body = content;
        return ok({id});
      }
      const nid = mk(meta.name, (meta.parents||['root'])[0], 'text/markdown', content);
      if (meta.appProperties) _drive.files[nid].appProperties = meta.appProperties;
      return ok({id: nid});
    }
    if (U.pathname.endsWith('/files') && (opts.method||'GET')==='GET'){
      const q = U.searchParams.get('q')||'';
      const nm = (q.match(/name='([^']*)'/)||[])[1];
      const par = (q.match(/'([^']*)' in parents/)||[])[1];
      const wantFolder = /mimeType='application\/vnd\.google-apps\.folder'/.test(q);
      const notFolder = /mimeType!='application\/vnd\.google-apps\.folder'/.test(q);
      const tag=(q.match(/value='([^']*)'/)||[])[1];
      const anyTag=/value!=''/.test(q);
      const files = Object.values(_drive.files).filter(f=> !f.trashed &&
        (!tag || (f.appProperties||{}).cnId===tag) && (!anyTag || !!(f.appProperties||{}).cnId) &&
        (!nm || f.name===nm) && (!par || f.parents.includes(par)) &&
        (!wantFolder || f.mimeType==='application/vnd.google-apps.folder') &&
        (!notFolder || f.mimeType!=='application/vnd.google-apps.folder'));
      return ok({files: files.map(f=>({id:f.id,name:f.name,parents:(f.parents||[]).slice(),appProperties:f.appProperties||{}}))});
    }
    if (U.pathname.endsWith('/files') && opts.method==='POST'){
      const m = JSON.parse(opts.body);
      return ok({id: mk(m.name, (m.parents||['root'])[0], m.mimeType)});
    }
    if (U.pathname.startsWith('/drive/v3/files/') && opts.method==='PATCH'){
      const id=U.pathname.split('/').pop(); const f=_drive.files[id];
      if(f){ const m=JSON.parse(opts.body||'{}');
        if(m.name)f.name=m.name;
        if(m.appProperties)f.appProperties=Object.assign(f.appProperties||{},m.appProperties);
        if(m.trashed)f.trashed=true;
        const add2=U.searchParams.get('addParents'), rm=U.searchParams.get('removeParents');
        if(add2){ f.parents=f.parents.filter(p=>p!==rm); f.parents.push(add2); } }
      return ok({id});
    }
    if (U.searchParams.get('alt')==='media'){
      const id = U.pathname.split('/').pop();
      return {status:200, ok:true, text:async()=>(_drive.files[id]||{}).body||''};
    }
    return {status:404, ok:false, json:async()=>({error:{message:'not found'}})};
  };
  // つながった状態にする
  rememberDriveToken('TOKEN'); driveState='on'; driveRootId=null;
  try{ localStorage.setItem('cn_drive','on'); }catch(e){}
  const mks=(id,t,g,k,c,txt)=>{const s=parseSheet(txt);
    Object.assign(s,{id,title:t,folder:g,key:k,capo:c,textCapo:c,text:s.body,bpm:100,barsPerLine:8,transpose:0,plays:0}); return s;};
  songs=[mks('a','フラグメント','オリジナル','F',3,"D   A   Bm  G\nきみのこえ"),
         mks('b','夜明け','オリジナル','C',0,"C G Am F\nあさのひかり"),
         mks('c','ロックの曲','ロック','G',0,"G D Em C\nさけびごえ")];
  songs[0].vname='女性キー';
  playlists=[]; openSong=null; tab='list';
});

console.log('=== 全部書き出す ===');
await pg.evaluate(()=>runDriveBackup(true));
await pg.waitForTimeout(1200);
console.log(await pg.evaluate(()=>{
  const byId=_drive.files;
  const name=id=>byId[id]?byId[id].name:'?';
  return Object.values(byId).map(f=>
    (f.mimeType.includes('folder')?'[フォルダ] ':'  ')+
    (f.parents[0]==='root'?'':name(f.parents[0])+'/')+f.name).sort().join('\n');
}));
console.log('失敗の理由:', await pg.evaluate(()=>typeof lastDriveErr!=='undefined'?(lastDriveErr||'(なし)'):'(なし)'));
console.log('書き出し状態:', await pg.evaluate(()=>`state=${driveState} error=${driveError||'なし'} 済み=${drivePushed.size}`));

console.log('\n=== 中身の確認（1曲目）===');
console.log(await pg.evaluate(()=>{
  const f=Object.values(_drive.files).find(x=>/フラグメント/.test(x.name));
  return f ? f.name+'\n'+f.body.split('\n').slice(0,8).join('\n') : '(無い)';
}));

console.log('\n=== 変えた曲だけ送るか ===');
await pg.evaluate(()=>{ _drive.calls=[]; songs[1].text="C G Am F\nあさのひかり（直した）"; });
await pg.evaluate(()=>runDriveBackup(false));
await pg.waitForTimeout(1000);
console.log(await pg.evaluate(()=>{
  const up=_drive.calls.filter(c=>/upload/.test(c)).length;
  return `アップロード回数: ${up}（1ならOK）`;
}));

console.log('\n=== 読み戻す ===');
await pg.evaluate(()=>{ songs=[]; batch=[]; });
await pg.evaluate(()=>driveRestore());
await pg.waitForTimeout(1500);
console.log(await pg.evaluate(()=>batch.map(x=>
  x.ok?`OK ${x.title} [${x.folder}] key=${x.key||'-'} capo=${x.capo} ver=${x.vname||'-'}`:`NG ${x.name}`).join('\n')));

console.log('\n=== 鍵が切れたとき ===');
await pg.evaluate(()=>{ rememberDriveToken('EXPIRED'); driveState='on'; driveError=''; songs=[{id:'z',title:'t',text:'C\nあ',folder:'x',key:'C',capo:0,bpm:100,barsPerLine:8,transpose:0}]; drivePushed=new Map(); });
await pg.evaluate(()=>runDriveBackup(true));
await pg.waitForTimeout(900);
console.log(await pg.evaluate(()=>`state=${driveState} / ${driveError}`));
console.log('\nページ例外:', errs.length?errs.join(' / '):'なし');
await b.close();
})();
