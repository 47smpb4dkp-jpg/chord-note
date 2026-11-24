const {chromium}=require('playwright');
// 「よく使う」の回数が、同期のつなぎ直しや別タブの書き戻しで消えないかを確かめる
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

  let bad=0;
  const ok=(name,got,want)=>{ const good=String(got)===String(want);
    if(!good) bad++; console.log((good?'OK  ':'NG  ')+name+' → '+got+(good?'':' （期待 '+want+'）')); };

  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8899/index.html');
  await p.waitForTimeout(900);

  const r1 = await p.evaluate(()=>{
    const mk=(id,t,ex)=>Object.assign({id,title:t,text:'C G Am F\nあ',bpm:100,key:'C',capo:0,
      folder:'A',transpose:0,v:2,sv:2}, ex||{});
    const docOf=(o,pending)=>({id:o.id, data:()=>{const {id,...r}=o; return r;},
                               metadata:{hasPendingWrites:!!pending}});
    const feed=window.__cloud.feed;
    const o={};
    localStorage.removeItem('cn_plays');

    // ① 曲を開くと回数が増え、置き場にも入る
    songs=[mk('a','曲A'),mk('b','曲B')]; pushed=new Map(); playlists=[];
    bumpPlays(songs[0]); bumpPlays(songs[0]); bumpPlays(songs[1]);
    o.step1 = songs[0].plays+'/'+songs[1].plays;
    o.store1 = JSON.stringify(Object.keys(loadPlays()).sort());

    // ② 同期でクラウドの中身に入れ替わっても回数が残る
    feed([docOf(mk('a','曲A')), docOf(mk('b','曲B'))]);
    o.step2 = songs.find(x=>x.id==='a').plays+'/'+songs.find(x=>x.id==='b').plays;

    // ③ 古い一覧を持った別タブがそのまま書き戻しても消えない
    //    （手元の songs を回数ゼロの状態に戻してから同期を受ける）
    songs=[mk('a','曲A'),mk('b','曲B')]; pushed=new Map();
    feed([docOf(mk('a','曲A')), docOf(mk('b','曲B'))]);
    o.step3 = songs.find(x=>x.id==='a').plays+'/'+songs.find(x=>x.id==='b').plays;

    // ④ 1曲足すとき、ほかの曲の記録を消さない
    savePlays({a:[2,1],b:[1,1],z:[9,1]});
    songs=[mk('a','曲A',{plays:2})];
    bumpPlays(songs[0]);
    o.step4 = JSON.stringify(loadPlays());

    // ⑤ クラウドには回数を送らない
    o.step5 = JSON.stringify(forCloud(mk('a','曲A',{plays:7,lastOpen:123})));

    // ⑥ 同じ曲の別バージョンぶんを合わせて数える
    songs=[mk('v1','君が思い出になる前に',{vgroup:'g1',plays:3}),
           mk('v2','君が思い出になる前に',{vgroup:'g1',plays:4})];
    o.step6 = playsOf(songs[0])+'/'+playsOf(songs[1]);

    // ⑦ 消した曲の記録は置き場から外れる
    savePlays({a:[1,1],b:[2,2]});
    forgetPlays(['a']);
    o.step7 = JSON.stringify(Object.keys(loadPlays()));

    // ⑧ 次の読み込み用に記録を置いておく
    songs=[mk('a','曲A'),mk('b','曲B')];
    savePlays({a:[11,1000],b:[22,2000]});
    localStorage.setItem('cn_songs', JSON.stringify(songs));   // 回数ゼロの一覧
    return o;
  });
  ok('① 開いた回数が増える', r1.step1, '2/1');
  ok('① 端末の置き場に入る', r1.store1, '["a","b"]');
  ok('② 同期でクラウドに入れ替わっても残る', r1.step2, '2/1');
  ok('③ 古い一覧の書き戻しでも消えない', r1.step3, '2/1');
  ok('④ ほかの曲の記録を消さない', r1.step4, '{"a":[3,'+JSON.parse(r1.step4).a[1]+'],"b":[1,1],"z":[9,1]}');
  ok('⑤ クラウドには送らない', r1.step5.includes('plays')||r1.step5.includes('lastOpen'), 'false');
  ok('⑥ 別バージョンぶんを合わせる', r1.step6, '7/7');
  ok('⑦ 消した曲の記録が外れる', r1.step7, '["b"]');

  // ⑨ 開き直し（回数ゼロの一覧が入っていても置き場から戻る）
  const p2=await ctx.newPage();
  p2.on('pageerror',e=>errs.push(e.message));
  await p2.goto('http://localhost:8899/index.html');
  await p2.waitForTimeout(900);
  const r2 = await p2.evaluate(()=>songs.filter(x=>x.id==='a'||x.id==='b')
    .map(x=>x.id+':'+(x.plays||0)).sort().join(','));
  ok('⑨ 開き直しても回数が戻る', r2, 'a:11,b:22');

  console.log(errs.length?('PAGEERROR '+errs.join(' | ')):'ページエラーなし');
  console.log(bad?('失敗 '+bad+' 件'):'すべて通りました');
  await b.close();
  process.exit(bad||errs.length?1:0);
})();
