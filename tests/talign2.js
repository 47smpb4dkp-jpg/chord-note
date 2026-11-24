const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:1050}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(800);
  const T='C       G       Am      F\nあさのひかりのなかできみがわらっている\n\nF    G    C\nきみ';
  await p.evaluate(t=>{
    const s=parseSheet(t);
    Object.assign(s,{id:'a',title:'朝',artist:'長渕剛',text:t,bpm:100,key:'C',capo:0,
      folder:'フォーク',transpose:0,v:2,sv:2});
    songs=[s]; playlists=[]; tab='list'; openSong=null; render(); editSong('a');
  }, T);
  await p.waitForTimeout(500);
  console.log('ボタン:', await p.locator('#prevAlign').innerText());
  const box=async()=>p.evaluate(()=>{
    const el=document.querySelector('#editPrev .aligned');
    const r=el.getBoundingClientRect(), pr=el.parentNode.getBoundingClientRect();
    return {ctr:el.classList.contains('ctr'),
            左余白:Math.round(r.left-pr.left), 右余白:Math.round(pr.right-r.right)};
  });
  console.log('左ぞろえ:', JSON.stringify(await box()));
  await p.screenshot({path:'al1.png', clip:{x:640,y:300,width:640,height:300}});
  await p.locator('#prevAlign').click(); await p.waitForTimeout(400);
  console.log('ボタン:', await p.locator('#prevAlign').innerText());
  console.log('中央   :', JSON.stringify(await box()));
  await p.screenshot({path:'al2.png', clip:{x:640,y:300,width:640,height:300}});
  // 入力しても保たれるか
  await p.locator('#eText').click();
  await p.keyboard.type('x');
  await p.waitForTimeout(400);
  console.log('入力後も中央:', JSON.stringify(await box()));
  // 曲画面でも同じ見え方か
  await p.locator('button.act', {hasText:'上書き保存'}).click(); await p.waitForTimeout(600);
  console.log('保存した設定:', await p.evaluate(()=>songs[0].sheetAlign));
  await p.evaluate(()=>openSongView('a','list')); await p.waitForTimeout(500);
  console.log('曲画面:', await p.evaluate(()=>{
    const el=document.querySelector('#sheet');
    const r=el.getBoundingClientRect(), pr=el.parentNode.getBoundingClientRect();
    return JSON.stringify({ctr:el.classList.contains('ctr'),
      左余白:Math.round(r.left-pr.left), 右余白:Math.round(pr.right-r.right)});
  }));
  await p.screenshot({path:'al3.png', clip:{x:0,y:150,width:1280,height:360}});
  console.log('errs', errs.filter(e=>e.startsWith('PAGEERROR')));
  await b.close();
})();
