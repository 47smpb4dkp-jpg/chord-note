const {chromium}=require('playwright');
// firebase をまるごと差し替えて、アプリ本体の同期処理をそのまま動かす
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:900,height:800}});
  await ctx.addInitScript(()=>{
    let cb=null;
    window.__cloud={feed:null};
    const songsCol={
      onSnapshot:(a,bb)=>{ cb = (typeof a==='function')?a:bb;
        window.__cloud.feed=(docs)=>cb({docs, metadata:{hasPendingWrites:docs.some(d=>d.metadata.hasPendingWrites)}});
        return ()=>{}; },
      doc:(id)=>({id, set:async()=>{}, delete:async()=>{}})
    };
    const metaDoc={ onSnapshot:(a,bb)=>()=>{}, set:async()=>{} };
    const auth={
      onAuthStateChanged(f){ setTimeout(()=>f({uid:'u1', email:'miyoshi@example.com'}), 10); },
      getRedirectResult:async()=>({}),
      signOut:async()=>{}, currentUser:{uid:'u1',email:'miyoshi@example.com'},
      setPersistence:async()=>{}, signInWithPopup:async()=>({})
    };
    const store={
      collection:(n)=>({doc:()=>({
        collection:(m)=> m==='songs' ? songsCol : {doc:()=>metaDoc, onSnapshot:()=>()=>{}},
        set:async()=>{}, onSnapshot:()=>()=>{} })}),
      batch:()=>({set(){},delete(){},commit:async()=>{}}),
      enablePersistence:async()=>{}, waitForPendingWrites:async()=>{},
      terminate:async()=>{}, clearPersistence:async()=>{}
    };
    window.firebase={ apps:[], initializeApp(){ this.apps=[{}]; return {}; },
      auth:()=>auth, firestore:()=>store };
    window.firebase.auth.GoogleAuthProvider=function(){ this.addScope=()=>{}; };
    window.firebase.auth.Auth={Persistence:{LOCAL:'l'}};
    window.firebase.firestore.FieldValue={serverTimestamp:()=>0};
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html');
  await p.waitForTimeout(1200);
  console.log('同期が始まったか:', await p.evaluate(()=>!!window.__cloud.feed));
  const out = await p.evaluate(()=>{
    const log=[];
    const mk=(id,t,ex)=>Object.assign({id,title:t,text:'C G Am F\nあ',bpm:100,key:'C',capo:0,
      folder:'A',transpose:0,v:2,sv:2}, ex||{});
    const docOf=(o,pending)=>({id:o.id, data:()=>{const {id,...r}=o; return r;},
                               metadata:{hasPendingWrites:!!pending}});
    const feed=window.__cloud.feed;

    songs=[mk('a','手元の曲')]; pushed=new Map(); playlists=[];
    feed([docOf(mk('a','手元の曲')), docOf(mk('b','別端末で作った曲'))]);
    log.push('① 別端末の曲が入った: ' + songs.map(x=>x.title).join(','));

    songs.push(mk('c','これから送る曲'));
    feed([docOf(mk('a','手元の曲')), docOf(mk('b','別端末で作った曲')),
          docOf(mk('c','これから送る曲'), true), docOf(mk('d','もう1つ別端末の曲'))]);
    log.push('② 送信待ちがあっても届いた: ' + songs.map(x=>x.title).join(','));
    log.push('   送信待ちの数: ' + pendingWrites);

    songs=[mk('c','手元で直した名前')]; pushed=new Map();
    feed([docOf(mk('c','クラウドの古い名前'), true)]);
    log.push('③ 送信待ちの曲は上書きされない: ' + songs[0].title);

    songs=[mk('e','曲E')]; pushed=new Map([['e', snapOf(mk('e','曲E'))]]);
    songs[0].title='手元で直した曲E';
    feed([docOf(mk('e','曲E'))]);
    log.push('④ 送信前の直しが残る: ' + songs[0].title);

    songs=[mk('f','曲F',{plays:42})]; pushed=new Map();
    feed([docOf(mk('f','曲F'))]);
    log.push('⑤ 開いた回数が残る: ' + songs[0].plays);

    songs=[mk('g','曲G'),mk('h','曲H')];
    pushed=new Map([['g',snapOf(mk('g','曲G'))],['h',snapOf(mk('h','曲H'))]]);
    feed([docOf(mk('g','曲G'))]);
    log.push('⑥ ほかの端末で消された曲が消える: ' + songs.map(x=>x.title).join(','));

    songs=[mk('i','上げてない曲')]; pushed=new Map();
    feed([docOf(mk('j','クラウドの曲'))]);
    log.push('⑦ 未送信の曲が残る: ' + songs.map(x=>x.title).sort().join(','));
    return log.join('\n');
  });
  console.log(out);
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
