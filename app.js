/* app.js - DozaMulti client-only prototype
   Places iframes for each space and keeps them in DOM to preserve session/state per space.
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

function createIframeForSpace(s){
  if(frames.has(s.id)) return frames.get(s.id);

  const iframe = document.createElement('iframe');
  iframe.className = 'frame';
  iframe.id = 'frame_' + s.id;

  // sandbox: isolate but allow logins/forms
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');

  // Always go through proxy
  iframe.src = PROXY_BASE + encodeURIComponent(s.url);

  iframe.style.display = 'none';
  framesContainer.appendChild(iframe);
  frames.set(s.id, iframe);

  iframe.addEventListener('load', () => {
    if (iframe.style.display !== 'none') {
      notice.style.display = 'none';
    }
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
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(displayTitle)}</div>
        <div class="small">${escapeHtml(s.url)}</div>
      </div>
      <div class="actions">
        <button data-id="${s.id}" class="openBtn">Open</button>
        <button data-id="${s.id}" class="delBtn">Delete</button>
      </div>
    `;
    el.querySelector('.openBtn').onclick = () => activateSpace(s.id);
    el.querySelector('.delBtn').onclick = () => {
      const ifr = frames.get(s.id);
      if (ifr) { ifr.remove(); frames.delete(s.id); }
      spaces = spaces.filter(x => x.id !== s.id);
      if (activeId === s.id) activeId = spaces.length ? spaces[0].id : null;
      save(); renderAll();
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
    const label = `${s.title}${s.number ? ' #' + s.number : ''}`;
    t.innerHTML = `<span>${escapeHtml(label)}</span>`;

    const close = document.createElement('span');
    close.className = 'close-icon';
    close.textContent = "×";
    close.onclick = (ev) => {
      ev.stopPropagation();
      const ifr = frames.get(s.id);
      if (ifr) { ifr.remove(); frames.delete(s.id); }
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
  if (!s) return;

  notice.style.display = 'none';
  let iframe = createIframeForSpace(s);

  frames.forEach((f, key) => {
    f.style.display = (key === id) ? 'block' : 'none';
  });
}

/* escape HTML */
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* Modal add handlers */
plusBtn.onclick = () => addModal.classList.remove('hidden');
closeModal.onclick = () => addModal.classList.add('hidden');

addFacebook.onclick = () => {
  addModal.classList.add('hidden');
  addNewSpace('https://m.facebook.com', 'Facebook');
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
    addNewSpace(parsed.href, parsed.hostname);
    urlInput.value = '';
    addModal.classList.add('hidden');
  } catch(e) {
    alert('Invalid URL');
  }
};

function addNewSpace(url, title){
  const baseTitle = baseTitleFromUrl(url);
  const sameCount = spaces.filter(s => s.baseTitle === baseTitle).length;
  const number = sameCount + 1;
  const s = { id: uid(), url, title: title || baseTitle, baseTitle, number };
  spaces.unshift(s);
  createIframeForSpace(s);
  activeId = s.id;
  save(); renderAll();
}

/* init */
renderAll();
