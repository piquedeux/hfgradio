const archiveStatus=document.getElementById('archiveStatus');
const posts=document.getElementById('archivePosts');
const known=new Map();let active=null;
function buildPost(sound){
 const post=document.createElement('article');post.className='post';
 const time=document.createElement('time');const date=new Date(sound.created_at);time.dateTime=date.toISOString();time.textContent=date.toLocaleDateString('de-DE');
 const title=document.createElement('h2');title.textContent=sound.title||'Untitled recording';
 const artist=document.createElement('span');artist.className='artist';artist.textContent=sound.artist||'';
 const button=document.createElement('button');button.type='button';button.textContent='PLAY';button.setAttribute('aria-label',`Play ${sound.title}`);button.setAttribute('aria-expanded','false');
 const panel=document.createElement('div');panel.className='archive-reveal';panel.id='track-'+sound.id.replace(/[^a-z0-9]/gi,'-');button.setAttribute('aria-controls',panel.id);
 const inner=document.createElement('div');panel.append(inner);
 const close=()=>{post.classList.remove('is-open');button.textContent='PLAY';button.setAttribute('aria-expanded','false');inner.replaceChildren();if(active===close)active=null;};
 button.addEventListener('click',()=>{if(active===close){close();return;}if(active)active();active=close;
 const iframe=document.createElement('iframe');iframe.title=`SoundCloud: ${sound.title}`;iframe.allow='autoplay';iframe.src='https://w.soundcloud.com/player/?'+new URLSearchParams({url:sound.permalink_url,auto_play:'true',visual:'true',show_artwork:'true',show_comments:'false',show_reposts:'false',hide_related:'true',color:'#000000'});inner.append(iframe);post.classList.add('is-open');button.textContent='CLOSE';button.setAttribute('aria-expanded','true');
 });
 post.append(time,title,button,artist,panel);
 if(sound.artwork_url){const img=document.createElement('img');img.className='archive-preview';img.src=sound.artwork_url;img.alt='';img.loading='lazy';post.append(img);}
 return post;
}
async function loadArchive(){try{const r=await fetch('/api/archive.php',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();archiveStatus.textContent=data.stale?'Showing saved recordings. SoundCloud is temporarily unavailable.':data.posts.length?'':'No public recordings yet.';const ids=new Set(data.posts.map(p=>p.id));for(const [id,node] of known){if(!ids.has(id)){node.remove();known.delete(id);}}for(const sound of data.posts){if(!known.has(sound.id)){const node=buildPost(sound);known.set(sound.id,node);posts.append(node);}}}catch{archiveStatus.textContent='SoundCloud could not load. Open our SoundCloud archive using the link above.';}}
loadArchive();setInterval(loadArchive,300000);
