// DozaMulti script.js

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

// ✅ Use your deployed Vercel proxy
const proxyBase = "https://doze-multi-qws6-9cja44shd-zinocashierdcs-projects.vercel.app/api/proxy?url=";

let spaces = JSON.parse(localStorage.getItem('doza_spaces') || '[]');
let activeId = null;

function save() { 
  localStorage.setItem('doza_spaces', JSON.stringify(spaces)); 
}

function uid(){ 
  return 's_' + Math.random().toString(36).slice(2,9); 
}

function buildList(){
  spaceListEl.innerHTML = '';
  spaces.forEach((s, i)=>{
    const el = document.createElement('div');
    el.className = 'space-item';
    el.innerHTML = `
      <div class="space-thumb" aria-hidden>
        <span>${i+1}</span>
      </div>
      <div style="flex:1">
        <div style="font-weight:700">${s.title||s.url}</div>
        <div class="small">${s.url}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button data-id="${s.id}" class="btn ghost openBtn" title="Open this space">
          <svg class="icon" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
        </button>
        <button data-id="${s.id}" class="btn ghost delBtn" title="Delete">
          <svg class="icon" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4h4v2"/></svg>
        </button>
      </div>
    `;
    el.querySelector('.openBtn').onclick = ()=> activateSpace(s.id);
    el.querySelector('.delBtn').onclick = ()=> { 
      spaces = spaces.filter(x=>x.id!==s.id); 
      if(activeId===s.id) activeId=null; 
      render(); 
      save(); 
    };
    spaceListEl.appendChild(el);
  });
}

function buildTabs(){
  tabsEl.innerHTML = '';
  spaces.forEach((s, i)=>{
    const t = document.createElement('div');
    t.className = 'tab ' + (s.id===activeId ? 'active' : '');
    t.textContent = (i+1) + ": " + (s.title || s.url);
    t.onclick = ()=> activateSpace(s.id);
    tabsEl.appendChild(t);
  });
}

function activateSpace(id){
  activeId = id;
  render();
  const s = spaces.find(x=>x.id===id);
  if(!s) return;

  // show iframe
  frameWrap.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.className = 'frame';
  iframe.sandbox = 'allow-scripts allow-forms allow-same-origin allow-popups';
  iframe.src = proxyBase + encodeURIComponent(s.url);

  iframe.onerror = ()=> {
    notice.innerText = 'Error loading iframe. The site may block embedding.';
    frameWrap.prepend(notice);
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
  if(!spaces.length){ 
    frameWrap.innerHTML = '<div class="notice">No spaces — add one on the left.</div>'; 
  }
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
  if(s) window.open(s.url, '_blank');
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

openAllBtn.onclick = ()=> spaces.forEach(s => window.open(s.url, '_blank'));

// ✅ Add quick options for Facebook + Facebook Lite
document.addEventListener("DOMContentLoaded", () => {
  if(spaces.length === 0){
    spaces.push(
      { id: uid(), url: "https://m.facebook.com", title: "Facebook" },
      { id: uid(), url: "https://mbasic.facebook.com", title: "Facebook Lite" }
    );
    save();
    render();
  } else {
    render();
  }
});