const spaceListEl = document.getElementById("spaceList");
const tabsEl = document.getElementById("tabs");
const frameWrap = document.getElementById("frameWrap");
const notice = document.getElementById("notice");

const popup = document.getElementById("popup");
const addBtn = document.getElementById("addBtn");
const closePopup = document.getElementById("closePopup");
const customBtn = document.getElementById("customBtn");
const customUrl = document.getElementById("customUrl");

const reloadFrameBtn = document.getElementById("reloadFrame");
const openFrameBtn = document.getElementById("openFrame");

let spaces = JSON.parse(localStorage.getItem("doza_spaces") || "[]");
let activeId = null;
let counters = { facebook: 0, facebooklite: 0 };

function save() { localStorage.setItem("doza_spaces", JSON.stringify(spaces)); }
function uid(){ return 's_' + Math.random().toString(36).slice(2,9); }

function addSpace(type, url) {
  let title, finalUrl;

  if (type === "facebook") {
    counters.facebook++;
    title = `Facebook ${counters.facebook}`;
    finalUrl = "https://doze-multi.vercel.app/api/proxy?url=https://www.facebook.com/";
  } else if (type === "facebooklite") {
    counters.facebooklite++;
    title = `Facebook Lite ${counters.facebooklite}`;
    finalUrl = "https://doze-multi.vercel.app/api/proxy?url=https://mbasic.facebook.com/";
  } else {
    title = url;
    finalUrl = "https://doze-multi.vercel.app/api/proxy?url=" + encodeURIComponent(url);
  }

  const s = { id: uid(), url: finalUrl, title };
  spaces.push(s);
  activeId = s.id;
  save();
  render();
}

function buildList(){
  spaceListEl.innerHTML = "";
  spaces.forEach(s=>{
    const el = document.createElement("div");
    el.className = "space-item";
    el.innerHTML = `<span>${s.title}</span> <button data-id="${s.id}">❌</button>`;
    el.onclick = ()=> activateSpace(s.id);
    el.querySelector("button").onclick = (e)=> {
      e.stopPropagation();
      spaces = spaces.filter(x=>x.id!==s.id);
      if(activeId===s.id) activeId=null;
      save(); render();
    };
    spaceListEl.appendChild(el);
  });
}

function buildTabs(){
  tabsEl.innerHTML = "";
  spaces.forEach(s=>{
    const t = document.createElement("div");
    t.className = "tab " + (s.id===activeId ? "active" : "");
    t.textContent = s.title;
    t.onclick = ()=> activateSpace(s.id);
    tabsEl.appendChild(t);
  });
}

function activateSpace(id){
  activeId = id;
  const s = spaces.find(x=>x.id===id);
  frameWrap.innerHTML = "";
  if(!s){ frameWrap.innerHTML = `<div class="notice">No space selected</div>`; return; }
  const iframe = document.createElement("iframe");
  iframe.className = "frame";
  iframe.src = s.url;
  frameWrap.appendChild(iframe);
  save();
  render();
}

function render(){
  buildList();
  buildTabs();
  if(activeId) activateSpace(activeId);
  if(!spaces.length) frameWrap.innerHTML = `<div class="notice">No space selected — press + to add one.</div>`;
}

// controls
reloadFrameBtn.onclick = ()=>{
  const iframe = frameWrap.querySelector("iframe");
  if(iframe) iframe.contentWindow.location.reload();
};
openFrameBtn.onclick = ()=>{
  const s = spaces.find(x=>x.id===activeId);
  if(s) window.open(s.url, "_blank");
};

// popup
addBtn.onclick = ()=> popup.classList.remove("hidden");
closePopup.onclick = ()=> popup.classList.add("hidden");
document.querySelectorAll(".option").forEach(btn=>{
  btn.onclick = ()=> { addSpace(btn.dataset.type); popup.classList.add("hidden"); };
});
customBtn.onclick = ()=> {
  const url = customUrl.value.trim();
  if(url){ addSpace("custom", url); customUrl.value=""; popup.classList.add("hidden"); }
};

render();