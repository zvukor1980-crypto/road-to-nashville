/* Ra'ash Yafe v10 - photo-led, serious album UI; existing album and media storage unchanged. */
(function(){
'use strict';
const D=document,Q=s=>D.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={albumId:null,query:'',coverUrl:null};
const songs=()=>Array.isArray(current?.tracks)?current.tracks:[];
const find=id=>songs().find(t=>t.id===id);
const hh=n=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'0:00';
const hasLocal=t=>t.variants.some(v=>v.fileKey);
const hasLink=t=>t.variants.some(v=>v.suno);
function setup(){
 if(Q('#v10'))return;
 const root=D.createElement('main');root.id='v10';
 root.innerHTML=[
 '<div class="v10-page">',
 '<header class="v10-header"><div class="v10-brand"><div class="v10-monogram">RY</div><div><b dir="rtl">רעש יפה</b><span>RA’ASH YAFE · MUSIC LIBRARY</span></div></div><button id="v10Settings" aria-label="Инструменты">☰</button></header>',
 '<section class="v10-hero"><div class="v10-coverwrap"><img id="v10Cover" src="assets/front.webp" alt="Обложка альбома группы רעש יפה"><span>ORIGINAL ALBUM</span></div><div class="v10-hero-info"><p class="v10-kicker">ISRAELI ALTERNATIVE ROCK</p><h1 id="v10Title" dir="auto">אני פה!</h1><p id="v10Desc">Первый альбом группы</p><div id="v10Counts" class="v10-counts"></div><div class="v10-hero-buttons"><button id="v10Play" class="v10-primary">▶ Слушать</button><button id="v10Photos" class="v10-secondary">Фотографии</button></div></div></section>',
 '<section class="v10-actions" aria-label="Действия"><button id="v10Suno" class="v10-action v10-red"><span class="v10-acticon">↗</span><b>Из Suno</b><small>Ссылки A/B</small></button><button id="v10Files" class="v10-action"><span class="v10-acticon">＋</span><b>Добавить MP3</b><small>Аудиофайлы</small></button><button id="v10Backup" class="v10-action"><span class="v10-acticon">↓</span><b>Сохранить всё</b><small>Архив ZIP</small></button></section>',
 '<section class="v10-library"><div class="v10-section-head"><div><p class="v10-kicker">TRACKLIST</p><h2>Песни альбома</h2></div><span id="v10Total">11 песен</span></div><div id="v10Albums" class="v10-albums"></div>',
 '<label class="v10-search"><span>⌕</span><input id="v10Search" type="search" placeholder="Найти песню" autocomplete="off" aria-label="Поиск по песням"></label>',
 '<div class="v10-legend"><span><i class="v10-dot-file"></i>Файл — без Suno</span><span><i class="v10-dot-suno"></i>Suno — онлайн</span></div><div id="v10Tracks" class="v10-tracklist"></div></section>',
 '<section class="v10-gallery"><div class="v10-section-head"><div><p class="v10-kicker">BAND ARCHIVE</p><h2>Группа в фотографиях</h2></div><button id="v10AllPhotos">Все фото</button></div><div class="v10-photo-grid">',
 '<button data-v10photo="studio"><img src="assets/studio.webp" loading="lazy" alt="Фотография группы в студии"><span>В СТУДИИ</span></button>',
 '<button data-v10photo="live"><img src="assets/live.webp" loading="lazy" alt="Фотография выступления группы"><span>ВЫСТУПЛЕНИЕ</span></button></div></section>',
 '<footer class="v10-footer"><div>רעש יפה · RA’ASH YAFE <span>STUDIO 10.0</span></div><p>Локальная музыка хранится на этом устройстве. Делай ZIP-копию, чтобы не потерять записи. Ссылки Suno не являются скачанными MP3.</p></footer>',
 '</div>',
 '<div class="v10-dock"><div class="v10-dock-top"><img id="v10Mini" src="assets/front.webp" alt=""><div class="v10-playing"><b id="v10Now">Выбери песню</b><small id="v10NowSub">МОЙ ПЛЕЕР</small></div><div class="v10-play-controls"><button id="v10Prev" aria-label="Предыдущая">‹</button><button id="v10Pause" class="v10-play" aria-label="Воспроизведение или пауза">▶</button><button id="v10Next" aria-label="Следующая">›</button></div></div><div class="v10-seek"><span id="v10Elapsed">0:00</span><input id="v10Range" type="range" min="0" max="1000" value="0" aria-label="Позиция"><span id="v10Duration">0:00</span></div></div>'
 ].join('');
 D.body.insertBefore(root,Q('#simpleApp')||Q('#shell'));
 Q('#v10Settings').onclick=showTools;
 Q('#v10Play').onclick=playAlbum;
 Q('#v10Suno').onclick=importSuno;
 Q('#v10Files').onclick=()=>{const picker=Q('#sBatchPicker')||Q('#bulkfiles');if(picker)picker.click();else notify('Импорт файлов недоступен')};
 Q('#v10Backup').onclick=()=>createFullBackup();
 Q('#v10Photos').onclick=()=>showPhotos();
 Q('#v10AllPhotos').onclick=()=>showPhotos();
 D.querySelectorAll('#v10 [data-v10photo]').forEach(btn=>btn.onclick=()=>showPhotos(btn.dataset.v10photo));
 Q('#v10Search').oninput=e=>{S.query=e.target.value.trim().toLocaleLowerCase();drawTracks()};
 Q('#v10Prev').onclick=()=>cycle(-1);
 Q('#v10Next').onclick=()=>cycle(1);
 Q('#v10Pause').onclick=()=>{if(audio.src){if(audio.paused)audio.play().catch(()=>notify('Не удалось воспроизвести'));else audio.pause()}else playAlbum()};
 Q('#v10Range').oninput=e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(e.target.value)/1000};
 const original=paint;paint=function(){original();draw()};
 for(const event of ['play','pause','timeupdate','loadedmetadata','ended'])audio.addEventListener(event,drawPlayer);
 draw();
}
function draw(){
 if(!Q('#v10'))return;
 const album=current,changed=S.albumId!==album.id;
 S.albumId=album.id;
 if(changed){S.query='';Q('#v10Search').value=''}
 Q('#v10Title').textContent=album.name;
 Q('#v10Desc').textContent=album.description||'Альбом группы';
 const files=songs().flatMap(t=>t.variants).filter(v=>v.fileKey).length;
 const links=songs().flatMap(t=>t.variants).filter(v=>!v.fileKey&&v.suno).length;
 Q('#v10Counts').innerHTML='<div><strong>'+songs().length+'</strong><span>ПЕСЕН</span></div><div><strong>'+files+'</strong><span>ФАЙЛОВ</span></div><div><strong>'+links+'</strong><span>ССЫЛОК SUNO</span></div>';
 Q('#v10Total').textContent=songs().length+' композиций · '+(songs().length*2)+' версии';
 const albums=Q('#v10Albums');
 albums.innerHTML=library.albums.map(a=>'<button data-v10album="'+esc(a.id)+'" class="'+(a.id===album.id?'active':'')+'">'+esc(a.name)+'</button>').join('');
 albums.querySelectorAll('[data-v10album]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.v10album===current.id)return;library.current=btn.dataset.v10album;current=library.albums.find(a=>a.id===library.current);save();paint()});
 drawArtwork(album);drawTracks();drawPlayer();
}
function drawTracks(){
 const list=songs().map((t,i)=>({t,i})).filter(({t})=>!S.query||((t.name||'')+' '+(t.trans||'')).toLocaleLowerCase().includes(S.query));
 const host=Q('#v10Tracks');
 if(!list.length){host.innerHTML='<p class="v10-empty">Песни по запросу не найдены.</p>';return}
 host.innerHTML=list.map(({t,i})=>{
  const opts=t.variants.map((v,j)=>{
   const type=v.fileKey?'file':v.suno?'suno':'none',state=v.fileKey?'ФАЙЛ':v.suno?'SUNO':'ПУСТО';
   return '<button class="v10-variant '+type+'" data-v10track="'+esc(t.id)+'" data-v10variant="'+j+'" aria-label="'+esc(t.name)+' версия '+(j?'B':'A')+', '+state+'"><strong>'+(j?'B':'A')+'</strong><span>'+state+'</span><em>'+(type==='none'?'＋':'▶')+'</em></button>';
  }).join('');
  return '<article class="v10-track"><div class="v10-track-id"><span class="v10-number">'+String(i+1).padStart(2,'0')+'</span><div><strong dir="auto">'+esc(t.name)+'</strong><small>'+esc(t.trans||'RA’ASH YAFE')+'</small></div></div><div class="v10-variant-row">'+opts+'</div></article>';
 }).join('');
 host.querySelectorAll('[data-v10track]').forEach(btn=>btn.onclick=()=>playVariant(btn.dataset.v10track,Number(btn.dataset.v10variant)));
}
function getSong(id){return songs().find(t=>t.id===id)}
function playVariant(id,i){
 const t=getSong(id),v=t?.variants?.[i];if(!v)return;
 if(v.fileKey){startPlay(t,i);return}
 if(v.suno){const handler=window.RaashSunoV8?.openStream||window.RaashSunoV6?.openStream;if(handler)handler(id,i);else notify('Встроенный плеер Suno сейчас недоступен');return}
 if(window.RaashYafeV9?.showAttach)window.RaashYafeV9.showAttach(id,i);
 else{openSheet('Добавить версию '+(i?'B':'A'),'<p>Прикрепи MP3 или ссылку Suno.</p><button id="v10Attach" class="cta">Добавить файл</button>');Q('#v10Attach').onclick=()=>Q('#sBatchPicker')?.click()}
}
function playAlbum(){
 let t=songs().find(x=>x.variants.some(v=>v.fileKey));
 if(t)return playVariant(t.id,t.variants.findIndex(v=>v.fileKey));
 t=songs().find(x=>x.variants.some(v=>v.suno));
 if(t)return playVariant(t.id,t.variants.findIndex(v=>v.suno));
 notify('Здесь пока нет аудиозаписей. Добавь MP3 или ссылку Suno.');
}
function cycle(dir){
 const list=songs();let i=list.findIndex(t=>t.id===selected?.id);if(i<0)i=dir>0?-1:0;
 for(let n=0;n<list.length;n++){
  i=(i+dir+list.length)%list.length;
  const v=list[i].variants.findIndex(x=>x.fileKey);
  if(v>=0){playVariant(list[i].id,v);return}
 }
 notify('Других локальных файлов пока нет.');
}
function drawPlayer(){
 if(!Q('#v10Pause'))return;
 const t=selected&&getSong(selected.id);
 Q('#v10Now').textContent=t?.name||'Выбери песню';
 Q('#v10NowSub').textContent=t?'ВЕРСИЯ '+(selected.v?'B':'A')+' · '+current.name:'МОЙ ПЛЕЕР';
 Q('#v10Pause').textContent=audio.src&&!audio.paused?'Ⅱ':'▶';
 Q('#v10Elapsed').textContent=hh(audio.currentTime);
 Q('#v10Duration').textContent=hh(audio.duration);
 Q('#v10Range').value=Number.isFinite(audio.duration)&&audio.duration>0?Math.round(audio.currentTime/audio.duration*1000):0;
}
function drawArtwork(album){
 const cover=album.id==='ani-po'?'assets/front.webp':'cover.svg';
 Q('#v10Cover').src=cover;Q('#v10Mini').src=cover;
 if(S.coverUrl){URL.revokeObjectURL(S.coverUrl);S.coverUrl=null}
 if(album.coverKey)get(album.coverKey).then(blob=>{
  if(!(blob instanceof Blob)||current.id!==album.id)return;
  S.coverUrl=URL.createObjectURL(blob);
  Q('#v10Cover').src=S.coverUrl;Q('#v10Mini').src=S.coverUrl;
 }).catch(()=>{});
}
function importSuno(){
 const button=Q('#sSunoAdd');
 if(button&&button.onclick)return button.click();
 if(window.RaashYafeV9?.batchDialog)return window.RaashYafeV9.batchDialog();
 if(window.RaashSunoV8?.importDialog)return window.RaashSunoV8.importDialog();
 notify('Импорт Suno временно недоступен');
}
function showTools(){
 openSheet('Библиотека и студия',
  '<p class="v10-tool-note">Повседневные действия находятся на главном экране. Здесь — дополнительные инструменты.</p>'+
  '<button id="v10EQ" class="v10-tool"><span>≋</span><div><b>Эквалайзер</b><small>5 полос и готовые пресеты</small></div></button>'+
  '<button id="v10Record" class="v10-tool"><span>●</span><div><b>Запись и монтаж</b><small>Записать фрагменты, собрать WAV</small></div></button>'+
  '<button id="v10Export" class="v10-tool"><span>↓</span><div><b>Резервная копия</b><small>Сохранить всю коллекцию в ZIP</small></div></button>'+
  '<button id="v10Restore" class="v10-tool"><span>↑</span><div><b>Восстановить библиотеку</b><small>Загрузить ранее сохранённый ZIP</small></div></button>'+
  '<button id="v10Gallery" class="v10-tool"><span>▣</span><div><b>Наши фотографии</b><small>Обложки, студия и выступления</small></div></button>'+
  '<button id="v10NewAlbum" class="v10-tool"><span>＋</span><div><b>Новый альбом</b><small>Создать новый сборник</small></div></button>');
 Q('#v10EQ').onclick=()=>window.RaashStudioV4?.showEQ();
 Q('#v10Record').onclick=()=>{
  openSheet('Выбрать песню для записи','<p>Для какой песни сделать новую запись?</p>'+
   songs().map(t=>'<button class="v10-tool v10-pick" data-v10record="'+esc(t.id)+'">'+esc(t.name)+'</button>').join(''));
  Q('#sheetbody').querySelectorAll('[data-v10record]').forEach(b=>b.onclick=()=>window.RaashStudioV4?.openFor(b.dataset.v10record));
 };
 Q('#v10Export').onclick=()=>createFullBackup();
 Q('#v10Restore').onclick=()=>Q('#importzip').click();
 Q('#v10Gallery').onclick=()=>showPhotos();
 Q('#v10NewAlbum').onclick=()=>addAlbum();
}
function showPhotos(focus){
 if(current.id!=='ani-po'){
  openSheet('Обложка альбома','<p>Для нового альбома можно загрузить свою обложку.</p><button id="v10AddCover" class="cta">Выбрать фото</button>');
  Q('#v10AddCover').onclick=()=>Q('#coverbtn')?.click();return;
 }
 const photos=[['front.webp','Передняя обложка'],['studio.webp','Фото группы в студии'],['live.webp','Фото выступления'],['back.webp','Задняя обложка']];
 openSheet('Фотографии группы', '<div class="v10-photo-modal">'+photos.map(x=>'<figure><img src="assets/'+x[0]+'" alt="'+esc(x[1])+'" loading="lazy"><figcaption>'+esc(x[1])+'</figcaption></figure>').join('')+'</div>');
 if(focus){
  const i=photos.findIndex(x=>x[0].startsWith(focus));
  const card=Q('#sheetbody .v10-photo-modal')?.children[i];
  if(card&&typeof card.scrollIntoView==='function')card.scrollIntoView({block:'nearest'});
 }
}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();