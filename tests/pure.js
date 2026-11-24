
/* ============ 1. 正規化とパーサー ============ */
const SEP = new Set([' ','　','\t','・','･']);

function charWidth(ch){
  const c = ch.codePointAt(0);
  if (c === 0x3000) return 2;
  if (c < 0x1100) return 1;
  if ((c>=0x1100&&c<=0x115f)||(c>=0x2e80&&c<=0xa4cf)||(c>=0xac00&&c<=0xd7a3)||
      (c>=0xf900&&c<=0xfaff)||(c>=0xfe30&&c<=0xfe6f)||(c>=0xff00&&c<=0xff60)||
      (c>=0xffe0&&c<=0xffe6)) return 2;
  return 1;
}
function dispWidth(s){ let w=0; for(const ch of s) w+=charWidth(ch); return w; }

// 全角・音楽記号をコード判定用に正規化（位置計算は元テキストで済ませてある）
function normTok(t){
  let s = t.normalize('NFKC');
  s = s.replace(/♭/g,'b').replace(/♯/g,'#').replace(/♮/g,'');
  s = s.replace(/[【】\[\]]/g,'');
  return s.trim();
}

const CHORD_RE = /^[A-G][#b]?(m|M|maj|min|dim|aug|\+)?(2|4|5|6|7|9|11|13)?(sus(2|4)?)?(add(2|4|9|11|13))?(b5|#5|b9|#9|#11|b13)?(\/[A-G][#b]?)?$/;
const SECTIONS = ['イントロ','前奏','間奏','アウトロ','エンディング','サビ','リフレイン',
  'Aメロ','Bメロ','Cメロ','ソロ','ブレイク','Break','Intro','Outro','Solo','Coda','Fine'];

function classify(raw){
  const s = normTok(raw);
  if (!s) return null;
  if (CHORD_RE.test(s)) return {kind:'c', text:s};
  if (/^[\/|｜]+$/.test(s)) return {kind:'b', text:s};
  if (/^[xX×]\s*\d+$/.test(s)||/^\d+\s*回$/.test(s)) return {kind:'s', text:s};
  for (const w of SECTIONS){
    if (s===w) return {kind:'s', text:s};
    if (new RegExp('^'+w+'[0-9\\-~〜ｰ－—・]*$').test(s)) return {kind:'s', text:s};
  }
  if (/^[→⇒←↓↑]+$/.test(s)) return {kind:'b', text:s};
  if (/^[(（].*[)）]$/.test(raw.trim())||/^[→⇒]/.test(s)) return {kind:'n', text:raw.trim()};
  return {kind:'x', text:s};
}

// 「CGEmAm」のように区切りなしで繋がったコードを分割する
function splitRunOn(tok){
  const s = normTok(tok);
  if (s.length < 2 || !/^[A-G]/.test(s)) return null;
  const out = [];
  let rest = s, guard = 0;
  while (rest && guard++ < 20){
    let hit = null;
    for (let len = Math.min(rest.length, 7); len >= 1; len--){
      const head = rest.slice(0, len);
      if (CHORD_RE.test(head)){ hit = head; break; }
    }
    if (!hit) return null;
    out.push(hit);
    rest = rest.slice(hit.length);
  }
  return out.length >= 2 ? out : null;
}

function tokenize(line){
  line = line.replace(/([(（][^)）]*[)）])/g,' $1 ');
  const toks=[]; let col=0, buf='', start=0, depth=0;
  for (const ch of line){
    if (ch==='('||ch==='（') depth++;
    if (depth===0 && SEP.has(ch)){
      if (buf){ toks.push({raw:buf,col:start}); buf=''; }
    } else {
      if (!buf) start=col;
      buf+=ch;
    }
    if (ch===')'||ch==='）') depth=Math.max(0,depth-1);
    col+=charWidth(ch);
  }
  if (buf) toks.push({raw:buf,col:start});
  // 連結コードを展開（位置はトークン内の表示幅で按分）
  const out = [];
  for (const t of toks){
    if (classify(t.raw) && classify(t.raw).kind !== 'x'){ out.push(t); continue; }
    const parts = splitRunOn(t.raw);
    if (!parts){ out.push(t); continue; }
    let off = 0;
    for (const pt of parts){ out.push({raw:pt, col:t.col + off}); off += dispWidth(pt); }
  }
  return out;
}

// 'chord' = コードを含む行 / 'section' = セクション名だけの行 / 'lyric' = それ以外
function lineKind(line){
  const toks = tokenize(line);
  if (!toks.length) return 'lyric';
  const cls = toks.map(t=>classify(t.raw));
  if (cls.some(c=>!c||c.kind==='x')) return 'lyric';
  if (cls.some(c=>c.kind==='c')) return 'chord';
  if (cls.some(c=>c.kind==='s')) return 'section';
  return 'lyric';
}
function isChordLine(line){ return lineKind(line) !== 'lyric'; }

function parseSheet(text){
  const lines = text.replace(/\r\n/g,'\n').split('\n');
  const out = {title:'', credit:'', key:null, capo:null, blocks:[]};
  let i=0;
  while(i<lines.length && !lines[i].trim()) i++;
  if (i<lines.length && !isChordLine(lines[i])){ out.title = lines[i].trim(); i++; }
  let cur=null;
  for(; i<lines.length; i++){
    const line = lines[i];
    if (!line.trim()){ if(cur){out.blocks.push(cur);cur=null;} continue; }
    if (/作詞|作曲|編曲/.test(line) && !out.credit){ out.credit = line.trim(); continue; }
    const km = line.match(/Key\s*(?:on)?\s*([A-G][#b♭♯]?)/i);
    const cm = line.normalize('NFKC').match(/(\d+)\s*Capo/i) || line.normalize('NFKC').match(/Capo\s*[:：]?\s*(\d+)/i);
    if (km && !out.key){ out.key = normTok(km[1]); if(cm) out.capo = +cm[1]; continue; }
    if (isChordLine(line)){
      if (cur) out.blocks.push(cur);
      cur = {chords: tokenize(line).map(t=>({...classify(t.raw), col:t.col})), lyrics:[]};
    } else {
      if (cur) cur.lyrics.push(line);
      else out.blocks.push({chords:[], lyrics:[line]});
    }
  }
  if (cur) out.blocks.push(cur);
  return out;
}

/* ============ 2. 移調 ============ */
const SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATEQ={'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B','Fb':'E'};
function pc(n){ return SHARP.indexOf(FLATEQ[n]||n); }
function shiftRoot(root,n){
  const i = pc(root); if (i<0) return root;
  return SHARP[(i+n%12+12)%12];
}
function transposeChord(ch,n){
  if (!n) return ch;
  return ch.replace(/^([A-G][#b]?)/, (m)=>shiftRoot(m,n))
           .replace(/\/([A-G][#b]?)$/, (m,p1)=>'/'+shiftRoot(p1,n));
}

/* ============ 3. コードダイアグラム ============ */
// [6弦→1弦]  -1=ミュート, 0=開放。押さえやすい形を先に並べる
const SHAPES = {
  'C':[[-1,3,2,0,1,0],[-1,3,5,5,5,3]], 'Cmaj7':[[-1,3,2,0,0,0]], 'C7':[[-1,3,2,3,1,0]],
  'Cadd9':[[-1,3,2,0,3,0]], 'Cm':[[-1,3,5,5,4,3]],
  'D':[[-1,-1,0,2,3,2],[-1,5,7,7,7,5]], 'Dm':[[-1,-1,0,2,3,1]], 'D7':[[-1,-1,0,2,1,2]],
  'Dm7':[[-1,-1,0,2,1,1]], 'Dsus4':[[-1,-1,0,2,3,3]], 'Dmaj7':[[-1,-1,0,2,2,2]],
  'E':[[0,2,2,1,0,0]], 'Em':[[0,2,2,0,0,0]], 'E7':[[0,2,0,1,0,0]], 'Em7':[[0,2,2,0,3,0],[0,2,0,0,0,0]],
  'Eb':[[-1,6,5,3,4,3]], 'Ebmaj7':[[-1,6,5,3,3,3]],
  'F':[[1,3,3,2,1,1],[-1,-1,3,2,1,1]], 'Fmaj7':[[-1,-1,3,2,1,0]], 'Fm':[[1,3,3,1,1,1]],
  'F#m':[[2,4,4,2,2,2]], 'F#m7':[[2,4,2,2,2,2]], 'F#':[[2,4,4,3,2,2]],
  'G':[[3,2,0,0,0,3],[3,5,5,4,3,3]], 'G7':[[3,2,0,0,0,1]], 'Gm':[[3,5,5,3,3,3]],
  'G6':[[3,2,0,0,0,0]], 'Gsus4':[[3,3,0,0,1,3]], 'Gmaj7':[[3,2,0,0,0,2]],
  'A':[[-1,0,2,2,2,0]], 'Am':[[-1,0,2,2,1,0]], 'A7':[[-1,0,2,0,2,0]], 'Am7':[[-1,0,2,0,1,0]],
  'Amaj7':[[-1,0,2,1,2,0]], 'Asus4':[[-1,0,2,2,3,0]],
  'B':[[-1,2,4,4,4,2]], 'Bm':[[-1,2,4,4,3,2]], 'B7':[[-1,2,1,2,0,2]], 'Bm7':[[-1,2,4,2,3,2]],
  'Bb':[[-1,1,3,3,3,1]], 'Bbmaj7':[[-1,1,3,2,3,1]],
  'C#m':[[-1,4,6,6,5,4]], 'C#7':[[-1,4,3,4,2,4]], 'G#m':[[4,6,6,4,4,4]],
};
const SHAPE_LABEL = ['ローコード','ハイコード','別フォーム'];

function diagramSVG(frets){
  const played = frets.filter(f=>f>0);
  const minF = played.length?Math.min(...played):1;
  const base = minF>4 ? minF : 1;
  const W=76,H=92, L=12, T=20, SW=10, FH=13;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  // ナット or ポジション番号
  if (base===1) s += `<rect x="${L}" y="${T-3}" width="${SW*5}" height="3" fill="currentColor"/>`;
  else s += `<text x="${L-3}" y="${T+9}" font-size="8" text-anchor="end" fill="currentColor" opacity=".65">${base}</text>`;
  for(let i=0;i<6;i++) s += `<line x1="${L+i*SW}" y1="${T}" x2="${L+i*SW}" y2="${T+FH*4}" stroke="currentColor" stroke-width="1" opacity=".45"/>`;
  for(let i=0;i<=4;i++) s += `<line x1="${L}" y1="${T+i*FH}" x2="${L+SW*5}" y2="${T+i*FH}" stroke="currentColor" stroke-width="1" opacity=".45"/>`;
  frets.forEach((f,idx)=>{
    const x = L + idx*SW;
    if (f===-1) s += `<text x="${x}" y="${T-6}" font-size="8" text-anchor="middle" fill="currentColor" opacity=".55">×</text>`;
    else if (f===0) s += `<circle cx="${x}" cy="${T-9}" r="3" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".65"/>`;
    else {
      const row = f - base;
      if (row>=0 && row<4) s += `<circle cx="${x}" cy="${T+row*FH+FH/2}" r="4" fill="currentColor"/>`;
    }
  });
  return s + '</svg>';
}

function shapesFor(name){
  if (SHAPES[name]) return SHAPES[name];
  const alt = name.replace(/^([A-G])b/, (m,p)=>({'D':'C#','E':'D#','G':'F#','A':'G#','B':'A#'}[p]||m));
  if (SHAPES[alt]) return SHAPES[alt];
  return null;
}

/* ============ 4. サンプル曲 ============ */
const SAMPLES = [
{id:'frag', title:'フラグメント', artist:'tommy', key:'D', capo:2, bpm:84, barsPerLine:8, text:
`C   G   Em    Am    F   F    G    G

C                G                F             C       Am      G        F       E
ロマンティックな言葉の一つも 思いつかずにあなたは
Am           G              F              C           Am          G              F              C
全てがいやになったと泣いた もう 全てが嫌になったと泣いた

そんなあなたの泣き顔を見て こんなに楽しいのにとつぶやく
僕は夢を見ているようで こんなに楽しいのにとつぶやく

間奏
C   G   Em    Am    F   F    G    G

サビ
C  G   Em  Dm7
あなたへの最後の言葉は 勇気がないから言えなかった`},

{id:'shingo', title:'しんごうきのうた〜１２３〜', artist:'混×××', key:'A', capo:0, bpm:120, barsPerLine:8, text:
`作詞・作曲／混×××　編曲／混×××・川田雅之

A                    D   D/B   E
しんごうを　わたろう　赤青黄色
しんごうを　わたろう　右見て左見て　１２３

A              E              D            E
赤しんごうは　いちごちゃん　いちごをたべてとまりましょう
車がくるまで待っててね　青色になるまで待っててね

F#m              C#m            D            E
黄色のしんごうはくるま用　もうすぐ赤だよ止まりなさい
バナナ色したしんごうは　もうすぐくるまが走ってくるよ`},

{id:'akane', title:'あかね色', artist:'混×××', key:'G', capo:0, bpm:76, barsPerLine:8, text:
`作詞・作曲／混×××
イントロ G・Am・Bm・C

G    Am     Bm     C      G      Am      Bm     C
恋心を隠したまんまで　　引っ越すなんて寂しすぎるから
G      Am      Bm     C  G     Am      Bm      C       D
子供のころから２人で遊んだ　公園のベンチお別れをつげた

C   Bm Am     G    F      Em    F      Em     E♭          D
この街と君の思い出と　楽しかったことや悲しかったことが　あふれてこぼれ落ちる

  G  Bm  C   G  Bm  C
 君が大好き　　大好き　　　大好きだったよ　大好き
  Am     Bm  C   Am     Bm     C
 かなわない恋心は　夕焼けのあかね色

【間奏　Gm・F・E♭・Dm・Cm・Dm・E♭・Dsus4・D】

  G  Bm  C   G  Bm  C
 君が大好き　　大好き　　　大好きだったよ　大好き
  Am     Bm  C   Am     Bm     C
 かなわない恋心は　夕焼けのあかね色`},
];


module.exports={isChordLine,lineKind,tokenize,classify,SAMPLES,parseSheet};