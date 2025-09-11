/* app.js - DozaMulti client-only prototype
   Places iframes for each space and keeps them in DOM to preserve session/state per space.
   Optional PROXY_BASE: set to your serverless proxy base URL (e.g. "/api/proxy?url=" or "https://your-proxy.example/?u=").
*/
const PROXY_BASE = "/api/proxy?url=";
// If PROXY_BASE is empty it will load direct URLs.

const spaceListEl = document.getElementById('spaceList');
const tabsEl = document.getElementById('tabs');
const framesContainer = document.getElementById('framesContainer');
const frameWrap = document.getElementById('frameWrap');
const notice = document.getElementById('notice');

const plusBtn = document.getElementById('plusBtn');
const addModal = document.getElementById('addModal');
const closeModal = document.getElementById('closeModal');
const addFacebook = document.getElementById('addFacebook');
const addFacebookLite = document.getElementById('addFacebookLite');
const urlInput = document.getElementById('urlInput');
const addCustom = document.getElementById('addCustom');

const newBlankBtn = document.getElementById('newBlankBtn');
const openAllBtn = document.getElementById('openAllBtn');
const reloadFrameBtn = document.getElementById('reloadFrame');
const openFrameBtn = document.getElementById('openFrame');

let spaces = JSON.parse(localStorage.getItem('doza_spaces') || '[]');
let activeId = localStorage.getItem('doza_active') || null;

// Keep a map of iframe elements
const frames = new Map();

function save(){
  localStorage.setItem('doza_spaces', JSON.stringify(spaces));
  localStorage.setItem('doza_active', activeId || '');
}

function uid(){ return 's_' + Math.random().toString(36).slice(2,9); }

function baseTitleFromUrl(url){
  try {
    const u = new URL(url);
    return u.hostname.replace('www.','');
  } catch(e) {
    return url;
  }
}

// count same base type number to append #n
function countSameTitle(baseTitle){
  return spaces.filter(s => (s.baseTitle === baseTitle)).length;
}

function createIframeForSpace(s){
  if(frames.has(s.id)) return frames.get(s.id);

  const iframe = document.createElement('iframe');
  iframe.className = 'frame';
  iframe.id = 'frame_' + s.id;
  // sandbox attribute keeps iframe isolated but allow-same-origin may be required for some sites (may be blocked by site)
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  // Use proxy if set
  iframe.src = PROXY_BASE + encodeURIComponent(site.url);
  // Loading UI
  iframe.style.display = 'none';
  framesContainer.appendChild(iframe);
  frames.set(s.id, iframe);

  // show/hide notice on load
  iframe.addEventListener('load', () => {
    // If iframe loaded, hide notice
    if (iframe.style.display !== 'none') {
      notice.style.display = 'none';
    }
  });

  // If there is an error (rarely fires), show an inline notice for the frame
  iframe.addEventListener('error', () => {
    console.warn('iframe error for', s.url);
  });

  return iframe;
}

function renderList(){
  spaceListEl.innerHTML = '';
  spaces.forEach(s => {
    const el = document.createElement('div');
    el.className = 'space-item';
    const displayTitle = s.title + (s.number ? ` #${s.number}` : '');
    el.innerHTML = `
      <div class="space-thumb" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 8h18M3 12h18M3 16h18" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(displayTitle)}</div>
        <div class="small">${escapeHtml(s.url)}</div>
      </div>
      <div class="actions">
        <button data-id="${s.id}" class="btn ghost openBtn" title="Open this space">
          <svg class="icon" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
        </button>
        <button data-id="${s.id}" class="btn ghost delBtn" title="Delete">
          <svg class="icon" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4h4v2"/></svg>
        </button>
      </div>
    `;
    el.querySelector('.openBtn').onclick = () => activateSpace(s.id);
    el.querySelector('.delBtn').onclick = () => {
      // remove iframe element if present
      const ifr = frames.get(s.id);
      if (ifr) {
        try { ifr.remove(); } catch(e) {}
        frames.delete(s.id);
      }
      spaces = spaces.filter(x => x.id !== s.id);
      if (activeId === s.id) activeId = spaces.length ? spaces[0].id : null;
      save();
      renderAll();
    };
    el.onclick = (e) => {
      // Clicking the item (not the buttons) will open/activate
      if (e.target.closest('.openBtn') || e.target.closest('.delBtn')) return;
      activateSpace(s.id);
    };
    spaceListEl.appendChild(el);
  });
}

function buildTabs(){
  tabsEl.innerHTML = '';
  spaces.forEach(s => {
    const t = document.createElement('div');
    t.className = 'tab' + (s.id === activeId ? ' active' : '');
    const label = `${s.title}${s.number ? ' #' + s.number : ''}`;
    t.innerHTML = `<span>${escapeHtml(label)}</span>`;
    const numSpan = document.createElement('span');
    numSpan.className = 'num';
    numSpan.textContent = s.id.slice(-3);
    t.appendChild(numSpan);

    const close = document.createElement('span');
    close.className = 'close-icon';
    close.innerHTML = `<svg viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>`;
    close.onclick = (ev) => {
      ev.stopPropagation();
      // delete
      const ifr = frames.get(s.id);
      if (ifr) { try { ifr.remove(); } catch(e){} frames.delete(s.id); }
      spaces = spaces.filter(x => x.id !== s.id);
      if (activeId === s.id) activeId = spaces.length ? spaces[0].id : null;
      save(); renderAll();
    };

    t.onclick = () => activateSpace(s.id);
    t.appendChild(close);
    tabsEl.appendChild(t);
  });
}

function renderAll(){
  renderList();
  buildTabs();
  if (!activeId && spaces.length) activeId = spaces[0].id;
  if (activeId) showActiveFrame(activeId);
  if (!spaces.length) {
    frameWrap.querySelectorAll('iframe').forEach(f => f.style.display = 'none');
    framesContainer.innerHTML = '';
    notice.style.display = 'block';
    notice.textContent = 'No spaces — add one with the + button.';
  }
  save();
}

function activateSpace(id){
  activeId = id;
  renderAll();
}

function showActiveFrame(id){
  const s = spaces.find(x => x.id === id);
  if (!s) {
    notice.style.display = 'block';
    notice.textContent = 'Space not found.';
    return;
  }
  notice.style.display = 'none';

  // Ensure iframe exists
  let iframe = createIframeForSpace(s);

  // Hide all iframes then show the requested one
  frames.forEach((f, key) => {
    if (key === id) {
      f.style.display = 'block';
    } else {
      f.style.display = 'none';
    }
  });

  // If iframe hasn't started load, show a small loading notice
  // We'll set a timeout to show "embed blocked" if onload doesn't fire
  let loaded = false;
  const loadHandler = () => { loaded = true; notice.style.display = 'none'; iframe.removeEventListener('load', loadHandler); };
  iframe.addEventListener('load', loadHandler);
  notice.style.display = 'block';
  notice.textContent = 'Loading space...';
  // after 5s, if not loaded show a helpful message
  setTimeout(() => {
    if (!loaded) {
      notice.style.display = 'block';
      notice.textContent = 'Content may be blocked from embedding (X-Frame-Options/CSP). Try "Open" to open in a new tab.';
    }
  }, 4000);
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* Add handlers for modal & adding spaces */
plusBtn.onclick = () => addModal.classList.remove('hidden');
closeModal.onclick = () => addModal.classList.add('hidden');
addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.classList.add('hidden'); });

addFacebook.onclick = () => {
  addModal.classList.add('hidden');
  // Facebook "web"
  addNewSpace('https://www.facebook.com', 'Facebook');
};
addFacebookLite.onclick = () => {
  addModal.classList.add('hidden');
  // mbasic is a simpler mobile/basic interface that is less likely to deep-link to app
  addNewSpace('https://mbasic.facebook.com', 'Facebook Lite');
};

addCustom.onclick = () => {
  const raw = urlInput.value.trim();
  if (!raw) return alert('Enter a URL');
  let final = raw;
  if (!/^[a-zA-Z]+:\/\//.test(raw)) final = 'https://' + raw;
  try {
    const parsed = new URL(final);
    addNewSpace(parsed.href, parsed.hostname);
    urlInput.value = '';
    addModal.classList.add('hidden');
  } catch(e) {
    alert('Invalid URL');
  }
};

function addNewSpace(url, title){
  const baseTitle = baseTitleFromUrl(url);
  const sameCount = countSameTitle(baseTitle);
  const number = sameCount + 1;
  const s = { id: uid(), url: url, title: title || baseTitle, baseTitle, number };
  // insert to beginning
  spaces.unshift(s);
  // create iframe now but hidden
  createIframeForSpace(s);
  activeId = s.id;
  save();
  renderAll();
}

/* other buttons */
newBlankBtn.onclick = () => {
  const s = { id: uid(), url: 'about:blank', title: 'Blank', baseTitle: 'blank', number: 1 };
  spaces.unshift(s);
  createIframeForSpace(s);
  activeId = s.id;
  save(); renderAll();
};

openAllBtn.onclick = () => spaces.forEach(s => window.open(PROXY_BASE ? (PROXY_BASE + encodeURIComponent(s.url)) : s.url, '_blank'));

reloadFrameBtn.onclick = () => {
  const iframe = frames.get(activeId);
  if (iframe) {
    try {
      iframe.contentWindow.location.reload();
    } catch(e) {
      // cross-origin reload
      iframe.src = iframe.src;
    }
  }
};

openFrameBtn.onclick = () => {
  const s = spaces.find(x => x.id === activeId);
  if (s) window.open(PROXY_BASE ? (PROXY_BASE + encodeURIComponent(s.url)) : s.url, '_blank', 'noopener');
};

/* initial render */
renderAll();
