/* Raash Yafe Studio v4: independent local playback, 5-band EQ, mic takes and WAV mixdown. */
(function(){
'use strict';
const D=document;
const state={recorder:null,stream:null,recStart:0,ticker:null,recording:false,rendering:false,objects:[],eqctx:null,filters:[],eqOn:false,preview:null};
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=s=>D.querySelector(s), track=id=>current.tracks.find(t=>t.id===id);
const time=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const supported=()=>Boolean(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder);
const presets={'Ровно':[0,0,0,0,0],'Рок':[4,2,-2,3,3],'Бас':[7,4,-2,-2,0],'Вокал':[-2,-1,3,4,1],'Мягко':[3,1,0,0,-3]};
function addButton(parent,id,label){const b=D.createElement('button');b.className='v4-button';b.id=id;b.textContent=label;parent.appendChild(b);return b}
function topControls(){
 const root=D.createElement('div');root.id='v4Quick';root.className='v4-quick';
 root.innerHTML='<div class="v4-head"><b>МОЯ ЗВУКОСТУДИЯ</b><span>Слушай и записывай без Suno</span></div><div class="v4-main-buttons"><button id="v4EQ" class="v4-main">≋ Эквалайзер</button><button id="v4Record" class="v4-main v4-main-hot">● Записать</button><button id="v4Library" class="v4-main">▣ Файлы</button></div><div id="v4NowRec" class="v4-rec-banner" hidden>● Идёт запись <span id="v4RecClock">0:00</span> <button id="v4QuickStop">■ Завершить</button></div>';
 const target=q('#quickbackup')?.parentElement||q('#albums');
 target.before(root);
 q('#v4EQ').onclick=showEQ;
 q('#v4Record').onclick=()=>chooseTrack();
 q('#v4Library').onclick=()=>q('#bulkfiles').click();
 q('#v4QuickStop').onclick=stopRecording;
}
function enableStudioButtons(){
 D.querySelectorAll('#tracks .track').forEach(card=>{
  const id=card.querySelector('[data-play]')?.dataset.play;
  if(!id||card.querySelector('.v4-song-action'))return;
  const row=D.createElement('div');row.className='v4-song-action';
  row.innerHTML='<button class="v4-small">● Запись / монтаж</button><span class="v4-take-count"></span>';
  const t=track(id);
  if(t){const n=(t.takes||[]).length;row.querySelector('.v4-take-count').textContent=n?n+' фрагм.':''}
  row.querySelector('button').onclick=()=>openFor(id);
  card.append(row);
 });
}
function init(){
 topControls();
 const prior=paint;paint=function(){prior();enableStudioButtons()};
 enableStudioButtons();
 D.addEventListener('pointerdown',()=>{if(state.eqctx?.state==='suspended')state.eqctx.resume().catch(()=>{})},{capture:true});
 if('mediaSession' in navigator){
  const old=audio.onplay;
  audio.onplay=e=>{if(old)old(e);try{navigator.mediaSession.playbackState='playing'}catch(x){}};
  audio.addEventListener('pause',()=>{try{navigator.mediaSession.playbackState='paused'}catch(x){}});
  if('setActionHandler' in navigator.mediaSession){
   try{navigator.mediaSession.setActionHandler('play',()=>audio.play());navigator.mediaSession.setActionHandler('pause',()=>audio.pause());navigator.mediaSession.setActionHandler('nexttrack',()=>nextPrev(1));navigator.mediaSession.setActionHandler('previoustrack',()=>nextPrev(-1))}catch(x){}
  }
  audio.addEventListener('loadedmetadata',()=>{
   try{const t=selected&&track(selected.id);if(t&&window.MediaMetadata)navigator.mediaSession.metadata=new MediaMetadata({title:t.name,artist:"רעש יפה",album:current.name})}catch(x){}
  });
 }
 D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='hidden'&&state.recording){try{state.recorder?.requestData()}catch(e){}}});
}
function ensureEQ(){
 if(state.eqctx)return state.eqctx;
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 if(!AudioCtx)throw Error('Web Audio недоступен в этом браузере');
 const ctx=new AudioCtx();const source=ctx.createMediaElementSource(audio);
 const frequencies=[80,250,1000,4000,10000],types=['lowshelf','peaking','peaking','peaking','highshelf'];
 let node=source;
 state.filters=frequencies.map((freq,i)=>{
  const f=ctx.createBiquadFilter();f.type=types[i];f.frequency.value=freq;
  if(f.type==='peaking')f.Q.value=1.0;
  node.connect(f);node=f;return f;
 });
 const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-6;limiter.ratio.value=4;node.connect(limiter);limiter.connect(ctx.destination);
 state.eqctx=ctx;return ctx;
}
function eqData(){
 const e=library.equalizer;
 if(!e||!Array.isArray(e.gains)||e.gains.length!==5)return {gains:[0,0,0,0,0],enabled:true,preset:'Ровно'};
 return {gains:e.gains.map(n=>Math.max(-12,Math.min(12,Number(n)||0))),enabled:e.enabled!==false,preset:e.preset||'Свой'};
}
function applyEQ(){
 const v=eqData();
 state.filters.forEach((f,i)=>{f.gain.setTargetAtTime(v.enabled?v.gains[i]:0,state.eqctx.currentTime,.025)});
}
function showEQ(){
 try{ensureEQ().resume().catch(()=>{});applyEQ()}catch(e){openSheet('Эквалайзер','<p>'+h(e.message)+'</p>');return}
 const p=eqData(),bars=['80 Гц · Низкие','250 Гц · Бас','1 кГц · Средние','4 кГц · Присутствие','10 кГц · Высокие'];
 openSheet('5-полосный эквалайзер','<p>Настраивает именно локальный плеер приложения. Параметры сохраняются в библиотеке и попадают в ZIP-копию.</p>'+
 '<label class="v4-switch"><input type="checkbox" id="v4EQEnable" '+(p.enabled?'checked':'')+'> Включить эквалайзер</label>'+
 '<div class="v4-presets">'+Object.keys(presets).map(x=>'<button data-eqpreset="'+h(x)+'" class="v4-preset">'+h(x)+'</button>').join('')+'</div>'+
 bars.map((b,i)=>'<div class="v4-eq-band"><label for="v4band'+i+'">'+b+'</label><input id="v4band'+i+'" type="range" min="-12" max="12" step="1" value="'+p.gains[i]+'"><strong id="v4gain'+i+'">'+p.gains[i]+' дБ</strong></div>').join('')+
 '<button class="cta" id="v4EQDone">Готово</button>');
 const sync=()=>{
  const v={enabled:q('#v4EQEnable').checked,gains:bars.map((_,i)=>Number(q('#v4band'+i).value)),preset:'Свой'};
  library.equalizer=v;save();applyEQ();
  bars.forEach((_,i)=>q('#v4gain'+i).textContent=v.gains[i]+' дБ');
 };
 q('#v4EQEnable').onchange=sync;
 bars.forEach((_,i)=>q('#v4band'+i).oninput=sync);
 D.querySelectorAll('[data-eqpreset]').forEach(b=>b.onclick=()=>{
  presets[b.dataset.eqpreset].forEach((n,i)=>q('#v4band'+i).value=n);
  sync();library.equalizer.preset=b.dataset.eqpreset;save();
 });
 q('#v4EQDone').onclick=closeSheet;
}
function chooseTrack(){
 if(!current.tracks.length){notify('Сначала добавь песню в альбом');return}
 if(current.tracks.length===1)return openFor(current.tracks[0].id);
 openSheet('Выбрать песню','<p>Для какой композиции записать вокал, гитару или новый фрагмент?</p>'+
 current.tracks.map(t=>'<button class="v4-choice" data-studio-song="'+h(t.id)+'">'+h(t.name)+' <span>● Студия</span></button>').join(''));
 D.querySelectorAll('[data-studio-song]').forEach(b=>b.onclick=()=>openFor(b.dataset.studioSong));
}
function openFor(id,version){
 const t=track(id);if(!t)return notify('Песня не найдена');
 const v=Number.isInteger(version)?version:0,existing=(t.takes||[]);
 openSheet('Студия · '+t.name,
 '<p class="v4-explain">Здесь играют <b>только свои локальные файлы</b>. Ссылка Suno остаётся в карточке как справочная, но кнопка «Играть» больше не отправляет тебя на сайт.</p>'+
 '<div class="v4-status"><b>Записи A/B</b><div>Версия A: '+(t.variants[0].fileKey?'готова':'нет файла')+' · Версия B: '+(t.variants[1].fileKey?'готова':'нет файла')+'</div></div>'+
 '<div class="v4-row"><button class="cta" id="v4Import">＋ Добавить MP3 / WAV</button><button class="ghost" id="v4GoEQ">≋ EQ</button></div>'+
 '<h3 class="v4-section">Новая запись</h3>'+
 '<label class="field" for="v4Mode">Как использовать следующий фрагмент</label>'+
 '<select class="fieldinput" id="v4Mode"><option value="append">Продолжение — после конца песни</option><option value="overlay">Наложение — вокал / инструмент поверх музыки</option></select>'+
 '<label class="field" for="v4Offset">Для наложения: с какой секунды начать</label><input id="v4Offset" class="fieldinput" type="number" min="0" step=".1" max="900" value="'+(Number.isFinite(audio.currentTime)?audio.currentTime.toFixed(1):'0')+'">'+
 '<div class="v4-row"><button class="v4-rec-start" id="v4MicStart">● Запись с микрофона</button><button class="ghost" id="v4MicStop" disabled>■ Стоп</button></div>'+
 '<div id="v4RecStatus" class="v4-status">Надень наушники при наложении. Safari может приостановить музыку при использовании микрофона. Запись не запускается при заблокированном экране.</div>'+
 '<h3 class="v4-section">Фрагменты ('+existing.length+')</h3>'+
 (existing.length?existing.map((take,i)=>'<div class="v4-take"><div><b>'+h(take.label||('Фрагмент '+(i+1)))+'</b><small>'+time(take.durationSec)+' · '+(take.mode==='overlay'?'Наложение с '+(take.offsetSec||0)+' с':'Продолжение')+'</small></div><button data-take-play="'+h(take.id)+'">▶</button><button data-take-delete="'+h(take.id)+'">×</button></div>').join(''):'<p class="v4-empty">Фрагментов нет. Записывай их по одному: куплет, припев, соло, рэп.</p>')+
 '<button class="cta" id="v4Mix">◉ Собрать готовую песню WAV</button>'+
 '<p>Для записи необходим доступ к микрофону. Результат остаётся на устройстве; в «Сохранить всё в ZIP» входят исходные фрагменты и готовые версии.</p>');
 q('#v4Import').onclick=()=>{selected={id,v};q('#mediafile').setAttribute('accept','audio/*,.mp3,.m4a,.wav,.aac,.flac');q('#mediafile').click()};
 q('#v4GoEQ').onclick=showEQ;
 q('#v4Mode').onchange=()=>q('#v4Offset').disabled=q('#v4Mode').value!=='overlay';
 q('#v4Mode').onchange();
 q('#v4MicStart').onclick=()=>startRecording(id);
 q('#v4MicStop').onclick=stopRecording;
 q('#v4Mix').onclick=()=>mixDialog(id);
 D.querySelectorAll('[data-take-play]').forEach(b=>b.onclick=()=>previewTake(id,b.dataset.takePlay));
 D.querySelectorAll('[data-take-delete]').forEach(b=>b.onclick=()=>deleteTake(id,b.dataset.takeDelete));
 q('#v4MicStart').disabled=state.recording;
 q('#v4MicStop').disabled=!state.recording;
}
function updateRecordingUI(msg){
 const banner=q('#v4NowRec');if(banner)banner.hidden=!state.recording;
 if(q('#v4RecStatus'))q('#v4RecStatus').textContent=msg||'';
 if(q('#v4MicStart'))q('#v4MicStart').disabled=state.recording;
 if(q('#v4MicStop'))q('#v4MicStop').disabled=!state.recording;
 if(q('#v4RecClock'))q('#v4RecClock').textContent=time((Date.now()-state.recStart)/1000);
}
async function startRecording(id){
 if(state.recording)return;
 if(!supported()){notify('Запись микрофона недоступна в этом браузере');return}
 const t=track(id);if(!t)return;
 const mode=q('#v4Mode')?.value||'append',offsetSec=Math.max(0,Math.min(900,Number(q('#v4Offset')?.value)||0)),albumId=current.id;
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}catch(e){notify('Нет доступа к микрофону. Разреши микрофон для Safari.');return}
 let mime='';
 for(const candidate of ['audio/mp4','audio/webm;codecs=opus','audio/webm']){
  if(MediaRecorder.isTypeSupported?.(candidate)){mime=candidate;break}
 }
 const chunks=[];
 let recorder;
 try{recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)}
 catch(e){stream.getTracks().forEach(x=>x.stop());notify('Формат записи не поддерживается');return}
 state.recorder=recorder;state.stream=stream;state.recording=true;state.recStart=Date.now();
 recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
 recorder.onerror=()=>notify('Ошибка записи с микрофона');
 recorder.onstop=async()=>{
  const seconds=Math.max(0.1,(Date.now()-state.recStart)/1000);
  stream.getTracks().forEach(x=>x.stop());
  clearInterval(state.ticker);state.ticker=null;
  state.recording=false;state.recorder=null;state.stream=null;
  updateRecordingUI('Запись завершена, сохраняю фрагмент...');
  const blob=new Blob(chunks,{type:recorder.mimeType||mime||chunks[0]?.type||'audio/mp4'});
  if(!blob.size){notify('Микрофон ничего не записал');return}
  const key='take:'+albumId+':'+id+':'+Date.now()+':'+Math.random().toString(36).slice(2,7);
  const songRef=library.albums.find(a=>a.id===albumId)?.tracks.find(x=>x.id===id);
  if(!songRef){notify('Песня больше не найдена');return}
  try{
   await put(key,new File([blob],'take-'+Date.now()+ (blob.type.includes('webm')?'.webm':'.m4a'),{type:blob.type}));
   songRef.takes=Array.isArray(songRef.takes)?songRef.takes:[];
   songRef.takes.push({id:'take-'+Date.now(),fileKey:key,mode,offsetSec,createdAt:new Date().toISOString(),durationSec:seconds,label:mode==='overlay'?'Наложение '+(songRef.takes.length+1):'Продолжение '+(songRef.takes.length+1)});
   const oldCurrent=current;if(oldCurrent.id!==albumId){library.current=albumId;current=library.albums.find(x=>x.id===albumId)}
   save();paint();openFor(id);notify('Фрагмент записан и сохранён');
  }catch(e){notify('Не удалось сохранить фрагмент. Проверь свободное место.')}
 };
 try{recorder.start(1000)}catch(e){state.recording=false;stream.getTracks().forEach(x=>x.stop());notify('Ошибка запуска записи');return}
 updateRecordingUI('● Идёт запись. Нажми «Стоп», чтобы сохранить отдельный фрагмент.');
 state.ticker=setInterval(()=>updateRecordingUI('● Идёт запись: '+time((Date.now()-state.recStart)/1000)+'. Останови запись, прежде чем выключать экран.'),1000);
}
function stopRecording(){
 if(!state.recording||!state.recorder)return;
 try{state.recorder.stop();updateRecordingUI('Завершаю запись...')}catch(e){notify('Не удалось остановить запись')}
}
async function previewTake(id,takeId){
 const t=track(id),take=t?.takes?.find(x=>x.id===takeId);if(!take)return;
 try{
  const blob=await get(take.fileKey);if(!blob)throw Error('Фрагмент не найден');
  if(state.preview){state.preview.audio.pause();URL.revokeObjectURL(state.preview.url)}
  const url=URL.createObjectURL(blob),p=new Audio(url);state.preview={audio:p,url};
  p.onended=()=>{URL.revokeObjectURL(url);if(state.preview?.url===url)state.preview=null};
  await p.play();
 }catch(e){notify('Не удалось проиграть фрагмент.')}
}
async function deleteTake(id,takeId){
 const t=track(id),take=t?.takes?.find(x=>x.id===takeId);if(!take)return;
 if(!confirm('Удалить этот фрагмент навсегда?'))return;
 t.takes=t.takes.filter(x=>x.id!==takeId);save();paint();
 try{await remove(take.fileKey)}catch(e){}
 openFor(id);notify('Фрагмент удалён');
}
function mixDialog(id){
 const t=track(id);if(!t)return;
 if(!(t.takes||[]).length){notify('Сначала запиши хотя бы один фрагмент');return}
 const a=t.variants[0].fileKey,b=t.variants[1].fileKey;
 const initial=a?0:b?1:-1;
 openSheet('Собрать · '+t.name,
 '<p>Соберу из исходной песни и записанных фрагментов новый полноценный WAV. «Продолжение» идёт после конца, «Наложение» начинается с выбранной секунды.</p>'+
 '<label class="field">Музыкальная основа</label><select class="fieldinput" id="v4Base">'+
 '<option value="-1">Без основы — только фрагменты</option>'+
 (a?'<option value="0" '+(initial===0?'selected':'')+'>Версия A — исходная запись</option>':'')+
 (b?'<option value="1" '+(initial===1?'selected':'')+'>Версия B — исходная запись</option>':'')+'</select>'+
 '<label class="field">Где сохранить готовую песню</label>'+
 '<select class="fieldinput" id="v4Target"><option value="0">Версия A</option><option value="1" '+(initial===0?'selected':'')+'>Версия B</option></select>'+
 '<button id="v4Render" class="cta">Собрать WAV и сохранить в программу</button>'+
 '<div class="v4-status" id="v4RenderStatus">Для длинных композиций может потребоваться много свободной памяти iPhone. Ограничение одного микса — до 8 минут.</div>');
 q('#v4Render').onclick=async()=>{
  if(state.rendering)return;
  const base=Number(q('#v4Base').value),target=Number(q('#v4Target').value);
  if(base===target&&base!==-1){notify('Выбери другую версию для готового микса');return}
  if(t.variants[target].fileKey&&!confirm('Перезаписать версию '+(target?'B':'A')+' готовым миксом? Сохрани ZIP-копию перед заменой.'))return;
  state.rendering=true;q('#v4Render').disabled=true;
  try{
   const progress=q('#v4RenderStatus');
   const result=await renderWAV(t,base,msg=>{if(progress)progress.textContent=msg});
   const key='audio:'+current.id+':'+id+':mix:'+Date.now();
   await put(key,new File([result],'Raash-Yafe-'+t.name.replace(/[^\p{L}\p{N}]+/gu,'-')+'.wav',{type:'audio/wav'}));
   t.variants[target].fileKey=key;t.variants[target].fileName='Готовый микс WAV';save();paint();
   const u=URL.createObjectURL(result);
   openSheet('Микс готов · '+t.name,'<p>Готовая песня сохранена в версии '+(target?'B':'A')+' на этом устройстве. Исходные фрагменты также остались в студии.</p>'+
    '<div class="v4-row"><button class="cta" id="v4HearMix">▶ Слушать</button><a class="v4-download" id="v4DownloadMix" download="Raash-Yafe-mix.wav">↓ Сохранить WAV</a></div><p>Нажми «Сохранить WAV», чтобы добавить копию в «Файлы» или iCloud Drive.</p>');
   q('#v4DownloadMix').href=u;
   q('#v4HearMix').onclick=()=>startPlay(t,target);
   setTimeout(()=>URL.revokeObjectURL(u),120000);
  }catch(e){openSheet('Микс не собран','<p>'+h(e.message||String(e))+'</p><p>Исходные записи и фрагменты не изменены. Попробуй меньшие отрезки или сделай монтаж на компьютере.</p>')}
  finally{state.rendering=false}
 };
}
async function decode(ctx,blob,label){
 if(!(blob instanceof Blob))throw Error(label+' не найден в памяти');
 try{return await ctx.decodeAudioData(await blob.arrayBuffer())}
 catch(e){throw Error('Не удалось декодировать '+label+'. Попробуй MP3, WAV или M4A.')}
}
async function renderWAV(t,baseIndex,progress){
 if(!window.OfflineAudioContext&&!window.webkitOfflineAudioContext)throw Error('Офлайн-сведение недоступно в Safari');
 const actx=new (window.AudioContext||window.webkitAudioContext)();
 const clips=[];
 try{
  let position=0;
  if(baseIndex>=0){
   progress('Читаю музыкальную основу...');
   const base=await decode(actx,await get(t.variants[baseIndex].fileKey),'основу');
   clips.push({buffer:base,at:0,level:.87});position=base.duration;
  }
  for(let i=0;i<(t.takes||[]).length;i++){
   const x=t.takes[i];if(x.muted)continue;
   progress('Читаю фрагмент '+(i+1)+'/'+t.takes.length);
   const buf=await decode(actx,await get(x.fileKey),'фрагмент '+(i+1));
   const at=x.mode==='overlay'?Math.max(0,Number(x.offsetSec)||0):position;
   clips.push({buffer:buf,at,level:x.mode==='overlay'?.72:.86});
   position=Math.max(position,at+buf.duration);
  }
  if(!clips.length)throw Error('Нет аудиоданных');
  if(position>480)throw Error('Продолжительность больше 8 минут. Сведи песню из более коротких частей.');
  const rate=32000,frames=Math.ceil((position+.1)*rate);
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const offline=new Offline(2,frames,rate);
  clips.forEach(x=>{
   const node=offline.createBufferSource();node.buffer=x.buffer;
   const gain=offline.createGain();gain.gain.value=x.level;
   node.connect(gain);gain.connect(offline.destination);
   node.start(x.at);
  });
  progress('Свожу все дорожки...');
  const mixed=await offline.startRendering();
  progress('Создаю WAV...');
  const wav=pcmToWav(mixed);
  return new Blob([wav],{type:'audio/wav'});
 }finally{actx.close().catch(()=>{})}
}
function pcmToWav(buffer){
 const n=buffer.length,c=2,bytes=44+n*c*2;
 if(bytes>125*1024*1024)throw Error('Слишком большой WAV. Используй меньшие фрагменты.');
 const out=new ArrayBuffer(bytes),v=new DataView(out),data=[buffer.getChannelData(0),buffer.getChannelData(1)];
 const str=(pos,s)=>{for(let i=0;i<s.length;i++)v.setUint8(pos+i,s.charCodeAt(i))};
 str(0,'RIFF');v.setUint32(4,bytes-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);
 v.setUint16(20,1,true);v.setUint16(22,c,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*4,true);
 v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,bytes-44,true);
 let p=44;for(let i=0;i<n;i++)for(let j=0;j<2;j++){
  const sample=Math.max(-1,Math.min(1,data[j][i]||0));
  v.setInt16(p,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);p+=2;
 }
 return out;
}
window.RaashStudioV4={openFor,showEQ,stopRecording};
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();