const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:820,height:1100},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html');
  await p.waitForTimeout(700);
  await p.evaluate(()=>{
    const mk=(id,t,g)=>{const s=parseSheet('C G Am F\nあいうえお');
      return Object.assign(s,{id,title:t,text:'C G Am F\nあいうえお',bpm:100,key:'C',capo:0,folder:g,transpose:0});};
    songs=[mk('a','あの日の歌','フォーク'),mk('b','夜明けのブルース','ブルース'),mk('c','三叉路','オリジナル')];
    playlists=[{id:'p1',name:'2026ライブ',songs:['a','b']},{id:'p2',name:'リハ用',songs:['c']}];
    openSong=null; tab='list'; render();
  });
  await p.waitForTimeout(400);
  await p.screenshot({path:'list1.png', fullPage:true});
  // スワイプしてみる
  // 手でドラッグ
  await p.evaluate(()=>{
    const el=document.querySelector('.swipe');
    const r=el.getBoundingClientRect();
    const mk=(type,x)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:r.top+r.height/2});
      el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}));};
    mk('touchstart', r.right-30); mk('touchmove', r.right-130); mk('touchmove', r.right-200); mk('touchend', r.right-200);
  });
  await p.waitForTimeout(400);
  await p.screenshot({path:'list2.png', fullPage:true});
  console.log('transform:', await p.locator('.swipe .swbody').first().evaluate(e=>e.style.transform));
  // セットリスト
  await p.evaluate(()=>{ tab='pl'; openList=null; render(); });
  await p.waitForTimeout(300);
  await p.evaluate(()=>{
    const el=document.querySelectorAll('.swipe')[0];
    const r=el.getBoundingClientRect();
    const mk=(type,x)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:r.top+r.height/2});
      el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}));};
    mk('touchstart', r.left+30); mk('touchmove', r.left+130); mk('touchmove', r.left+200); mk('touchend', r.left+200);
  });
  await p.waitForTimeout(400);
  await p.screenshot({path:'pl1.png', fullPage:true});
  console.log('errs', errs);
  await b.close();
})();
