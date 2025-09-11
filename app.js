// app.js (DozaMulti core)
// Put your proxy host here if you have one (no trailing slash).
// If you use a Vercel function at https://your-vercel.app/api/proxy,
// set PROXY_BASE = 'https://your-vercel.app'
const PROXY_BASE = ""; // <-- set your proxy domain here (or leave empty to load directly)

const spaceListEl = document.getElementById('spaceList');
const tabsEl = document.getElementById('tabs');
const frameWrap = document.getElementById('frameWrap');
const notice = document.getElementById('notice');
const urlInput = document.getElementById('urlInput');
const addBtn = document.getElementById('addBtn');
const newBlankBtn = document.getElementById('newBlankBtn');
const reloadFrameBtn = document.getElementById('reloadFrame');
const openFrameBtn = document.getElementById('openFrame');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const openAllBtn = document.getElementById('openAllBtn');

let spaces = JSON.parse(localStorage.getItem('doza_spaces') || '[]');
let activeId = null;

function save() { localStorage.setItem('doza_spaces', JSON.stringify(spaces)); }
function uid(){ return 's_' + Math.random().toString(36).slice(2,9); }

function buildList(){
  spaceListEl.innerHTML = '';
  spaces.forEach((s, idx) => {
    const el = document.createElement('div');
    el.className = 'space-item';
    el.innerHTML = `
      <div class="space-index">${idx+1}</div>
      <div class="space-thumb" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 8h18M3 12h18M3 16h18" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-weight:700">${s.title||s.url}</div>
        <div class="small">${s.url}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button data-id="${s.id}" class="btn ghost openBtn" title="Open this space">
          <svg class="icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/>
          </svg>
        </button>
        <button data-id="${s.id}" class="btn ghost delBtn" title="Delete">
          <!-- real trash icon -->
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    `;
    el.querySelector('.openBtn').onclick = ()=> activateSpace(s.id);
    el.querySelector('.delBtn').onclick = ()=> {
      if (!confirm('Delete this space?')) return;
      spaces = spaces.filter(x=>x.id!==s.id);
      if(activeId===s.id) activeId=null;
      save();
      render();
    };
    spaceListEl.appendChild(el);
  });
}

function buildTabs(){
  tabsEl.innerHTML = '';
  spaces.forEach(s=>{
    const t = document.createElement('div');
    t.className = 'tab ' + (s.id===activeId ? 'active' : '');
    t.textContent = s.title || s.url;
    t.onclick = ()=> activateSpace(s.id);
    tabsEl.appendChild(t);
  });
}

function activateSpace(id){
  activeId = id;
  render();
  const s = spaces.find(x=>x.id===id);
  if(!s) return;
  frameWrap.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.className = 'frame';
  // sandbox minimal so embedded pages can run scripts; adjust if needed
  iframe.sandbox = 'allow-scripts allow-forms allow-same-origin allow-popups';
  // if you have a server proxy, use it; otherwise use direct URL (may deep-link on mobile)
  const finalUrl = PROXY_BASE ? `${PROXY_BASE.replace(/\/$/,'')}/api/proxy?url=${encodeURIComponent(s.url)}` : s.url;
  iframe.src = finalUrl;
  iframe.onerror = ()=> {
    const n = document.createElement('div');
    n.className = 'notice';
    n.innerText = 'Error loading iframe. The site may block embedding (X-Frame-Options/CSP) or the proxy returned an error.';
    frameWrap.appendChild(n);
  };
  iframe.onload = ()=> {
    notice.style.display = 'none';
  };
  frameWrap.appendChild(iframe);
}

function render(){
  buildList();
  buildTabs();
  if(!activeId && spaces.length) activeId = spaces[0].id;
  if(activeId) activateSpace(activeId);
  if(!spaces.length){ frameWrap.innerHTML = '<div class="notice">No spaces — add one on the left.</div>'; }
}

addBtn.onclick = ()=>{
  const raw = urlInput.value.trim();
  if(!raw) return;
  try{
    const url = (raw.indexOf('://') === -1) ? 'https://' + raw : raw;
    const parsed = new URL(url);
    const s = { id: uid(), url: parsed.href, title: parsed.hostname + (parsed.pathname!=='/'? parsed.pathname : '') };
    spaces.unshift(s);
    urlInput.value = '';
    activeId = s.id;
    save();
    render();
  }catch(e){
    alert('Invalid URL');
  }
};

newBlankBtn.onclick = ()=>{
  const s = { id: uid(), url: 'about:blank', title: 'Blank' };
  spaces.unshift(s);
  activeId = s.id;
  save();
  render();
};

reloadFrameBtn.onclick = ()=>{
  const iframe = frameWrap.querySelector('iframe');
  if(iframe) iframe.contentWindow.location.reload();
};
openFrameBtn.onclick = ()=>{
  const s = spaces.find(x=>x.id===activeId);
  if(!s) return;
  const finalUrl = PROXY_BASE ? `${PROXY_BASE.replace(/\/$/,'')}/api/proxy?url=${encodeURIComponent(s.url)}` : s.url;
  window.open(finalUrl, '_blank');
};
exportBtn.onclick = ()=>{
  const data = JSON.stringify(spaces, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'doza_spaces.json';
  a.click();
  URL.revokeObjectURL(a.href);
};
importBtn.onclick = async ()=>{
  const input = document.createElement('input');
  input.type='file';
  input.accept='application/json';
  input.onchange = e=>{
    const f = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev=>{
      try{
        const imported = JSON.parse(ev.target.result);
        if(Array.isArray(imported)){
          spaces = imported.concat(spaces);
          save();
          render();
          alert('Imported');
        }else alert('Invalid file');
      }catch(err){ alert('Could not parse file'); }
    };
    if(f) reader.readAsText(f);
  };
  input.click();
};
openAllBtn.onclick = ()=> spaces.forEach(s => {
  const u = PROXY_BASE ? `${PROXY_BASE.replace(/\/$/,'')}/api/proxy?url=${encodeURIComponent(s.url)}` : s.url;
  window.open(u, '_blank');
});

render();