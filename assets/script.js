const banner=document.getElementById('liveBanner');
const audio=document.getElementById('radioAudio');
const play=document.getElementById('playButton');
const message=document.getElementById('playerMessage');
let source='azura',stream='',pending=false,azuraState='unknown',azuraTitle='',volume=1,muted=false,operation=0,lastVolume=1;
function selectSource(){if(!audio)return;source='azura';if(!pending&&audio.paused)message.textContent=azuraState==='live'?'Live from Offenbach':azuraState==='autodj'?'On air':'Currently offline';playbackUI();}
function setVolume(value){
 volume=value;muted=value===0;if(value>0)lastVolume=value;
 audio.volume=value;audio.muted=muted;
 document.getElementById('volume').value=String(value);
 const button=document.getElementById('muteButton');button.textContent=muted?'UNMUTE':'MUTE';button.setAttribute('aria-pressed',String(muted));

}
function renderStatus(){
 const state=azuraState;
 if(banner){banner.dataset.state=state;banner.hidden=state!=='live';}
 const title=document.getElementById('currentShowTitle');if(title)title.textContent=source==='azura'?azuraTitle:'';
}
function playbackUI(){if(!play)return;const playing=!audio.paused;play.textContent=pending?'LOADING':playing?'STOP':'PLAY';play.setAttribute('aria-pressed',String(playing));}
async function status(){
 try{const response=await fetch('/api/nowplaying.php',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const data=await response.json();azuraState=data.live?.is_live===true?'live':data.is_online===true?'autodj':'offline';stream=data.station?.listen_url||'';azuraTitle=data.live?.is_live?data.live.streamer_name||'Live from Offenbach':data.is_online?data.now_playing?.song?.text||'':'';}
 catch{azuraState='unknown';stream='';azuraTitle='';}
 selectSource();renderStatus();setTimeout(status,15000);
}
if(audio){
 play.addEventListener('click',async()=>{
 const attempt=++operation;if(!audio.paused||pending){pending=false;audio.pause();audio.removeAttribute('src');audio.load();playbackUI();return;}if(!stream){message.textContent='AzuraCast · No event stream connected';return;}pending=true;playbackUI();audio.src=stream;try{await audio.play();if(attempt===operation)message.textContent='AzuraCast · Listening';}catch{if(attempt===operation)message.textContent='Playback could not start. Press PLAY to retry.';}finally{if(attempt===operation){pending=false;playbackUI();}}
 });
 for(const event of ['playing','pause','ended'])audio.addEventListener(event,()=>{pending=false;playbackUI();});
 audio.addEventListener('error',()=>{pending=false;if(source==='azura')message.textContent='Stream interrupted. Press PLAY to reconnect.';playbackUI();});
 const chat=document.getElementById('radioChat');
 if(chat){
 document.getElementById('chatButton').addEventListener('click',()=>{
  const frame=chat.querySelector('iframe');if(!frame.getAttribute('src'))frame.src=frame.dataset.src;
  if(chat.open)chat.close();
  if(window.innerWidth<=700){chat.showModal();document.body.classList.add('chat-open');}else{chat.show();chat.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
 });
 document.getElementById('closeChat').addEventListener('click',()=>chat.close());
 chat.addEventListener('close',()=>{document.body.classList.remove('chat-open');document.getElementById('chatButton').focus({preventScroll:true});});
 }
 document.getElementById('volume').addEventListener('input',e=>setVolume(Number(e.target.value)));
 document.getElementById('muteButton').addEventListener('click',()=>setVolume(muted?lastVolume:0));

}
function clock(){const el=document.getElementById('clockText');if(el)el.textContent=new Date().toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin'});}clock();setInterval(clock,1000);status();
for(const a of document.querySelectorAll('nav a'))if(a.pathname===location.pathname)a.setAttribute('aria-current','page');
