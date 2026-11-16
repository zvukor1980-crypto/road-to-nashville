/* Raash Yafe 6 — paste Suno song links, keep them in existing albums, play in-page via official embed. */
(function(){
'use strict';
const D=document;
const $=s=>D.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ST={input:'',lastImported:0};
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
  '<button id="sSunoAdd" class="s6-big">＋ Добавить песни из Suno</button>'+
  '<p id="sSunoEmpty">Скопируй ссылку на свою песню в Suno, вставь сюда — и она появится в альбоме.</p>';
 $('#sAlbums').before(div);
 $('#sSunoAdd').onclick=importDialog;
 const originalPaint=paint;paint=function(){originalPaint();drawSuno()};
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
 const options='<option value="auto">Автоматически — новая песня или совпадающее название</option>'+
  current.tracks.flatMap(t=>t.variants.map((v,i)=>
  '<option value="'+esc(t.id)+'|'+i+'"'+(v.suno?' disabled':'')+'>'+esc(t.name)+' — версия '+(i?'B':'A')+(v.suno?' (уже есть ссылка)':'')+'</option>')).join('');
 openSheet('Песни из Suno',
  '<div class="s6-steps"><b>1.</b> Открой свою песню в Suno и скопируй её ссылку.<br><b>2.</b> Вставь ссылку сюда.<br><b>3.</b> Нажми «Добавить» — песня появится в этом альбоме.</div>'+
  '<label class="field" for="s6Paste">Одна или несколько ссылок</label>'+
  '<textarea id="s6Paste" class="s6-textarea" rows="6" placeholder="https://suno.com/song/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\n\nМожно сразу несколько ссылок — по одной в строке. Название можно написать перед ссылкой.">'+esc(ST.input)+'</textarea>'+
  '<button id="s6Clipboard" class="s6-paste">Вставить из буфера iPhone</button>'+
  '<label class="field" for="s6Dest">Для одной песни можно выбрать конкретную версию</label>'+
  '<select id="s6Dest" class="fieldinput">'+options+'</select>'+
  '<p id="s6Preview" class="s6-muted">Ссылки сохраняются в приложении. При прослушивании звук передаёт Suno — нужен интернет.</p>'+
  '<button id="s6Commit" class="cta">＋ Добавить песни в альбом</button>'+
  '<p class="s6-footnote">Пароль не нужен. Скачивание MP3 не выполняется. Короткие ссылки /s/ тоже сохраняются, но для встроенного плеера надёжнее полная ссылка /song/.</p>'
 );
 const input=$('#s6Paste'),dest=$('#s6Dest');
 function refresh(){
  const n=extract(input.value).length;
  $('#s6Preview').textContent=n?n+' ссылок распознано. После добавления они появятся среди песен.':'Вставь ссылку вида suno.com/song/...';
  dest.disabled=n!==1;
 }
 input.oninput=()=>{ST.input=input.value;refresh()};refresh();
 $('#s6Clipboard').onclick=async()=>{
  try{
   const pasted=await navigator.clipboard.readText();
   if(!pasted.trim())return notify('Буфер обмена пуст');
   input.value=input.value.trim()?input.value.trim()+'\n'+pasted:pasted;
   ST.input=input.value;refresh();
  }catch(e){input.focus();notify('Нажми в поле и выбери «Вставить»')}
 };
 $('#s6Commit').onclick=()=>{
  const links=extract(input.value),explicit=dest.disabled?'auto':dest.value;
  if(!links.length){notify('Нужна ссылка на конкретную песню Suno');return}
  const existing=allKeys(),album=current;
  let added=0,duplicates=0,created=0,short=0;
  for(const [i,link] of links.entries()){
   if(existing.has(link.key)){duplicates++;continue}
   let t=null,v=-1;
   if(explicit!=='auto'&&links.length===1){
    const parts=explicit.split('|');
    t=album.tracks.find(t=>t.id===parts[0]);
    v=Number(parts[1]);
    if(!t||![0,1].includes(v)||t.variants[v]?.suno){t=null;v=-1}
   }
   if(!t&&link.label){
    const norm=normalize(link.label);
    t=album.tracks.find(t=>normalize(t.name)===norm||normalize(t.trans)===norm)||null;
    if(t){v=t.variants.findIndex(x=>!x.suno);if(v<0)t=null}
   }
   if(!t){
    const title=link.label||('Запись Suno '+String(album.tracks.length+1).padStart(2,'0'));
    t=makeSong(title,link.label?'':'Из Suno · переименовать через карточку песни');
    album.tracks.push(t);v=0;created++;
   }
   t.variants[v].suno=link.url;
   if(link.short)short++;
   existing.add(link.key);added++;
  }
  library.current=album.id;current=album;save();ST.input='';closeSheet();paint();
  if(!added)return notify('Эти ссылки уже есть в библиотеке');
  notify('Готово! Добавлено '+added+' ссылок'+(duplicates?' · повторов '+duplicates:''));
  if(short)openSheet('Ссылки добавлены','<p>Добавлено '+added+' песен. Из них '+short+' с короткими ссылками /s/. Они сохранены, но для воспроизведения во встроенном плеере может понадобиться полный адрес /song/.</p><button class="cta" id="s6Done">К альбому</button>'),$('#s6Done').onclick=closeSheet;
 };
}
function openStream(id,version){
 const t=getTrack(id),v=t?.variants?.[version];
 if(!t||!v)return;
 if(v.fileKey){return startPlay(t,version)}
 const link=readLink(v.suno||'');
 if(!link)return importDialog();
 audio.pause();
 if(link.short){
  openSheet('Нужна полная ссылка · '+t.name,
   '<p class="s6-help">Песня добавлена в библиотеку, но Suno выдал короткую ссылку. Чтобы встроенный плеер получил запись, нужен полный адрес вида <b>suno.com/song/...</b>.</p>'+
   '<div class="s6-steps">Открой эту ссылку один раз в Suno, нажми название песни, затем скопируй адрес из Safari и вставь ниже.</div>'+
   '<button id="s6OpenShort" class="s6-paste">Открыть короткую ссылку Suno</button>'+
   '<label class="field">Полная ссылка на эту песню</label>'+
   '<input id="s6Long" class="fieldinput" type="url" placeholder="https://suno.com/song/...">'+
   '<button id="s6Fix" class="cta">Сохранить и слушать здесь</button>');
  $('#s6OpenShort').onclick=()=>window.open(link.url,'_blank','noopener');
  $('#s6Fix').onclick=()=>{
   const next=readLink($('#s6Long').value);
   if(!next||next.short){notify('Нужна полная ссылка /song/ с номером песни');return}
   v.suno=next.url;save();paint();openStream(id,version);
  };
  return;
 }
 const embed='https://suno.com/embed/'+link.id;
 openSheet('Слушать · '+t.name,
  '<p class="s6-player-note">Песня играет <b>здесь, внутри רעש יפה</b>. Нажми ▶ на плеере ниже. Интернет нужен только для потоковых записей Suno.</p>'+
  '<div class="s6-frame"><iframe title="Плеер Suno — '+esc(t.name)+'" src="'+embed+'" allow="autoplay; encrypted-media" loading="eager"></iframe></div>'+
  '<div class="s6-play-desc"><b>Сейчас:</b> '+esc(t.name)+' · '+(version?'B':'A')+'<br><span>Для полностью автономного прослушивания потом добавь свой MP3.</span></div>'+
  '<button class="s6-paste" id="s6ImportMP3">＋ Позже сохранить аудиофайл в программу</button>');
 $('#s6ImportMP3').onclick=()=>{
  closeSheet();
  const btn=$('#sSongs [data-open="'+CSS.escape(id)+'"]');
  if(btn)btn.click();else notify('Выбери песню в альбоме');
 };
}
window.RaashSunoV6={importDialog,openStream,readLink,extract};
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();