const addChoiceBtn = document.getElementById('addChoiceBtn');
const spaceListEl = document.getElementById('spaceList');
const tabsEl = document.getElementById('tabs');
const frameWrap = document.getElementById('frameWrap');
const notice = document.getElementById('notice');
const reloadFrameBtn = document.getElementById('reloadFrame');
const openFrameBtn = document.getElementById('openFrame');

let spaces = JSON.parse(localStorage.getItem('doza_spaces') || '[]');
let activeId = null;

function save() { localStorage.setItem('doza_spaces', JSON.stringify(spaces)); }
function uid(){ return 's_' + Math.random().toString(36).slice(2,9); }

const baseChoices = [
  {name:"Facebook", url:"https://www.facebook.com/"},
  {name:"Facebook Lite", url:"https://mbasic.facebook.com/"}
];

function countInstances(name) {
  return spaces.filter(s => s.title.startsWith(name)).length + 1;
}

function showChoicePopup(){
  const menu = document.createElement('div');
  menu.style.position = "fixed";
  menu.style.top = "50%";
  menu.style.left = "50%";
  menu.style.transform = "translate(-50%,-50%)";
  menu.style.background = "#0b1220";
  menu.style.padding = "20px";
  menu.style.borderRadius = "10px";
  menu.style.boxShadow = "0 4px 16px rgba(0,0,0,.4)";
  menu.innerHTML = "<div style='margin-bottom:10px;font-weight:700'>Choose a Space</div>";

  baseChoices.forEach(c=>{
    const btn = document.createElement('button');
    btn.className = "btn";
    btn.style.display = "block";
    btn.style.margin = "6px 0";
    btn.textContent = c.name;
    btn.onclick = ()=>{
      const num = countInstances(c.name);
      addSpace(`${c.name} ${num}`, c.url + "?instance=" + uid());
      document.body.removeChild(menu);
    };
    menu.appendChild(btn);
  });

  // custom URL input
  const input = document.createElement('input');
  input.type = "text";
  input.placeholder = "Enter website URL";
  input.style.marginTop = "10px";
  input.style.width = "100%";
  input.style.padding = "8px";
  menu.appendChild(input);

  const addCustom = document.createElement('button');
  addCustom.className = "btn";
  addCustom.style.marginTop = "6px";
  addCustom.textContent = "Add Website";
  addCustom.onclick = ()=>{
    if(!input.value) return;
    let url = input.value.trim();
    if(!url.startsWith("http")) url = "https://" + url;
    addSpace(url, url);
    document.body.removeChild(menu);
  };
  menu.appendChild(addCustom);

  const cancel = document.createElement('button');
  cancel.className = "btn ghost";
  cancel.style.marginTop = "10px";
  cancel.textContent = "Cancel";
  cancel.onclick = ()=> document.body.removeChild(menu);
  menu.appendChild(cancel);

  document.body.appendChild(menu);
}

function addSpace(title,url){
  const s = {id:uid(), url, title};
  spaces.push(s);
  activeId = s.id;
  save();
  render();
}

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
      <button data-id="${s.id}" class="btn ghost delBtn">Delete</button>
    `;
    el.querySelector('.delBtn').onclick = e=>{
      e.stopPropagation();
      spaces = spaces.filter(x=>x.id!==s.id);
      if(activeId===s.id) activeId=null;
      save(); render();
    };
    el.onclick = ()=> activateSpace(s.id);
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
  const s = spaces.find(x=>x.id===id);
  if(!s) return;
  frameWrap.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.className = 'frame';
  iframe.sandbox = 'allow-scripts allow-forms allow-same-origin allow-popups';
  iframe.src = s.url;
  iframe.onload = ()=> {
    notice.style.display = 'none';
  };
  iframe.onerror = ()=> {
    frameWrap.innerHTML = `<div class="notice">This site blocks embedding. Use "Open" button.</div>`;
  };
  frameWrap.appendChild(iframe);
}

function render(){
  buildList();
  buildTabs();
  if(activeId) activateSpace(activeId);
  else frameWrap.innerHTML = '<div class="notice">No space selected — press ➕ Add Space.</div>';
}

reloadFrameBtn.onclick = ()=>{
  const iframe = frameWrap.querySelector('iframe');
  if(iframe) iframe.contentWindow.location.reload();
};
openFrameBtn.onclick = ()=>{
  const s = spaces.find(x=>x.id===activeId);
  if(s) window.open(s.url, "_blank");
};

addChoiceBtn.onclick = showChoicePopup;

render();