/* Raash Yafe v3: track studio, lacquer cards, favorites, batch album creation */
(function(){
'use strict';
const D=document,st={query:'',filter:'all',albumId:null,coverTarget:null,albumName:'',images:new Map()};
const enc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tracks=()=>Array.isArray(current.tracks)?current.tracks:[];
const song=id=>tracks().find(t=>t.id===id);
const audioFile=f=>f&&(/^audio\//.test(f.type)||/\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i.test(f.name));
function copying(v){
 if(!v)return notify('Текст пока пуст');
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(v).then(()=>notify('Скопировано')).catch(()=>window.prompt('Скопируй текст:',v));
 else window.prompt('Скопируй текст:',v);
}
function ensureStudioInputs(){
 if(D.querySelector('#trackCoverFile'))return;
 const cover=D.createElement('input');cover.id='trackCoverFile';cover.type='file';cover.accept='image/*';cover.hidden=true;D.body.append(cover);
 cover.onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const t=song(st.coverTarget);if(!t)return notify('Песня не найдена');
  if(!f.type.startsWith('image/'))return notify('Выбери фотографию');
  if(f.size>25*1024*1024)return notify('Обложка больше 25 МБ');
  const key='image:'+current.id+':'+t.id+':track-cover';
  try{await put(key,f);if(st.images.has(key)){URL.revokeObjectURL(st.images.get(key));st.images.delete(key)}t.coverKey=key;save();closeSheet();paint();notify('Обложка песни сохранена')}catch(err){notify('Не удалось сохранить фото')}
 };
 const batch=D.createElement('input');batch.id='studioFiles';batch.type='file';batch.accept='audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus';batch.multiple=true;batch.hidden=true;D.body.append(batch);
 batch.onchange=async e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)await makeAlbum(files)};
}
function setup(){
 ensureStudioInputs();
 if(document.documentElement.dataset.ry==='13')return;
 const target=D.querySelector('#tracks');if(!target)return;
 const tools=D.createElement('div');
 tools.id='studioTools';
 tools.innerHTML='<div class="studio-search"><span>⌕</span><input id="studioSearch" type="search" placeholder="Поиск песни" aria-label="Поиск по альбому"></div><div class="studio-filter-row"><button class="studio-pill on" data-filter="all">Все</button><button class="studio-pill" data-filter="ready">С аудио</button><button class="studio-pill" data-filter="favorites">Избранное</button><button class="studio-pill studio-new-album" id="studioAlbumImport">＋ Альбом из MP3</button></div>';
 target.before(tools);
 D.querySelector('#studioSearch').oninput=e=>{st.query=e.target.value.toLocaleLowerCase().trim();filter()};
 tools.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{st.filter=x.dataset.filter;tools.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('on',b===x));filter()});
 D.querySelector('#studioAlbumImport').onclick=createAlbumDialog;
 const original=paint;paint=function(){original();enrich()};enrich();
}
function filter(){
 let visible=0;const cards=D.querySelectorAll('#tracks .track');
 cards.forEach(card=>{
  const t=song(card.dataset.songid);if(!t)return;
  const match=!st.query||(t.name+' '+(t.trans||'')).toLocaleLowerCase().includes(st.query);
  const ready=t.variants.some(v=>v.fileKey);
  const status=st.filter==='all'||(st.filter==='ready'&&ready)||(st.filter==='favorites'&&t.favorite);
  card.hidden=!(match&&status);if(!card.hidden)visible++;
 });
 let empty=D.querySelector('#studioEmpty');
 if(!empty){empty=D.createElement('p');empty.id='studioEmpty';empty.className='studio-empty';D.querySelector('#tracks').after(empty)}
 empty.hidden=cards.length===0||visible>0;
 empty.textContent=st.filter==='ready'?'На этом альбоме ещё нет скачанных записей.':'По этому запросу песен не найдено.';
}
function enrich(){
 if(!D.querySelector('#studioTools'))return;
 if(st.albumId!==current.id){
  st.albumId=current.id;st.query='';st.filter='all';D.querySelector('#studioSearch').value='';
  D.querySelectorAll('.studio-pill[data-filter]').forEach(b=>b.classList.toggle('on',b.dataset.filter==='all'));
 }
 D.querySelectorAll('#tracks .track').forEach(card=>{
  const id=card.querySelector('[data-play]')?.dataset.play,t=song(id);
  if(!t)return;card.dataset.songid=id;
  const row=D.createElement('div');row.className='studio-track-extras';
  row.innerHTML='<button class="studio-extra" data-studio="'+enc(id)+'">✎ Текст · Стиль</button><button class="studio-extra" data-cover="'+enc(id)+'">▣ Фото</button><button class="studio-fav '+(t.favorite?'on':'')+'" data-fav="'+enc(id)+'" aria-label="Избранное">'+(t.favorite?'♥':'♡')+'</button>';
  card.append(row);
  const line=card.querySelector('.trackline'),info=line?.querySelector('.tt');
  if(info){const art=D.createElement('img');art.className='studio-track-art';art.alt='';art.loading='lazy';line.insertBefore(art,info);showArt(art,t)}
  row.querySelector('[data-studio]').onclick=()=>studioSong(id);
  row.querySelector('[data-cover]').onclick=()=>{st.coverTarget=id;D.querySelector('#trackCoverFile').click()};
  row.querySelector('[data-fav]').onclick=()=>{t.favorite=!t.favorite;save();paint();notify(t.favorite?'Добавлено в избранное':'Убрано из избранного')};
 });
 filter();
}
function showArt(el,t){
 const fallback=D.querySelector('#cover')?.src||'cover.svg';
 if(!t.coverKey){el.src=fallback;return}
 const key=t.coverKey;
 if(st.images.has(key)){el.src=st.images.get(key);return}
 el.src=fallback;
 get(key).then(b=>{
  if(!(b instanceof Blob)||!D.contains(el)||song(t.id)!==t)return;
  const url=URL.createObjectURL(b);st.images.set(key,url);el.src=url;
 }).catch(()=>{});
}
function studioSong(id){
 const t=song(id);if(!t)return;
 openSheet('Студия · '+t.name,
 '<p>Храни здесь текст песни и описание стиля для Suno. Лимиты: Lyrics — 5000 символов, Style — 1000.</p>'+
 '<div class="studio-heading"><span>Lyrics / Текст</span><span id="lyricsCount"></span></div>'+
 '<textarea id="studioLyrics" maxlength="5000" class="studio-editor" rows="11" placeholder="[Verse 1]...">'+enc(t.lyrics||'')+'</textarea>'+
 '<div class="studio-heading"><span>Style of Music</span><span id="styleCount"></span></div>'+
 '<textarea id="studioStyle" maxlength="1000" class="studio-editor" rows="5" placeholder="Hebrew grunge, two female vocalists...">'+enc(t.sunoStyle||'')+'</textarea>'+
 '<div class="studio-buttons"><button class="ghost" id="studioCopyLyrics">Копировать Lyrics</button><button class="ghost" id="studioCopyStyle">Копировать Style</button></div>'+
 '<button class="cta" style="width:100%" id="studioSave">Сохранить текст и стиль</button>'+
 '<div class="studio-buttons"><button class="ghost" id="studioA">Версия A · Suno/MP3</button><button class="ghost" id="studioB">Версия B · Suno/MP3</button></div>'+
 '<button class="ghost" style="width:100%;margin-top:8px" id="studioCover">▣ Обложка этой песни</button>'+
 '<p>Ничего не отправляется в Suno автоматически. Ссылки на две версии песни хранятся отдельно.</p>');
 const l=D.querySelector('#studioLyrics'),s=D.querySelector('#studioStyle');
 const counter=()=>{D.querySelector('#lyricsCount').textContent=l.value.length+' / 5000';D.querySelector('#styleCount').textContent=s.value.length+' / 1000'};
 l.oninput=counter;s.oninput=counter;counter();
 D.querySelector('#studioSave').onclick=()=>{t.lyrics=l.value;t.sunoStyle=s.value;save();closeSheet();notify('Текст и стиль сохранены')};
 D.querySelector('#studioCopyLyrics').onclick=()=>copying(l.value);
 D.querySelector('#studioCopyStyle').onclick=()=>copying(s.value);
 D.querySelector('#studioCover').onclick=()=>{st.coverTarget=id;D.querySelector('#trackCoverFile').click()};
 D.querySelector('#studioA').onclick=()=>editVariant(id,0);
 D.querySelector('#studioB').onclick=()=>editVariant(id,1);
}
function createAlbumDialog(){
 openSheet('Новый альбом из MP3',
 '<p>Создам песни по названиям выбранных аудиофайлов. Если у записи в конце имени указано A/B или v1/v2, это будут два варианта одной песни.</p>'+
 '<label class="field">Название нового альбома</label><input class="fieldinput" id="studioAlbumName" maxlength="90" placeholder="Новый альбом">'+
 '<button class="cta" id="studioChooseFiles">Выбрать аудиофайлы</button>'+
 '<p>Файлы остаются на этом iPhone. После импорта желательно сохранить ZIP-копию.</p>');
 D.querySelector('#studioChooseFiles').onclick=()=>{const n=D.querySelector('#studioAlbumName').value.trim();if(!n)return notify('Введи название');st.albumName=n;D.querySelector('#studioFiles').click()};
}
function nameAndVariant(filename){
 const base=filename.replace(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i,'').trim();
 const m=base.match(/(?:[\s._-]+(?:v(?:er(?:sion)?)?\s*)?([12AB])\s*$)|(?:\s*\(([12])\)\s*$)/i);
 if(!m)return {title:base,variant:-1};
 const tag=m[1]||m[2],title=base.slice(0,m.index).trim()||base;
 return {title,variant:/^(2|B)$/i.test(tag)?1:0};
}
async function makeAlbum(files){
 const candidates=files.filter(audioFile);
 if(!candidates.length)return notify('Нужны аудиофайлы MP3, WAV или M4A');
 const id='album-'+Date.now();
 const a={id,name:st.albumName||'Новый альбом',description:'Импортировано из файлов',coverKey:null,backKey:null,tracks:[]};
 const groups=new Map();let skipped=0;
 for(const file of candidates){
  const parsed=nameAndVariant(file.name),key=parsed.title.toLocaleLowerCase().replace(/\s+/g,' ');
  let g=groups.get(key);
  if(!g){g={track:makeSong(parsed.title,parsed.title),files:[null,null]};groups.set(key,g);a.tracks.push(g.track)}
  const v=parsed.variant===-1?g.files.findIndex(x=>x===null):parsed.variant;
  if(v<0||g.files[v]){skipped++;continue}g.files[v]=file;
 }
 openSheet('Импорт файлов','<p>Сохраняю записи на iPhone...</p><div class="status" id="studioProgress">Подготовка...</div>');
 let loaded=0,failed=0;
 for(const g of groups.values())for(let i=0;i<2;i++){
  const f=g.files[i];if(!f)continue;
  try{const k='audio:'+id+':'+g.track.id+':'+i;await put(k,f);g.track.variants[i].fileKey=k;g.track.variants[i].fileName=f.name;loaded++}
  catch(e){failed++}
  const p=D.querySelector('#studioProgress');if(p)p.textContent='Готово: '+loaded+' из '+candidates.length;
 }
 if(!loaded){closeSheet();return notify('Сохранение не удалось. Проверь память iPhone')}
 library.albums.push(a);library.current=id;current=a;save();closeSheet();paint();
 notify('Альбом создан: '+a.tracks.length+' песен, '+loaded+' записей');
 if(failed||skipped)openSheet('Импорт с пропусками','<p>Добавлено '+loaded+' записей. Пропущено '+(failed+skipped)+' файлов (дубликаты вариантов или ошибка хранения). Оригиналы не удалены.</p>');
}
window.RaashStudioV3={studioSong,createAlbumDialog};
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();