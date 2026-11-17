/* RA'ASH YAFE 13 — the only screen. Storage, ZIP, EQ, takes and Suno stay in the existing modules. */
(function(){
'use strict';
const D=document;
const q=s=>D.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={coverUrl:null,coverToken:'',streaming:null,resume:null,trackCoverFor:null,seeking:false};
const songs=()=>Array.isArray(current?.tracks)?current.tracks:[];
const find=id=>songs().find(t=>t.id===id);
const hh=n=>Number.isFinite(n)&&n>=0?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'0:00';
function plural(n,one,few,many){const a=n%10,b=n%100;if(a===1&&b!==11)return one;if(a>=2&&a<=4&&(b<12||b>14))return few;return many}
function kindOf(v){return v?.fileKey?'file':v?.suno?'suno':'empty'}
function kindWord(v){return v?.fileKey?'Файл':v?.suno?'Suno':'Добавить'}

function init(){
  q('#toolsBtn').onclick=openTools;
  q('#listen').onclick=listen;
  q('#photos').onclick=()=>showPhotos();
  q('#fromSuno').onclick=fromSuno;
  q('#addMusic').onclick=()=>q('#bulkfiles').click();
  q('#saveAll').onclick=()=>createFullBackup();
  q('#prev').onclick=()=>nextPrev(-1);
  q('#next').onclick=()=>nextPrev(1);
  q('#play').onclick=toggle;
  q('#ryRecStop').onclick=()=>window.RaashStudioV4?.stopRecording();
  q('#range').addEventListener('pointerdown',()=>{state.seeking=true});
  q('#range').addEventListener('pointerup',()=>{state.seeking=false});
  q('#range').addEventListener('change',()=>{state.seeking=false});
  q('#range').oninput=e=>{
    if(state.streaming)return;
    if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(e.target.value)/1000;
  };
  D.querySelectorAll('[data-photo]').forEach(btn=>btn.onclick=()=>showPhotos(btn.dataset.photo));
  try{state.resume=JSON.parse(localStorage.getItem('raash-last-v5'))}catch(e){state.resume=null}
  applyVolume();
  bindSession();
  for(const ev of ['play','pause','timeupdate','loadedmetadata','ended'])audio.addEventListener(ev,syncPlayer);
  audio.addEventListener('timeupdate',remember);
  const param=new URLSearchParams(location.search).get('suno');
  render();
  if(param&&window.RaashSunoV8?.readLink?.(param)){
    if(window.RaashYafeV9?.batchDialog)window.RaashYafeV9.batchDialog();
    const box=q('#s9Batch');if(box)box.value=param;
  }
}
function render(){
  if(!q('#songList'))return;
  const album=current;
  q('#albumTitle').textContent=album.name||'Альбом';
  const variants=songs().flatMap(t=>t.variants||[]);
  const files=variants.filter(v=>v.fileKey).length;
  const links=variants.filter(v=>v.suno&&!v.fileKey).length;
  q('#counts').textContent=songs().length+' '+plural(songs().length,'песня','песни','песен')+' · '+files+' '+plural(files,'файл','файла','файлов')+(links?' · '+links+' Suno':'');
  q('#listMeta').textContent=(songs().length*2)+' версии';
  q('#listen').textContent=canResume()?'▶ Продолжить':'▶ Слушать';
  const albums=q('#albums');
  if(library.albums.length>1){
    albums.hidden=false;
    albums.innerHTML=library.albums.map(a=>'<button type="button" data-album="'+esc(a.id)+'" class="'+(a.id===album.id?'on':'')+'">'+esc(a.name)+'</button>').join('');
    albums.querySelectorAll('[data-album]').forEach(btn=>btn.onclick=()=>{
      if(btn.dataset.album===current.id)return;
      library.current=btn.dataset.album;
      current=library.albums.find(a=>a.id===library.current)||library.albums[0];
      save();paint();
    });
  }else{albums.hidden=true;albums.innerHTML=''}
  const host=q('#songList');
  host.innerHTML=songs().length?songs().map((t,i)=>songRow(t,i)).join(''):'<p class="empty-list">В альбоме пока нет песен. Их можно добавить в студии.</p>';
  host.querySelectorAll('[data-open]').forEach(btn=>btn.onclick=()=>openSong(btn.dataset.open));
  host.querySelectorAll('.slot').forEach(btn=>btn.onclick=()=>activate(btn.dataset.id,Number(btn.dataset.v)));
  drawCover();
  syncPlayer();
}
function songRow(t,i){
  const takes=Array.isArray(t.takes)?t.takes.length:0;
  const bits=[t.trans||'',takes?takes+' '+plural(takes,'дубль','дубля','дублей'):''].filter(Boolean);
  const slots=[0,1].map(v=>{
    const slot=t.variants[v]||{};
    const kind=kindOf(slot);
    const on=selected&&selected.id===t.id&&selected.v===v?' is-on':'';
    const word=kindWord(slot);
    return '<button type="button" class="slot '+kind+on+'" data-id="'+esc(t.id)+'" data-v="'+v+'" aria-label="'+esc(t.name)+', версия '+(v?'B':'A')+', '+word+'"><b>'+(v?'B':'A')+'</b><span>'+word+'</span></button>';
  }).join('');
  return '<article class="song"><button type="button" class="song-open" data-open="'+esc(t.id)+'"><span class="num">'+String(i+1).padStart(2,'0')+'</span><span class="song-text"><strong dir="auto">'+esc(t.name)+'</strong><small>'+esc(bits.join(' · ')||"רעש יפה")+'</small></span></button><div class="ab">'+slots+'</div></article>';
}
function drawCover(){
  const album=current;
  const img=q('#cover');if(!img)return;
  const token=album.id+':'+(album.coverKey||'');
  if(state.coverToken===token)return;
  state.coverToken=token;
  if(!album.coverKey){img.src=album.id==='ani-po'?'assets/front.webp':'cover.svg';return}
  get(album.coverKey).then(blob=>{
    if(state.coverToken!==token)return;
    if(!(blob instanceof Blob)){img.src='cover.svg';return}
    if(state.coverUrl)URL.revokeObjectURL(state.coverUrl);
    state.coverUrl=URL.createObjectURL(blob);
    img.src=state.coverUrl;
  }).catch(()=>{if(state.coverToken===token)img.src='cover.svg'});
}
function canResume(){
  const s=state.resume;
  if(!s||s.album!==current.id||!(s.seconds>2))return false;
  const t=find(s.id);
  return Boolean(t?.variants?.[s.v]?.fileKey);
}
function listen(){
  if(canResume())return resume();
  const file=songs().find(t=>(t.variants||[]).some(v=>v.fileKey));
  if(file)return playSong(file.id);
  const link=songs().find(t=>(t.variants||[]).some(v=>v.suno));
  if(link)return playSong(link.id);
  notify('Добавь MP3 или ссылку Suno');
}
function resume(){
  const s=state.resume,t=find(s.id);if(!t)return listen();
  audio.addEventListener('loadedmetadata',function jump(){
    if(Number.isFinite(audio.duration))audio.currentTime=Math.min(s.seconds,Math.max(0,audio.duration-.25));
  },{once:true});
  startPlay(t,s.v);
}
function activate(id,index){
  const t=find(id),v=t?.variants?.[index];if(!t||!v)return;
  selected={id,v:index};
  if(v.fileKey){state.streaming=null;startPlay(t,index);return}
  if(v.suno){
    state.streaming={id,index};
    audio.pause();
    if(audio.src){audio.removeAttribute('src');audio.load()}
    syncPlayer();
    const open=window.RaashSunoV8?.openStream||window.RaashSunoV6?.openStream;
    if(open)open(id,index);else notify('Плеер Suno сейчас недоступен');
    return;
  }
  if(window.RaashYafeV9?.showAttach)window.RaashYafeV9.showAttach(id,index);
  else editVariant(id,index);
}
function toggle(){
  if(state.streaming&&selected){
    const t=find(selected.id);
    if(t?.variants?.[selected.v]?.suno)return activate(selected.id,selected.v);
  }
  if(audio.src){
    if(audio.paused)audio.play().catch(()=>notify('Не удалось воспроизвести'));
    else audio.pause();
    return;
  }
  listen();
}
function noteLocal(){state.streaming=null;publishSession()}
function syncPlayer(){
  const t=selected&&find(selected.id);
  const letter=selected?selected.v?'B':'A':'';
  q('#nowTitle').textContent=t?.name||'Выбери песню';
  q('#nowSub').textContent=state.streaming
    ?'Suno · версия '+letter+' · нужен интернет'
    :t?'Версия '+letter+' · '+(current.name||''):'Свой плеер';
  q('#play').textContent=!state.streaming&&audio.src&&!audio.paused?'Ⅱ':'▶';
  q('#elapsed').textContent=state.streaming?'0:00':hh(audio.currentTime);
  q('#duration').textContent=state.streaming?'0:00':hh(audio.duration);
  if(!state.seeking)q('#range').value=(!state.streaming&&Number.isFinite(audio.duration)&&audio.duration>0)?String(Math.round(audio.currentTime/audio.duration*1000)):'0';
  D.querySelectorAll('#songList .slot').forEach(btn=>{
    btn.classList.toggle('is-on',!!selected&&btn.dataset.id===selected.id&&Number(btn.dataset.v)===selected.v);
  });
  publishSession();
}
function remember(){
  if(state.streaming||!selected||!audio.src||!(audio.currentTime>2))return;
  const now=Date.now();
  if(remember.at&&now-remember.at<2000)return;
  remember.at=now;
  state.resume={album:current.id,id:selected.id,v:selected.v,seconds:audio.currentTime};
  try{localStorage.setItem('raash-last-v5',JSON.stringify(state.resume))}catch(e){}
  if(q('#listen')&&canResume()&&q('#listen').textContent.indexOf('Продолжить')<0)q('#listen').textContent='▶ Продолжить';
}
function bindSession(){
  if(!('mediaSession'in navigator))return;
  const set=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch(e){}};
  set('play',()=>audio.play());
  set('pause',()=>audio.pause());
  set('nexttrack',()=>nextPrev(1));
  set('previoustrack',()=>nextPrev(-1));
  set('seekto',details=>{
    if(!Number.isFinite(details.seekTime))return;
    audio.currentTime=details.seekTime;
  });
}
function artwork(){
  const src=q('#cover')?.currentSrc||q('#cover')?.src||'';
  if(/^https?:/i.test(src))return [{src,sizes:'512x512',type:'image/webp'}];
  return [{src:new URL('assets/front.webp',location.href).href,sizes:'512x512',type:'image/webp'}];
}
function publishSession(){
  if(!('mediaSession'in navigator)||!window.MediaMetadata)return;
  const t=selected&&find(selected.id);
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:t?.name||'רעש יפה',
      artist:'רעש יפה',
      album:current?.name||'',
      artwork:artwork()
    });
    navigator.mediaSession.playbackState=audio.src&&!audio.paused?'playing':'paused';
    if(!state.streaming&&Number.isFinite(audio.duration)&&audio.duration>0){
      navigator.mediaSession.setPositionState({
        duration:audio.duration,
        playbackRate:audio.playbackRate||1,
        position:Math.min(audio.currentTime||0,audio.duration)
      });
    }
  }catch(e){}
}
function attachLocal(id,index){
  const t=find(id);if(!t)return;
  selected={id,v:index,video:false};
  const input=q('#mediafile');
  input.setAttribute('accept','audio/*,.mp3,.m4a,.wav,.aac,.flac');
  input.click();
}
async function consumeImage(file){
  if(!state.trackCoverFor)return false;
  const id=state.trackCoverFor;
  state.trackCoverFor=null;
  const t=find(id);
  if(!t)return true;
  if(file.size>25*1024*1024){notify('Обложка больше 25 МБ');return true}
  const key='image:'+current.id+':'+t.id+':track-cover';
  await put(key,file);
  t.coverKey=key;
  save();paint();
  notify('Обложка песни сохранена');
  openSong(id);
  return true;
}
function fromSuno(){
  if(window.RaashYafeV9?.batchDialog)return window.RaashYafeV9.batchDialog();
  if(window.RaashSunoV8?.importDialog)return window.RaashSunoV8.importDialog();
  notify('Добавление из Suno сейчас недоступно');
}
function openTools(){
  const volume=Math.round((Number.isFinite(Number(library.volume))?Math.max(0,Math.min(1,Number(library.volume))):1)*100);
  openSheet('Студия',
    '<p>Слушать, добавлять Suno и сохранять ZIP можно с главного экрана. Здесь — звук, запись и копии.</p>'+
    '<label class="field" for="ryVolume">Громкость · без усиления выше исходной</label>'+
    '<input id="ryVolume" class="fieldinput" type="range" min="0" max="100" value="'+volume+'" aria-label="Громкость">'+
    '<button type="button" class="choice" id="ryEQ">Эквалайзер</button>'+
    '<button type="button" class="choice" id="ryRec">Запись и сведение</button>'+
    '<button type="button" class="choice" id="ryText">Текст и стиль</button>'+
    '<button type="button" class="choice" id="ryZip">Сохранить всё в ZIP</button>'+
    '<button type="button" class="choice" id="ryRestore">Восстановить из ZIP</button>'+
    '<button type="button" class="choice" id="ryAlbum">Новый альбом</button>'+
    '<button type="button" class="choice" id="ryFromFiles">Альбом из своих файлов</button>'+
    '<button type="button" class="choice" id="ryTrack">Новая песня</button>'+
    '<button type="button" class="choice" id="ryCover">Обложка альбома</button>'+
    '<button type="button" class="choice" id="ryBack">Задняя обложка</button>'+
    '<button type="button" class="choice" id="ryPics">Фотографии группы</button>'+
    '<details class="more"><summary>Старый список без записей</summary><p>Этот файл хранит только названия и ссылки, без MP3.</p><button type="button" class="quiet" id="ryJsonOut">Скачать список</button><button type="button" class="quiet" id="ryJsonIn">Загрузить список</button></details>');
  q('#ryVolume').oninput=e=>{
    const value=Math.max(0,Math.min(100,Number(e.target.value)||0))/100;
    library.volume=value;audio.volume=value;save();
  };
  q('#ryEQ').onclick=()=>window.RaashStudioV4?.showEQ();
  q('#ryRec').onclick=()=>pickSong('Для какой песни запись?',id=>window.RaashStudioV4?.openFor(id));
  q('#ryText').onclick=()=>pickSong('Текст какой песни открыть?',id=>window.RaashStudioV3?.studioSong?window.RaashStudioV3.studioSong(id):openSong(id));
  q('#ryZip').onclick=()=>createFullBackup();
  q('#ryRestore').onclick=()=>q('#importzip').click();
  q('#ryAlbum').onclick=()=>addAlbum();
  q('#ryFromFiles').onclick=()=>window.RaashStudioV3?.createAlbumDialog?.();
  q('#ryTrack').onclick=newSong;
  q('#ryCover').onclick=()=>{window.imageTarget='coverKey';q('#imagefile').click()};
  q('#ryBack').onclick=()=>{window.imageTarget='backKey';q('#imagefile').click()};
  q('#ryPics').onclick=()=>showPhotos();
  q('#ryJsonOut').onclick=()=>{
    const blob=new Blob([JSON.stringify(library,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=D.createElement('a');
    a.href=url;a.download='raash-yafe-library.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
  q('#ryJsonIn').onclick=()=>q('#importjson').click();
}
function pickSong(title,done){
  if(!songs().length){notify('Сначала добавь песню');return}
  if(songs().length===1)return done(songs()[0].id);
  openSheet(title,songs().map(t=>'<button type="button" class="choice" data-pick="'+esc(t.id)+'">'+esc(t.name)+'</button>').join(''));
  q('#sheetbody').querySelectorAll('[data-pick]').forEach(btn=>btn.onclick=()=>done(btn.dataset.pick));
}
function newSong(){
  openSheet('Новая песня','<label class="field" for="ryName">Название</label><input id="ryName" class="fieldinput" placeholder="שם השיר"><label class="field" for="ryTrans">Подпись</label><input id="ryTrans" class="fieldinput" placeholder="Как читается"><button type="button" class="primary" id="ryAddSong">Добавить</button>');
  q('#ryAddSong').onclick=()=>{
    const name=q('#ryName').value.trim();if(!name){notify('Введите название');return}
    current.tracks.push(makeSong(name,q('#ryTrans').value.trim()));
    save();closeSheet();paint();notify('Песня добавлена');
  };
}
function openSong(id){
  const t=find(id);if(!t)return;
  const takes=Array.isArray(t.takes)?t.takes.length:0;
  const playSlots=[0,1].map(index=>{
    const v=t.variants[index]||{};
    const letter=index?'B':'A';
    const playWord=v.fileKey?'Слушать':v.suno?'Suno':'Пусто';
    return '<button type="button" class="slot '+kindOf(v)+'" data-song-play="'+index+'"><b>'+letter+'</b><span>'+playWord+'</span></button>';
  }).join('');
  const fileSlots=[0,1].map(index=>{
    const v=t.variants[index]||{};
    const letter=index?'B':'A';
    return '<button type="button" class="quiet" data-song-file="'+index+'">'+(v.fileKey?'Заменить '+letter:'Свой MP3 · '+letter)+'</button>';
  }).join('');
  openSheet(t.name,
    '<div class="song-card"><div class="cover"><img id="songCover" alt="Обложка песни"></div><div><p class="meta" dir="auto">'+esc(t.trans||current.name)+'</p><p class="meta">'+(takes?takes+' '+plural(takes,'дубль','дубля','дублей'):'Своих дублей пока нет')+'</p><button type="button" class="quiet" id="ryFav">'+(t.favorite?'♥ В избранном':'♡ В избранное')+'</button></div></div>'+
    '<div class="ab">'+playSlots+'</div><div class="ab">'+fileSlots+'</div>'+
    '<button type="button" class="block" id="ryLyrics">Текст и стиль</button>'+
    '<button type="button" class="block" id="rySongRec">Записать вокал или инструмент</button>'+
    '<button type="button" class="block" id="rySongCover">Обложка этой песни</button>'+
    '<button type="button" class="block" id="ryClip">'+(t.videoKey?'Смотреть клип':'Добавить клип')+'</button>'+
    '<details class="more"><summary>Название и удаление</summary>'+
    '<label class="field" for="ryRename">Название</label><input id="ryRename" class="fieldinput" value="'+esc(t.name)+'">'+
    '<label class="field" for="ryResign">Подпись</label><input id="ryResign" class="fieldinput" value="'+esc(t.trans||'')+'">'+
    '<button type="button" class="primary" id="ryRenameSave">Сохранить название</button>'+
    '<button type="button" class="danger" id="ryDelete">Удалить песню из альбома</button></details>');
  const img=q('#songCover');
  img.src=t.coverKey?q('#cover').src:(current.coverKey?q('#cover').src:(current.id==='ani-po'?'assets/front.webp':'cover.svg'));
  if(t.coverKey)get(t.coverKey).then(blob=>{if(blob instanceof Blob&&q('#songCover'))q('#songCover').src=URL.createObjectURL(blob)}).catch(()=>{});
  q('#sheetbody').querySelectorAll('[data-song-play]').forEach(btn=>btn.onclick=()=>activate(id,Number(btn.dataset.songPlay)));
  q('#sheetbody').querySelectorAll('[data-song-file]').forEach(btn=>btn.onclick=()=>attachLocal(id,Number(btn.dataset.songFile)));
  q('#ryFav').onclick=()=>{t.favorite=!t.favorite;save();paint();openSong(id);notify(t.favorite?'В избранном':'Убрано из избранного')};
  q('#ryLyrics').onclick=()=>window.RaashStudioV3?.studioSong?window.RaashStudioV3.studioSong(id):notify('Редактор текста недоступен');
  q('#rySongRec').onclick=()=>window.RaashStudioV4?.openFor(id);
  q('#rySongCover').onclick=()=>{state.trackCoverFor=id;q('#imagefile').click()};
  q('#ryClip').onclick=()=>t.videoKey?viewClip(t):addClip(id);
  q('#ryRenameSave').onclick=()=>{
    const name=q('#ryRename').value.trim();if(!name){notify('Введите название');return}
    t.name=name;t.trans=q('#ryResign').value.trim();save();closeSheet();paint();notify('Название сохранено');
  };
  q('#ryDelete').onclick=()=>{
    if(!confirm('Убрать песню из альбома? Файлы в уже сохранённом ZIP не изменятся.'))return;
    current.tracks=current.tracks.filter(x=>x.id!==id);
    if(selected?.id===id)selected=null;
    save();closeSheet();paint();
  };
}
function addClip(id){
  selected={id,v:0,video:true};
  const input=q('#mediafile');
  input.setAttribute('accept','video/*,.mp4,.mov');
  input.click();
}
async function viewClip(t){
  const file=await get(t.videoKey);
  if(!file){notify('Клип не найден');return}
  const url=URL.createObjectURL(file);
  openSheet('Клип · '+t.name,'<video controls playsinline src="'+url+'"></video><p>Клип хранится на этом телефоне.</p>');
  q('#close').addEventListener('click',()=>setTimeout(()=>URL.revokeObjectURL(url),1000),{once:true});
}
function showPhotos(focus){
  const photos=[['front','assets/front.webp','Обложка альбома'],['studio','assets/studio.webp','В студии'],['live','assets/live.webp','На сцене'],['back','assets/back.webp','Задняя обложка']];
  openSheet('Фотографии', '<div class="photo-view">'+photos.map(x=>'<figure id="photo-'+x[0]+'"><img src="'+x[1]+'" alt="'+esc(x[2])+'"><figcaption>'+esc(x[2])+'</figcaption></figure>').join('')+'</div>');
  if(focus)q('#photo-'+focus)?.scrollIntoView({block:'nearest'});
}
window.RaashV13={render,syncPlayer,attachLocal,noteLocal,consumeImage,openSong};
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
