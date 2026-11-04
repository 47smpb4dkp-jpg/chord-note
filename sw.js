/* オフラインでも開けるようにするための最小限のキャッシュ。

   以前の版は「通信したものを全部」溜め込んでいた。
   そのため PDF の文字表・画像読み取りの日本語辞書・Firebase の通信などが
   どんどん積み上がり、何百MBにもなって端末の保存枠を食いつぶしていた。
   いまは自分のページのファイルだけを扱い、外から来たものには一切触らない。 */
const CACHE = 'chordnote-v2';
const FILES = ['./', './index.html', './manifest.json',
  './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  // 名前が変わったので、古い溜め込みはここで丸ごと消える
  e.waitUntil(caches.keys().then(ks=>
    Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});

// このページ自身のファイルかどうか
function isOwnFile(url){
  const base = new URL('./', self.location).pathname;
  if (!url.pathname.startsWith(base)) return false;
  const rest = url.pathname.slice(base.length);
  return rest === '' || /^(index\.html|manifest\.json|sw\.js|icon-\d+\.png)$/.test(rest);
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try{ url = new URL(req.url); }catch(err){ return; }

  // ほかのサイトのものには手を出さない。
  // ここを溜め込むと、中身が見えないぶん大きく数えられて枠を食う
  if (url.origin !== self.location.origin) return;
  // 自分のページの読み込みだけ面倒を見る
  if (req.mode !== 'navigate' && !isOwnFile(url)) return;

  e.respondWith(
    fetch(req).then(res=>{
      if (res && res.ok && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>caches.match(req).then(r=>r || caches.match('./index.html')))
  );
});
