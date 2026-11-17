/* Raash Yafe 8 — stable iPhone Suno short links, user-friendly errors, fresh asset. */
(function(){
'use strict';
const D=document;
const $=s=>D.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ST={input:'',lastImported:0,busy:false,opening:0};
const RESOLVER='https://raash-yafe-links.vercel.app/api/resolve';
const getTrack=id=>current.tracks.find(x=>x.id===id);
const countStreams=album=>(album.tracks||[]).filter(t=>t.variants?.some(v=>v.suno)).length;
function readLink(raw){
 try{
  let u=new URL(raw.trim().replace(/[),.;]+$/,''));
  if(u.protocol!=='https:'||!['suno.com','www.suno.com'].includes(u.hostname))return null;
  const p=u.pathname.split('/').filter(Boolean);
  if(p.length!==2||!['song','embed','s'].includes(p[0]))return null;
  const id=p[1],full=p[0]!=='s';
  if(full&&!UUID.test(id))return null;
  if(!full&&!/^[a-z0-9_-]{6,80}$/i.test(id))return null;
  return {kind:p[0],id,short:!full,url:'https://suno.com/'+p[0]+'/'+id,key:(full?'clip:':'share:')+id.toLowerCase()};
 }catch(e){return null}
}
function extract(text){
 const links=[];const lines=String(text||'').split(/\r?\n/);
 const pat=/https:\/\/(?:www\.)?suno\.com\/(?:song|embed|s)\/[a-z0-9_-]+(?:[/?#][^\s<>"']*)?/ig;
 for(const line of lines){
  const matches=[...line.matchAll(pat)];let last=0;
  for(const m of matches){
   const parsed=readLink(m[0]);if(!parsed)continue;
   let label=line.slice(last,m.index).trim().replace(/^[\s•\-–—:|]+|[\s•\-–—:|]+$/g,'');
   if(label.length>100||/^(song|url|suno|ссылка|песня)\s*\d*$/i.test(label))label='';
   links.push({...parsed,label:label||''});last=m.index+m[0].length;
  }
 }
 return links;
}
async function resolveSong(link){
 if(!link)return null;
 const url=RESOLVER+(link.short?'?code=':'?id=')+encodeURIComponent(link.id);
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json'}})}
  finally{clearTimeout(timeout)}
  if(!response.ok)throw Error('Ссылка пока недоступна');
  const data=await response.json();
  if(!data.ok||!UUID.test(data.id))throw Error('Не удалось получить песню');
  const resolved=readLink(data.url);if(!resolved)throw Error('Ссылка не распознана');
  return {...resolved,label:link.label||data.title||'',originalKey:link.key};
 }catch(err){
  if(link.short)throw Error('Suno не ответил на короткую ссылку. Попробуй ещё раз с интернетом.');
  return link;
 }
}
function allKeys(){
 const all=new Set();
 for(const a of library.albums)for(const t of a.tracks||[])for(const v of t.variants||[]){
  const ref=readLink(v.suno||'');if(ref)all.add(ref.key);
 }
 return all;
}
function drawSuno(){
 if(!$('#sSunoHub'))return;
 const streamCount=countStreams(current);
 $('#sSunoCount').textContent=streamCount?streamCount+' песен из Suno':'Можно слушать без скачивания';
 const local=current.tracks.filter(t=>t.variants.some(v=>v.fileKey)).length;
 if($('#sHave'))$('#sHave').textContent=local+' файлов · '+streamCount+' песен Suno';
 const firstStream=current.tracks.find(t=>t.variants.some(v=>v.suno));
 $('#sSunoEmpty').hidden=Boolean(firstStream);
 $('#sSongs')?.querySelectorAll('[data-play]').forEach(b=>{
  const t=getTrack(b.dataset.play),index=t?.variants?.findIndex(v=>v.suno);
  if(!t||index<0||t.variants.some(v=>v.fileKey))return;
  b.textContent='▶';b.classList.add('s6-has-stream');b.title='Слушать в программе через Suno';
  b.setAttribute('aria-label','Слушать потоковую версию Suno');
  b.onclick=()=>openStream(t.id,index);
  const info=b.closest('.s-song')?.querySelector('.s-song-text small');
  if(info&&!info.querySelector('.s6-source')){
   info.insertAdjacentHTML('beforeend',' <span class="s6-source">SUNO · ONLINE</span>');
  }
 });
}
function init(){
 if(!$('#simpleApp'))return;
 const div=D.createElement('section');div.id='sSunoHub';div.className='s6-hub';
 div.innerHTML='<div class="s6-hub-header"><div><strong>ПЕСНИ ИЗ SUNO</strong><span id="sSunoCount">Подключить записи</span></div><span class="s6-symbol">♫</span></div>'+
  '<button id="sSunoAdd" class="s6-big">＋ Моя песня из Suno</button>'+
  '<p id="sSunoEmpty">В Suno нажми «Поделиться» → «Копировать», затем вернись и нажми кнопку. Больше ничего искать не нужно.</p>';
 $('#sAlbums').before(div);
 $('#sSunoAdd').onclick=pasteFromClipboard;
 const originalPaint=paint;paint=function(){originalPaint();drawSuno()};
 const version=D.createElement('small');version.className='s8-version';version.textContent='Версия 8.0';div.append(version);
 const originalAlbum=$('#sPlayAlbum').onclick;
 $('#sPlayAlbum').onclick=()=>{
  if(current.tracks.some(t=>t.variants.some(v=>v.fileKey)))return originalAlbum();
  const t=current.tracks.find(t=>t.variants.some(v=>v.suno));if(t)return openStream(t.id,t.variants.findIndex(v=>v.suno));
  importDialog();
 };
 const originalPause=$('#sPause').onclick;
 $('#sPause').onclick=()=>{
  if(audio.src)return originalPause();
  const t=current.tracks.find(t=>t.variants.some(v=>v.suno));if(t)return openStream(t.id,t.variants.findIndex(v=>v.suno));
  importDialog();
 };
 // Main card can open embedded player immediately when its only source is a Suno URL.
 drawSuno();
 const param=new URLSearchParams(location.search).get('suno');
 if(param&&readLink(param)){ST.input=param;setTimeout(importDialog,0)}
}
function importDialog(){
 openSheet('Песня из Suno',
  '<div class="s6-steps"><b>1.</b> В Suno нажми «Поделиться» → «Скопировать ссылку».<br><b>2.</b> Вернись сюда и нажми «Вставить из буфера».<br>Остальное программа сделает сама.</div>'+
  '<label class="field" for="s6Paste">Ссылка Suno — короткая или длинная</label>'+
  '<textarea id="s6Paste" class="s6-textarea" rows="4" placeholder="Здесь появится ссылка на песню">'+esc(ST.input)+'</textarea>'+
  '<button id="s6Clipboard" class="s6-paste">Вставить ссылку из буфера</button>'+
  '<p id="s6Preview" class="s6-muted">Можно добавить несколько ссылок — по одной в строке.</p>'+
  '<button id="s6Commit" class="cta">Добавить и слушать</button>'+
  '<p class="s6-footnote">Не нужен пароль, полный адрес или выбор настроек. Приложение само определяет песню.</p>'
 );
 const input=$('#s6Paste');
 input.oninput=()=>{ST.input=input.value;const count=extract(input.value).length;$('#s6Preview').textContent=count?('Найдено ссылок: '+count):'Вставь обычную ссылку, скопированную в Suno'};
 input.oninput();
 $('#s6Clipboard').onclick=async()=>{
  try{
   const value=await navigator.clipboard.readText();
   if(!value.trim()){notify('Буфер пуст. Сначала скопируй песню в Suno');return}
   input.value=value;input.oninput();
  }catch(err){input.focus();notify('Нажми в поле и выбери «Вставить»')}
 };
 $('#s6Commit').onclick=()=>importLinks(extract(input.value));
}
async function pasteFromClipboard(){
 if(ST.busy)return;
 try{
  const clipboard=await navigator.clipboard.readText();
  const links=extract(clipboard);
  if(links.length){ST.input=clipboard;return importLinks(links)}
 }catch(e){}
 importDialog();
}
async function importLinks(links){
 if(ST.busy)return;
 if(!links.length){notify('Скопируй ссылку через «Поделиться» в Suno.');return importDialog()}
 ST.busy=true;
 const album=current,existing=allKeys();
 let added=0,duplicates=0,failed=0;
 let first=null;
 openSheet('Добавляю песни','<p class="s6-player-note">Проверяю ссылки Suno и добавляю песни в альбом автоматически.</p><div class="status" id="s6Progress">Начинаю...</div>');
 try{
  for(let i=0;i<links.length;i++){
   if($('#s6Progress'))$('#s6Progress').textContent='Песня '+(i+1)+' из '+links.length;
   let link;
   try{link=await resolveSong(links[i])}
   catch(e){failed++;continue}
   if(existing.has(link.key)||existing.has(links[i].key)){duplicates++;continue}
   let t=null,v=-1;
   if(link.label){
    const norm=normalize(link.label);
    t=album.tracks.find(x=>normalize(x.name)===norm||normalize(x.trans)===norm)||null;
    if(t){v=t.variants.findIndex(x=>!x.suno);if(v<0)t=null}
   }
   if(!t){
    const title=link.label||('Песня из Suno '+String(album.tracks.length+1).padStart(2,'0'));
    t=makeSong(title,link.label?'':'Музыка из Suno');
    album.tracks.push(t);v=0;
   }
   t.variants[v].suno=link.url;
   existing.add(link.key);existing.add(links[i].key);added++;
   if(!first)first={id:t.id,version:v};
  }
  library.current=album.id;current=album;save();ST.input='';paint();
  if(first){
   if(failed)notify('Добавлено: '+added+'. Пока недоступно: '+failed);
   else notify('Добавлено песен: '+added);
   return openStream(first.id,first.version);
  }
  openSheet('Добавление песен','<p>'+(duplicates?'Эти песни уже есть в библиотеке. ':'')+(failed?'Не получилось прочитать '+failed+' ссылок. Проверь интернет и попробуй ещё раз.':'')+'</p><button id="s6Retry" class="cta">Попробовать снова</button>');
  $('#s6Retry').onclick=importDialog;
 }finally{ST.busy=false}
}
function unavailableSong(t,version,url){
 const safeURL=readLink(url||'')?.url||'';
 openSheet('Песня сохранена · '+t.name,
   '<div class="s8-warning"><b>Эта запись пока не открывается через Suno</b><p>Мы проверили ссылку, но Suno не выдал доступную страницу песни. Тебе не нужно искать длинный адрес: он здесь не поможет.</p></div>'+
   '<button id="s8Retry" class="cta">Повторить подключение</button>'+
   '<button id="s8Original" class="s6-paste">Слушать в Suno</button>'+
   '<button id="s8LocalFile" class="s6-paste">У меня есть MP3 — добавить</button>'+
   '<p class="s6-footnote">Ссылка останется в альбоме. Если песня закрыта для внешнего просмотра, воспроизвести её внутри приложения без файла нельзя.</p>');
 $('#s8Retry').onclick=()=>openStream(t.id,version);
 $('#s8Original').onclick=()=>{if(safeURL)window.open(safeURL,'_blank','noopener');else notify('Ссылка отсутствует')};
 $('#s8LocalFile').onclick=()=>{
  closeSheet();
  const b=[...D.querySelectorAll('#sSongs [data-open]')].find(x=>x.dataset.open===t.id);
  if(b)b.click();else notify('Выбери песню в списке');
 };
}
async function openStream(id,version){
 const t=getTrack(id),v=t?.variants?.[version];if(!t||!v)return;
 if(v.fileKey)return startPlay(t,version);
 let link=readLink(v.suno||'');
 if(!link)return importDialog();
 audio.pause();
 if(link.short){
  const opening=++ST.opening;
  openSheet('Подключаю песню','<p class="s6-player-note">Проверяю ссылку Suno. Никаких длинных ссылок не нужно.</p><div class="status">Поиск записи...</div>');
  try{
   link=await resolveSong(link);
   if(opening!==ST.opening)return;
   v.suno=link.url;
   if(link.label&&/^Песня из Suno \d+$/i.test(t.name))t.name=link.label;
   save();paint();
  }catch(e){
   if(opening!==ST.opening)return;
   unavailableSong(t,version,link.url);
   return;
  }
 }
 const embed='https://suno.com/embed/'+link.id;
 openSheet('Слушать · '+t.name,
  '<p class="s6-player-note">Песня подключена. Нажми <b>▶</b> ниже — воспроизведение будет внутри רעש יפה.</p>'+
  '<div class="s6-frame"><iframe title="Плеер Suno — '+esc(t.name)+'" src="'+embed+'" allow="autoplay; encrypted-media" loading="eager"></iframe></div>'+
  '<div class="s6-play-desc"><b>'+esc(t.name)+'</b> · '+(version?'Версия B':'Версия A')+'<br><span>Поток идёт через Suno, поэтому нужен интернет.</span></div>'+
  '<button class="s6-paste" id="s6ImportMP3">Сохранить свой MP3 для прослушивания без интернета</button>');
 $('#s6ImportMP3').onclick=()=>{
  closeSheet();
  const b=[...D.querySelectorAll('#sSongs [data-open]')].find(x=>x.dataset.open===id);
  if(b)b.click();else notify('Выбери песню из списка');
 };
}
window.RaashSunoV8=window.RaashSunoV6={importDialog,openStream,readLink,extract,pasteFromClipboard,resolveSong};
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();