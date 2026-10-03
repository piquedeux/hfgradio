(() => {
  const dialog = document.getElementById('siteSearch');
  const query = document.getElementById('searchQuery');
  const results = document.getElementById('searchResults');
  const status = document.getElementById('searchStatus');
  let recordings = [], loaded = false, failed = false, loading = false;
  const paths = {home:'/',archive:'/archive/',gallery:'/live-in-real-life/',links:'/links/',imprint:'/imprint/',colophon:'/colophon/'};
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  function render() {
    results.replaceChildren();
    const words = normalize(query.value).trim().split(/\s+/).filter(Boolean);
    if (!words.length) { status.textContent = copy('search.prompt'); return; }
    const entries = [];
    for (const page of document.querySelectorAll('[data-page]')) {
      const name = page.dataset.page;
      const title = name === 'home' ? copy('nav.radio') : page.querySelector('h1')?.textContent || name;
      const body = [...page.querySelectorAll('p, .prose-table')].map(el=>el.textContent).join(' ');
      entries.push({title, text:title+' '+body, href:paths[name]});
    }
    for (const track of recordings) entries.push({title:track.title, text:[track.title,track.artist,track.created_at].join(' '),href:'/archive/#recording-'+String(track.id).replace(/[^a-z0-9]/gi,'-')});
    for (const link of document.querySelectorAll('#linksEntries a')) entries.push({title:link.textContent,text:link.parentElement.textContent,href:link.href,external:true});
    for (const photo of document.querySelectorAll('#gallery figure')) {
      const title = photo.querySelector('h2')?.textContent || '';
      if (!photo.id) photo.id = 'photo-'+[...photo.parentElement.children].indexOf(photo);
      entries.push({title,text:photo.textContent,href:'/live-in-real-life/#'+photo.id});
    }
    const matches = entries.filter(entry=>words.every(word=>normalize(entry.text).includes(word)));
    status.textContent = matches.length ? copy('search.count','{count} results',{count:matches.length}) : !loaded && !failed ? copy('search.loading') : copy('search.empty');
    if (failed) status.textContent += ' '+copy('search.error');
    for (const entry of matches) {
      const item = document.createElement('li'), link = document.createElement('a');
      link.href = entry.href;link.textContent = entry.title;
      if (entry.external) {link.target='_blank';link.rel='noopener';}
      item.append(link);results.append(item);
    }
  }
  document.getElementById('openSearch').addEventListener('click', () => {
    dialog.showModal();query.focus();render();
    if (!loaded && !loading) {
      loading=true;failed=false;
      archive().then(posts=>{recordings=posts;loaded=true;}).catch(()=>{failed=true;}).finally(()=>{loading=false;render();});
    }
  });
  query.addEventListener('input',render);
  results.addEventListener('click',event=>{
    const link=event.target.closest('a');if(!link)return;
    dialog.close();
    if (!link.target && link.hash.startsWith('#photo-')) requestAnimationFrame(()=>document.getElementById(link.hash.slice(1))?.scrollIntoView({block:'start'}));
  });
})();
