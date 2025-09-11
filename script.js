const proxyBase = "https://doze-multi.vercel.app/api/proxy?url=";

const spaceListEl = document.getElementById('spaceList');
const tabsEl = document.getElementById('tabs');
const frameWrap = document.getElementById('frameWrap');
const notice = document.getElementById('notice');
const urlInput = document.getElementById('urlInput');
const addBtn = document.getElementById('addBtn');
const addFacebookBtn = document.getElementById('addFacebook');
const addFacebookLiteBtn = document.getElementById('addFacebookLite');
const reloadFrameBtn = document.getElementById('reloadFrame');
const openFrameBtn = document.getElementById('openFrame');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');

let spaces = JSON.parse(localStorage.getItem('doza_spaces') || '[]');
let activeId = null;
let fbCount = 0;
let fbliteCount = 0;

function save() { localStorage.setItem('doza_spaces', JSON.stringify(spaces)); }
function uid(){ return 's_' + Math.random().toString(36).slice(2,9); }

function buildList(){
  spaceListEl.innerHTML = '';
  spaces.forEach(s=>{
    const el = document.createElement('div');
    el.className = 'space-item';
    el.innerHTML = `
      <div class="space-thumb">${s.title[0]}</div>
      <div style="flex:1">
        <div style="font-weight:700">${s.title}</div>
        <div class="small">${s.url}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button data-id="${s.id}" class="btn ghost openBtn">Open</button>
        <button data-id="${s.id}" class="btn ghost delBtn">Delete</button>
      </div>
    `;
    el.querySelector('.openBtn').onclick = ()=> activateSpace(s.id);
    el.querySelector('.delBtn').onclick = ()=> { 
      spaces = spaces.filter(x=>x.id!==s.id); 
      if(activeId===s.id) activeId=null; 
      render(); save(); 
    };
    spaceListEl.appendChild(el);
  });
}

function buildTabs(){
  tabsEl.innerHTML = '';
  spaces.forEach(s=>{
    const t = document.createElement('div');
    t.className = 'tab ' + (s.id===activeId ? 'active' : '');
    t.textContent = s.title;
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
  iframe.sandbox = 'allow-scripts allow-forms allow-same-origin allow-popups';
  iframe.src = proxyBase + encodeURIComponent(s.url);
  frameWrap.appendChild(iframe);
}

function render(){
  buildList();
  buildTabs();
  if(!activeId && spaces.length) activeId = spaces[0].id;
  if(activeId) activateSpace(activeId);
  if(!spaces.length){ 
    frameWrap.innerHTML = '<div class="notice">No spaces — add one.</div>'; 
  }
}

// Add normal site
addBtn.onclick = ()=>{
  const raw = urlInput.value.trim();
  if(!raw) return;
  try{
    const url = (raw.indexOf('://') === -1) ? 'https://' + raw : raw;
    const parsed = new URL(url);
    const s = { id: uid(), url: parsed.href, title: parsed.hostname };
    spaces.unshift(s);
    urlInput.value = '';
    activeId = s.id;
    save(); render();
  }catch(e){ alert('Invalid URL'); }
};

// Add Facebook
addFacebookBtn.onclick = ()=>{
  fbCount++;
  const s = { id: uid(), url: "https://www.facebook.com", title: "Facebook " + fbCount };
  spaces.unshift(s);
  activeId = s.id;
  save(); render();
};

// Add Facebook Lite
addFacebookLiteBtn.onclick = ()=>{
  fbliteCount++;
  const s = { id: uid(), url: "https://mbasic.facebook.com", title: "Facebook Lite " + fbliteCount };
  spaces.unshift(s);
  activeId = s.id;
  save(); render();
};

// Reload
reloadFrameBtn.onclick = ()=>{
  const iframe = frameWrap.querySelector('iframe');
  if(iframe) iframe.src = iframe.src;
};

// Open in new tab
openFrameBtn.onclick = ()=>{
  const s = spaces.find(x=>x.id===activeId);
  if(s) window.open(proxyBase + encodeURIComponent(s.url), '_blank');
};

// Export
exportBtn.onclick = ()=>{
  const data = JSON.stringify(spaces, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'doza_spaces.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

// Import
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
          save(); render(); alert('Imported');
        }else alert('Invalid file');
      }catch(err){ alert('Could not parse file'); }
    };
    if(f) reader.readAsText(f);
  };
  input.click();
};

// initial render
render();