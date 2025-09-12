/* app.js - DozeMulti Control Panel
   This version creates iframes pointing to unique subdomains for true session isolation.
*/

// !!! IMPORTANT: Set this to your actual custom domain !!!
const MY_DOMAIN = "dozemulti.com";

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

let spaces = JSON.parse(localStorage.getItem('doza_spaces_v2') || '[]');
let activeId = localStorage.getItem('doza_active_v2') || null;

const frames = new Map();

function save() {
  localStorage.setItem('doza_spaces_v2', JSON.stringify(spaces));
  localStorage.setItem('doza_active_v2', activeId || '');
}

function uid() { return 's_' + Math.random().toString(36).slice(2, 9); }

// --- NEW: Generates the unique subdomain for a space ---
function getSpaceUrl(space) {
  if (space.url === 'about:blank') return 'about:blank';
  
  try {
    const urlObj = new URL(space.url);
    // Convert 'www.facebook.com' into 'www-facebook-com'
    const hostPart = urlObj.hostname.replace(/\./g, '-');
    const uniqueId = space.id.replace(/_/g, ''); // Use the space's ID for persistence
    
    return `https://${hostPart}-${uniqueId}.${MY_DOMAIN}`;
  } catch (e) {
    console.error("Invalid URL for space:", space);
    return 'about:blank';
  }
}

function createIframeForSpace(s) {
  if (frames.has(s.id)) return frames.get(s.id);

  const iframe = document.createElement('iframe');
  iframe.className = 'frame';
  iframe.id = 'frame_' + s.id;
  // Sandbox is still good practice!
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  iframe.style.display = 'none';

  // Set the source to the unique subdomain URL
  iframe.src = getSpaceUrl(s);

  framesContainer.appendChild(iframe);
  frames.set(s.id, iframe);
  return iframe;
}

function renderList(){
  spaceListEl.innerHTML = '';
  spaces.forEach(s => {
    const el = document.createElement('div');
    el.className = 'space-item';
    const displayTitle = s.title;
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
    const label = `${s.title}`;
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
  if (!s) return;

  notice.style.display = 'none';
  let iframe = createIframeForSpace(s);

  frames.forEach((f, key) => {
    f.style.display = (key === id) ? 'block' : 'none';
  });
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
  addNewSpace('https://www.facebook.com', 'Facebook');
};
addFacebookLite.onclick = () => {
  addModal.classList.add('hidden');
  addNewSpace('https://mbasic.facebook.com', 'Facebook Lite');
};

addCustom.onclick = () => {
  const raw = urlInput.value.trim();
  if (!raw) return alert('Enter a URL');
  let final = raw;
  if (!/^[a-zA-Z]+:\/\//.test(raw)) final = 'https://' + raw;
  try {
    const parsed = new URL(final);
    addNewSpace(parsed.href, parsed.hostname.replace('www.',''));
    urlInput.value = '';
    addModal.classList.add('hidden');
  } catch(e) {
    alert('Invalid URL');
  }
};

function addNewSpace(url, title){
  const s = { id: uid(), url: url, title: title };
  spaces.unshift(s);
  createIframeForSpace(s);
  activateSpace(s.id);
}


/* other buttons */
reloadFrameBtn.onclick = () => {
  const iframe = frames.get(activeId);
  if (iframe) {
      iframe.src = iframe.src; // Simple way to reload
  }
};

openFrameBtn.onclick = () => {
  const s = spaces.find(x => x.id === activeId);
  if (s) window.open(getSpaceUrl(s), '_blank', 'noopener');
};

/* initial render */
// Create all iframes on startup
spaces.forEach(s => createIframeForSpace(s));
renderAll();
