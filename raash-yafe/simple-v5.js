/* Raash Yafe v5 — strict, simplified iPhone music library. All v1-v4 data is preserved. */
(function(){
'use strict';
const D=document, q=s=>D.querySelector(s);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const S={fileTarget:null,last:null,coverURL:null,lastSaved:0};
const findSong=id=>current.tracks.find(t=>t.id===id);
const playingVariant=t=>t?.variants?.findIndex(v=>v.fileKey)??-1;
const firstArt=()=>current.id==='ani-po'?'assets/front.webp':'cover.svg';
function init(){
 const root=D.createElement('main');root.id='simpleApp';
 root.innerHTML=`
 <header class="s-header"><div class="s-mark"><strong dir="rtl">רעש יפה</strong><div><b>RA'ASH YAFE</b><small>МОЯ МУЗЫКА</small></div></div><button id="sSettings" class="s-menu" aria-label="Настройки">⚙</button></header>
 <div class="s-wrap">
   <section class="s-album"><div class="s-cover"><img id="sCover" src="assets/front.webp" alt="Обложка альбома"><button id="sPhotos" class="s-photo-link">▣ Наши фото</button></div>
   <div class="s-album-body"><div class="s-kicker">АЛЬБОМ · רעש יפה</div><h1 id="sTitle">אני פה!</h1><p id="sDesc">Первый альбом</p><span id="sHave" class="s-have">0 песен с аудио</span>
   <div class="s-hero-buttons"><button id="sPlayAlbum" class="s-main-button">▶ Слушать</button><button id="sAddAudio" class="s-add-button">＋ Добавить MP3</button></div></div></section>
   <div id="sAlbums" class="s-albums" aria-label="Альбомы"></div>
   <button id="sResume" class="s-resume" hidden><small>ПРОДОЛЖИТЬ ПРОСЛУШИВАНИЕ</small><strong id="sResumeTitle">—</strong><span id="sResumeAt">С последнего места</span></button>
   <section class="s-music"><div class="s-section-head"><h2>Песни</h2><span id="sSongsTotal"></span></div><div id="sSongs"></div></section>
   <section class="s-gallery-preview"><img src="assets/studio.webp" alt="Наша группа в студии" loading="lazy"><div><b>НАША ГРУППА</b><p>Фотографии, записи и обложки в одном месте.</p><button id="sMorePhotos">Посмотреть фото</button></div></section>
   <footer class="s-footer">Для сохранности музыки делай резервную копию ZIP. Все аудиофайлы хранятся на этом устройстве.</footer>
 </div>
 <nav class="s-player"><div class="s-player-line"><img id="sMini" src="assets/front.webp" alt=""><div class="s-now"><b id="sNow">Выбери песню</b><small id="sNowSub">Плеер группы</small></div><button id="sPrev" aria-label="Предыдущая">⏮</button><button id="sPause" class="s-play-toggle" aria-label="Пуск или пауза">▶</button><button id="sNext" aria-label="Следующая">⏭</button></div>
 <div class="s-progress"><span id="sElapsed">0:00</span><input id="sSeek" type="range" min="0" max="1000" value="0" aria-label="Перемотка"><span id="sDuration">0:00</span></div></nav></main>`;
 D.body.insertBefore(root,q('#shell'));q('#shell').classList.add('s-legacy-off');q('.bar').classList.add('s-legacy-off');
 const picker=D.createElement('input');picker.id='sAudioPicker';picker.type='file';picker.accept='audio/*,.mp3,.wav,.m4a,.aac,.flac';picker.hidden=true;D.body.append(picker);picker.onchange=importChosen;
 q('#sSettings').onclick=tools;q('#sPhotos').onclick=photos;q('#sMorePhotos').onclick=photos;
 q('#sPlayAlbum').onclick=playAlbum;q('#sAddAudio').onclick=chooseSong;
 q('#sPrev').onclick=()=>nextPrev(-1);q('#sNext').onclick=()=>nextPrev(1);
 q('#sPause').onclick=()=>{if(audio.src){audio.paused?audio.play().catch(()=>notify('Не удалось воспроизвести')):audio.pause()}else playAlbum()};
 q('#sSeek').oninput=e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(e.target.value)/1000};
 q('#sResume').onclick=resume;
 try{S.last=JSON.parse(localStorage.getItem('raash-last-v5'))}catch(e){}
 const old=paint;paint=function(){old();draw()};
 for(const ev of ['play','pause','timeupdate','loadedmetadata','ended'])audio.addEventListener(ev,drawPlayer);
 audio.addEventListener('timeupdate',remember);
 draw();
}
function draw(){
 if(!q('#simpleApp'))return;
 q('#sTitle').textContent=current.name;q('#sDesc').textContent=current.description||'Альбом нашей группы';
 q('#sHave').textContent=current.tracks.filter(t=>playingVariant(t)>=0).length+' из '+current.tracks.length+' песен с аудио';
 q('#sSongsTotal').textContent=current.tracks.length+' композиций';
 q('#sAlbums').innerHTML=library.albums.map(a=>`<button class="s-album-tab ${a.id===current.id?'active':''}" data-album="${safe(a.id)}">${safe(a.name)}</button>`).join('');
 q('#sAlbums').querySelectorAll('[data-album]').forEach(b=>b.onclick=()=>{if(b.dataset.album===current.id)return;current=library.albums.find(a=>a.id===b.dataset.album);library.current=current.id;save();paint()});
 q('#sSongs').innerHTML=current.tracks.map((t,i)=>{
   const v=playingVariant(t),state=v>=0?'Есть запись':t.variants.some(x=>x.suno)?'Есть ссылка Suno':'Нет записи';
   return `<div class="s-song"><button class="s-song-info" data-open="${safe(t.id)}"><span class="s-number">${String(i+1).padStart(2,'0')}</span><span class="s-song-text"><b dir="auto">${safe(t.name)}</b><small>${safe(t.trans||state)}</small></span><span class="s-dot ${v>=0?'ready':''}"></span></button><button class="s-song-play ${v>=0?'has':''}" data-play="${safe(t.id)}" aria-label="${v>=0?'Слушать':'Добавить аудио'}">${v>=0?'▶':'＋'}</button></div>`;
 }).join('');
 q('#sSongs').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>detail(b.dataset.open));
 q('#sSongs').querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>{const t=findSong(b.dataset.play),v=playingVariant(t);if(v>=0)play(t,v);else detail(t.id)});
 setArt();drawResume();drawPlayer();
}
function setArt(){
 const albumId=current.id,defaultArt=firstArt();q('#sCover').src=defaultArt;q('#sMini').src=defaultArt;
 if(S.coverURL){URL.revokeObjectURL(S.coverURL);S.coverURL=null}
 if(current.coverKey)get(current.coverKey).then(b=>{if(!(b instanceof Blob)||current.id!==albumId)return;S.coverURL=URL.createObjectURL(b);q('#sCover').src=S.coverURL;q('#sMini').src=S.coverURL}).catch(()=>{});
}
function drawPlayer(){if(!q('#sPause'))return;q('#sPause').textContent=audio.src&&!audio.paused?'Ⅱ':'▶';q('#sNow').textContent=q('#nowtitle')?.textContent||'Выбери песню';q('#sNowSub').textContent=q('#nowversion')?.textContent||'Плеер группы';q('#sElapsed').textContent=fmt(audio.currentTime);q('#sDuration').textContent=fmt(audio.duration);q('#sSeek').value=Number.isFinite(audio.duration)&&audio.duration>0?Math.round(audio.currentTime/audio.duration*1000):0}
function play(t,v){if(!t?.variants[v]?.fileKey)return detail(t?.id);startPlay(t,v).catch(()=>notify('Не удалось открыть запись'))}
function playAlbum(){const t=current.tracks.find(x=>playingVariant(x)>=0);if(!t)return chooseSong();play(t,playingVariant(t))}
function remember(){if(!selected||!audio.src||!Number.isFinite(audio.currentTime)||audio.currentTime<2)return;const now=Date.now();if(now-S.lastSaved<2400)return;S.lastSaved=now;S.last={album:current.id,id:selected.id,v:selected.v,seconds:audio.currentTime};try{localStorage.setItem('raash-last-v5',JSON.stringify(S.last))}catch(e){}}
function drawResume(){const s=S.last,a=library.albums.find(x=>x.id===s?.album),t=a?.tracks.find(x=>x.id===s?.id);if(!t?.variants?.[s.v]?.fileKey||s.seconds<2){q('#sResume').hidden=true;return}q('#sResume').hidden=false;q('#sResumeTitle').textContent=t.name;q('#sResumeAt').textContent='С '+fmt(s.seconds)+' · '+a.name}
function resume(){const x=S.last,a=library.albums.find(y=>y.id===x?.album),t=a?.tracks.find(y=>y.id===x?.id);if(!t?.variants[x.v]?.fileKey)return notify('Сохранённый файл не найден');current=a;library.current=a.id;save();paint();const sec=x.seconds;audio.addEventListener('loadedmetadata',function(){if(Number.isFinite(audio.duration))audio.currentTime=Math.min(sec,Math.max(0,audio.duration-1))},{once:true});play(t,x.v)}
function chooseSong(){if(!current.tracks.length)return notify('Добавь первую песню');openSheet('Добавить музыку','<p class="s-help">Выбери песню, затем аудиофайл. Больше ничего настраивать не нужно.</p>'+current.tracks.map(t=>`<button class="s-sheet-choice" data-song="${safe(t.id)}"><b>${safe(t.name)}</b><span>＋ Добавить</span></button>`).join(''));q('#sheetbody').querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>detail(b.dataset.song))}
function detail(id){const t=findSong(id);if(!t)return;
 const rows=t.variants.map((v,i)=>`<div class="s-version"><div><b>Вариант ${i?'B':'A'}</b><small>${safe(v.fileName|| (v.suno?'Только ссылка Suno':'Аудиофайл не загружен'))}</small></div><div class="s-version-actions">${v.fileKey?`<button data-listen="${i}">▶ Слушать</button>`:''}<button data-add="${i}" class="${v.fileKey?'':'prominent'}">${v.fileKey?'Заменить':'＋ MP3'}</button></div></div>`).join('');
 openSheet(t.name,'<p class="s-help">Выбери одну из двух версий песни. MP3 и WAV сохраняются внутри приложения.</p>'+rows+'<div class="s-sheet-divider"></div><button class="s-sheet-wide" id="sRecord">● Запись и монтаж</button><button class="s-sheet-wide" id="sLyrics">Текст песни и стиль</button><button class="s-sheet-wide" id="sEdit">Клип и другие настройки</button><details class="s-options"><summary>Ссылка Suno (дополнительно)</summary><p>Публичную запись можно слушать во встроенном плеере, но независимо от Suno работает только свой аудиофайл.</p><button id="sLinkEdit">Прикрепить ссылку</button><button id="sLinkListen">Слушать ссылку</button></details>');
 q('#sheetbody').querySelectorAll('[data-listen]').forEach(b=>b.onclick=()=>{closeSheet();play(t,Number(b.dataset.listen))});
 q('#sheetbody').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{S.fileTarget={album:current.id,id,v:Number(b.dataset.add)};q('#sAudioPicker').click()});
 q('#sRecord').onclick=()=>window.RaashStudioV4?.openFor(id);
 q('#sLyrics').onclick=()=>q('#tracks [data-songid="'+id+'"] [data-studio]')?.click();
 q('#sEdit').onclick=()=>editSong(id);q('#sLinkEdit').onclick=()=>editVariant(id,0);
 q('#sLinkListen').onclick=()=>{const i=t.variants.findIndex(v=>v.suno);if(i>=0)window.RaashStudioV4?.openLinked(id,i);else notify('Ссылка Suno ещё не добавлена')};
}
async function importChosen(e){const f=e.target.files?.[0],d=S.fileTarget;e.target.value='';S.fileTarget=null;if(!f||!d)return;
 if(!f.type.startsWith('audio/')&&!/\.(mp3|wav|m4a|aac|flac)$/i.test(f.name))return notify('Нужен файл MP3, WAV или M4A');
 const a=library.albums.find(x=>x.id===d.album),t=a?.tracks.find(x=>x.id===d.id);if(!t)return notify('Песня не найдена');const v=t.variants[d.v];
 if(v.fileKey&&!confirm('Заменить эту запись? Старый файл останется только в ранее сохранённой ZIP-копии.'))return;
 const key='audio:'+a.id+':'+t.id+':simplev5:'+Date.now();try{await put(key,f);v.fileKey=key;v.fileName=f.name;current=a;library.current=a.id;save();closeSheet();paint();notify('Готово! Теперь нажми ▶ напротив песни.')}catch(err){notify('Не удалось сохранить файл. Проверь память iPhone.')}}
function tools(){openSheet('Инструменты','<p class="s-help">Всё, что нужно для обычного прослушивания, уже на главном экране. Дополнительные функции здесь.</p>'+[
 ['sEQ','≋ Эквалайзер','Настроить звук'],['sStudio','● Запись и монтаж','Фрагменты и WAV'],['sBackup','↓ Сохранить всю музыку','ZIP-копия'],['sRestore','↑ Восстановить музыку','Из ZIP'],['sCreateAlbum','＋ Новый альбом','Песни группы'],['sChangeCover','▣ Поменять обложку','Выбрать своё изображение']].map(x=>`<button class="s-sheet-choice" id="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></button>`).join(''));
 q('#sEQ').onclick=()=>window.RaashStudioV4?.showEQ();q('#sStudio').onclick=()=>current.tracks.length?window.RaashStudioV4?.openFor(current.tracks[0].id):notify('Добавь песню');
 q('#sBackup').onclick=createFullBackup;q('#sRestore').onclick=()=>q('#importzip').click();q('#sCreateAlbum').onclick=addAlbum;q('#sChangeCover').onclick=()=>q('#coverbtn').click()}
function photos(){const first=current.id==='ani-po';openSheet('Наши фотографии и обложки',first?'<div class="s-gallery">'+[['front.webp','Передняя обложка'],['back.webp','Задняя обложка'],['studio.webp','В студии'],['live.webp','Выступление группы']].map(x=>`<figure><img src="assets/${x[0]}" alt="${x[1]}"><figcaption>${x[1]}</figcaption></figure>`).join('')+'</div>':'<p class="s-help">Для нового альбома можно добавить собственную обложку.</p><button id="sCoverUpload" class="s-sheet-wide">＋ Выбрать обложку</button>');if(!first)q('#sCoverUpload').onclick=()=>q('#coverbtn').click()}
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();