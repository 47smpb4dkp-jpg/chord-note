const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:430,height:950},hasTouch:true,isMobile:true});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+__dirname+'/../index.html');
await pg.waitForTimeout(800);

const BODY = "C        G        Am       F\nきみのこえがきこえる\nDm       G7       C\nよあけのまちで";
await pg.evaluate((t)=>{
  const s=parseSheet(t);
  Object.assign(s,{id:'a',title:'フラグメント',text:t,key:'',artist:'',folder:'未分類',
    capo:0,bpm:100,barsPerLine:8,transpose:0,plays:0});
  songs=[s]; playlists=[]; openSong=null; tab='new'; batch=[]; render();
}, BODY);
await pg.waitForTimeout(300);

console.log('=== 判定 ===');
console.log(await pg.evaluate(([t])=>{
  const f=(label,title,txt)=>`${label}: ${findSame(title,txt)?'完全一致':'ちがう'}`;
  return [
    f('そのまま','フラグメント',t),
    f('改行コードだけ違う','フラグメント',t.replace(/\n/g,'\r\n')),
    f('行末に空白','フラグメント',t.split('\n').map(L=>L+'  ').join('\n')),
    f('前後に空行','フラグメント','\n\n'+t+'\n\n'),
    f('歌詞が1文字違う','フラグメント',t.replace('よあけ','ゆうぐれ')),
    f('コードが違う','フラグメント',t.replace('Am','Em')),
    f('曲名が違う','べつの曲',t),
  ].join('\n');
}, [BODY]));

console.log('\n=== 取り込み一覧（同じもの＋少し違うもの＋新曲）===');
await pg.evaluate(([t])=>{
  const mk=(name,title,text,extra)=>Object.assign({name,ok:true,pick:true,title,text,
    artist:'',folder:'オリジナル',key:'C',capo:0,bpm:100,nChord:2,nLyric:2}, extra||{});
  batch=[ mk('a.md','フラグメント',t,{artist:'三好 & トミ',key:'C'}),
          mk('b.md','フラグメント',t.replace('よあけ','ゆうぐれ')),
          mk('c.md','あたらしい曲',"C G\nはじめて") ];
  checkBatchDup(); drawBatch();
}, [BODY]);
await pg.waitForTimeout(400);
console.log(await pg.evaluate(()=>batch.map(x=>`${x.title} → ${x.dup?x.dupMode:'重複なし'}`).join('\n')));
console.log('\n画面:', await pg.evaluate(()=>{
  const d=document.querySelector('.dup');
  return d?d.textContent.replace(/\s+/g,' ').trim().slice(0,150):'(なし)';
}));
console.log('選ばれているボタン:', await pg.evaluate(()=>{
  const on=document.querySelector('.dup .ch button.on'); return on?on.textContent.trim():'(なし)';
}));

console.log('\n=== 取り込む ===');
await pg.evaluate(()=>importBatch());
await pg.waitForTimeout(500);
console.log(await pg.evaluate(()=>songs.map(x=>
  `${x.title} / artist=${x.artist||'(空)'} key=${x.key||'(空)'} genre=${x.folder}`).join('\n')));
console.log('曲数:', await pg.evaluate(()=>songs.length), '（3ならOK: 元1＋別バージョン1＋新曲1）');
console.log('トースト:', await pg.evaluate(()=>document.getElementById('shareToast').textContent));

console.log('\n=== 新規登録から同じものを保存 ===');
await pg.evaluate(([t])=>{
  draft={text:t,title:'フラグメント',artist:'',key:'',capo:0,folder:'',
         capoBase:'play',transpose:0,keyEdited:false,keyGuessed:false};
  saveDraft();
}, [BODY]);
await pg.waitForTimeout(500);
console.log('曲数:', await pg.evaluate(()=>songs.length), '（増えなければOK）');
console.log('トースト:', await pg.evaluate(()=>document.getElementById('shareToast').textContent));
console.log('\nページ例外:', errs.length?errs.join(' / '):'なし');
await b.close();
})();
