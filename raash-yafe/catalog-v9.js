/* RA'ASH YAFE v9 — clear A/B music library, no guessed song URLs.
   Existing local IndexedDB and localStorage are preserved.
*/
(function(){
'use strict';
const d=document, q=s=>d.querySelector(s), E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='raash-yafe-v9-seeded-known-reference';
const REMEMBERED='https://suno.com/s/BR9oVyNqADjGCuVu';
const API=()=>window.RaashSunoV8||window.RaashSunoV6;
let busy=false;
function norm(v){return String(v||'').toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'')}
function currentTracks(){return current&&Array.isArray(current.tracks)?current.tracks:[]}
function song(id){return currentTracks().find(t=>t.id===id)}
function variants(t){return Array.isArray(t?.variants)?t.variants:[]}
function playLink(id,index){
 const t=song(id),v=variants(t)[index];
 if(!t||!v)return;
 if(v.fileKey)return startPlay(t,index);
 if(v.suno)return API()?.openStream?.(id,index);
 showAttach(id,index);
}
function seedKnownOnly(){
 const album=library.albums.find(a=>a.id==='ani-po'),t=album?.tracks?.find(x=>x.name==='אני פה!');
 if(!t||!Array.isArray(t.variants))return;
 if(library.migrations?.includes(KEY))return;
 const allLinks=library.albums.flatMap(a=>a.tracks||[]).flatMap(t=>variants(t)).map(v=>v.suno||'');
 const same=allLinks.some(x=>x.toLowerCase()===REMEMBERED.toLowerCase());
 // This address came from the user's screenshot. Keep the link as a reference, do not claim it plays.
 if(!same&&!t.variants[0]?.suno&&!t.variants[0]?.fileKey){t.variants[0].suno=REMEMBERED}
 library.migrations=[...(library.migrations||[]),KEY];save();
}
function status(v){return v.fileKey?'ФАЙЛ':v.suno?'SUNO':'ПУСТО'}
function render(){
 const container=q('#sSongs');if(!container||!q('#simpleApp'))return;
 for(const card of [...container.querySelectorAll('.s-song')]){
  const id=card.querySelector('[data-open]')?.dataset.open,t=song(id);
  if(!t||variants(t).length<2)continue;
  const grid=d.createElement('div');grid.className='s9-versions';
  grid.setAttribute('aria-label','Две версии '+t.name);
  for(let i=0;i<2;i++){
   const v=t.variants[i],st=status(v);
   const b=d.createElement('button');b.type='button';b.className='s9-version '+(v.fileKey?'local':v.suno?'linked':'missing');
   b.innerHTML='<span class="s9-version-letter">'+(i?'B':'A')+'</span><span class="s9-version-state">'+st+'</span><span class="s9-version-action">'+(st==='ПУСТО'?'＋':'▶')+'</span>';
   b.setAttribute('aria-label','Версия '+(i?'B':'A')+', '+(st==='ПУСТО'?'подключить':st==='ФАЙЛ'?'слушать файл':'слушать Suno'));
   b.onclick=()=>playLink(id,i);
   grid.appendChild(b);
  }
  card.append(grid);
 }
 const total=currentTracks().length*2;
 const all=currentTracks().flatMap(t=>variants(t));
 const local=all.filter(v=>v.fileKey).length;
 const links=all.filter(v=>v.suno&&!v.fileKey).length;
 let indicator=q('#s9Coverage');
 if(!indicator){
  indicator=d.createElement('div');indicator.id='s9Coverage';indicator.className='s9-coverage';q('.s-section-head')?.after(indicator);
 }
 if(indicator)indicator.textContent=local+' файлов · '+links+' ссылок Suno · '+total+' мест A/B';
 // A public URL is not an MP3 on device; count accurately.
 if(q('#sHave'))q('#sHave').textContent=local+' файлов · '+links+' ссылок Suno';
 // Avoid a giant plus button overshadowing the two per-version buttons.
 container.querySelectorAll('.s-song-play').forEach(b=>b.classList.add('s9-main-play'));
}
function showAttach(id,index){
 const t=song(id);if(!t)return;
 const vv=t.variants[index];
 openSheet(t.name+' · Версия '+(index?'B':'A'),
  '<p class="s9-help">Здесь будет версия '+(index?'B':'A')+' этой песни. Скопируй ссылку через «Поделиться» в Suno — подойдёт короткая.</p>'+
  '<button id="s9Paste" class="cta" style="width:100%">Вставить ссылку из Suno</button>'+
  '<label class="field" for="s9Input">Или вставь ссылку вручную</label>'+
  '<input id="s9Input" class="fieldinput" type="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://suno.com/s/..." value="'+E(vv.suno||'')+'">'+
  '<button id="s9Save" class="s9-alt">Сохранить ссылку</button>'+
  '<button id="s9File" class="s9-alt">Добавить свой MP3 / WAV</button>'+
  '<p class="s9-note">Ссылка работает через Suno и требует интернет. MP3, если он у тебя есть, играет в нашей программе без Suno.</p>');
 q('#s9Paste').onclick=async()=>{
  try{
   const text=await navigator.clipboard.readText();
   const items=API()?.extract?.(text)||[];
   if(!items.length){notify('Сначала скопируй песню в Suno');return}
   q('#s9Input').value=items[0].url;
   await storeLink(id,index,items[0]);
  }catch(e){q('#s9Input').focus();notify('Нажми в поле и выбери «Вставить»')}
 };
 q('#s9Save').onclick=async()=>{
  const items=API()?.extract?.(q('#s9Input').value)||[];
  if(!items.length)return notify('Ссылка должна быть на песню Suno');
  await storeLink(id,index,items[0]);
 };
 q('#s9File').onclick=()=>{
  closeSheet();const opener=[...d.querySelectorAll('#sSongs [data-open]')].find(x=>x.dataset.open===id);
  if(opener)opener.click();else notify('Не найдена песня');
 };
}
async function storeLink(id,index,ref){
 const t=song(id);if(!t)return;
 let output=ref;
 if(busy)return;busy=true;
 try{
  openSheet('Подключаю версию '+(index?'B':'A'),'<p class="s9-help">Приложение проверяет ссылку автоматически...</p>');
  try{output=await API().resolveSong(ref)}catch(e){output=ref}
  if(t.variants[index].suno&&t.variants[index].suno!==output.url&&!confirm('Заменить прежнюю ссылку версии '+(index?'B':'A')+'?'))return showAttach(id,index);
  t.variants[index].suno=output.url;
  save();paint();API()?.openStream?.(id,index);
 }finally{busy=false}
}
function batchDialog(){
 openSheet('Альбом · две версии A и B',
  '<p class="s9-help">Можешь вставить сразу все скопированные ссылки Suno. Я определю названия и разложу одинаковые песни по вариантам A/B. Чужие или нераспознанные песни без выбора не добавлю.</p>'+
  '<textarea id="s9Batch" class="s6-textarea" rows="6" placeholder="Вставь ссылки Suno, по одной на строку"></textarea>'+
  '<button id="s9FromClipboard" class="s9-alt">Вставить из буфера</button>'+
  '<button id="s9Auto" class="cta" style="width:100%">Найти песни и распределить A/B</button>'+
  '<div id="s9BatchStatus" class="s9-help">Если некоторые названия нельзя определить, покажу их отдельно. Существующие записи не заменяются.</div>');
 q('#s9FromClipboard').onclick=async()=>{
  try{q('#s9Batch').value=await navigator.clipboard.readText()}
  catch(e){q('#s9Batch').focus();notify('Нажми в поле и выбери «Вставить»')}
 };
 q('#s9Auto').onclick=()=>batchAssign(q('#s9Batch').value);
}
async function batchAssign(raw){
 if(busy)return;
 const parsed=API()?.extract?.(raw)||[];
 if(!parsed.length)return notify('Скопируй ссылки Suno');
 const album=current,existing=new Set(library.albums.flatMap(a=>a.tracks||[]).flatMap(t=>variants(t)).map(v=>v.suno).filter(Boolean).map(s=>s.toLowerCase()));
 busy=true;
 let assigned=0,duplicates=0;
 const unresolved=[];
 const button=q('#s9Auto');if(button)button.disabled=true;
 try{
  for(let i=0;i<parsed.length;i++){
   if(q('#s9BatchStatus'))q('#s9BatchStatus').textContent='Проверяю '+(i+1)+' / '+parsed.length;
   const src=parsed[i];let ref=src;
   try{ref=await API().resolveSong(src)}catch(e){}
   if(existing.has(ref.url.toLowerCase())||existing.has(src.url.toLowerCase())){duplicates++;continue}
   const title=norm(ref.label||src.label);
   const songMatch=title?album.tracks.find(t=>norm(t.name)===title||norm(t.trans)===title):null;
   if(!songMatch){unresolved.push(ref);continue}
   const variant=variants(songMatch).findIndex(v=>!v.suno&&!v.fileKey);
   if(variant<0){unresolved.push(ref);continue}
   songMatch.variants[variant].suno=ref.url;existing.add(ref.url.toLowerCase());assigned++;
  }
  save();paint();
  const status=q('#s9BatchStatus');
  if(status)status.textContent='Добавлено: '+assigned+' · Уже были: '+duplicates+' · Требуют проверки: '+unresolved.length;
  if(unresolved.length)showPending(unresolved,album,assigned,duplicates);
  else if(assigned)notify('Песни распределены: '+assigned);
  else if(duplicates)notify('Эти ссылки уже есть в альбоме');
 }finally{busy=false;if(button&&d.contains(button))button.disabled=false}
}
function showPending(items,album,assigned,duplicates){
 openSheet('Нужны названия для '+items.length+' записей',
  '<p class="s9-help">Я сохранил '+assigned+' известных ссылок. Для остальных выбери название песни. Ничего лишнего в альбом не добавляю.</p>'+
  items.map((x,i)=>
   '<label class="field">'+E(x.label||x.url)+'</label><select class="fieldinput" id="s9Unresolved'+i+'">'+
   '<option value="">Не добавлять</option>'+
   album.tracks.flatMap(t=>variants(t).map((v,k)=>'<option value="'+E(t.id)+'|'+k+'"'+(v.suno||v.fileKey?' disabled':'')+'>'+E(t.name)+' — '+(k?'B':'A')+'</option>')).join('')+
   '</select>').join('')+
  '<button class="cta" id="s9SaveMapping">Сохранить выбранные версии</button>');
 q('#s9SaveMapping').onclick=()=>{
  let count=0;const used=new Set();
  items.forEach((x,i)=>{
   const val=q('#s9Unresolved'+i)?.value;
   if(!val||used.has(val))return;
   used.add(val);const [id,k]=val.split('|'),t=album.tracks.find(t=>t.id===id),v=t?.variants?.[Number(k)];
   if(!v||v.suno||v.fileKey)return;
   v.suno=x.url;count++;
  });
  save();closeSheet();paint();notify('Добавлено в A/B: '+count);
 };
}
function appendBulkButton(){
 const hub=q('#sSunoHub');if(!hub)return;
 let batch=q('#s9BatchOpen');
 if(batch)return;
 batch=d.createElement('button');batch.id='s9BatchOpen';batch.className='s9-batch';
 batch.textContent='У меня много ссылок · добавить все сразу';
 batch.onclick=batchDialog;
 hub.append(batch);
}
function setup(){
 if(!q('#simpleApp'))return;
 seedKnownOnly();
 const original=paint;paint=function(){original();render();appendBulkButton()};
 render();appendBulkButton();
}
window.RaashYafeV9={showAttach,batchDialog,render};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();