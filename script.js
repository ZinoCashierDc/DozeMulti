const addBtn = document.getElementById("addBtn");
const spaceListEl = document.getElementById("spaceList");
const tabsEl = document.getElementById("tabs");
const frameWrap = document.getElementById("frameWrap");
const notice = document.getElementById("notice");
const modal = document.getElementById("chooseModal");
const closeModal = document.getElementById("closeModal");

let spaces = [];
let activeId = null;

// Unique ID
function uid() { return "s_" + Math.random().toString(36).slice(2, 9); }

// Save/load from localStorage
function save() { localStorage.setItem("doza_spaces", JSON.stringify(spaces)); }
function load() { spaces = JSON.parse(localStorage.getItem("doza_spaces") || "[]"); }

function render() {
  // Sidebar list
  spaceListEl.innerHTML = "";
  spaces.forEach(s => {
    const item = document.createElement("div");
    item.className = "space-item" + (s.id === activeId ? " active" : "");
    item.textContent = s.title;
    item.onclick = () => activateSpace(s.id);
    spaceListEl.appendChild(item);
  });

  // Tabs
  tabsEl.innerHTML = "";
  spaces.forEach(s => {
    const tab = document.createElement("div");
    tab.className = "tab" + (s.id === activeId ? " active" : "");
    tab.textContent = s.title;
    tab.onclick = () => activateSpace(s.id);
    tabsEl.appendChild(tab);
  });

  // Frame
  if (!activeId) {
    frameWrap.innerHTML = '<div class="notice">No space selected</div>';
    return;
  }
  const s = spaces.find(x => x.id === activeId);
  frameWrap.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.className = "frame";
  iframe.sandbox = "allow-scripts allow-forms allow-same-origin allow-popups";
  iframe.src = `/api/proxy?url=${encodeURIComponent(s.url)}`;
  frameWrap.appendChild(iframe);
}

function activateSpace(id) {
  activeId = id;
  render();
}

function addSpace(url, title) {
  // count duplicates
  let count = spaces.filter(s => s.base === title).length + 1;
  let finalTitle = count > 1 ? `${title} ${count}` : title;

  const s = { id: uid(), url, title: finalTitle, base: title };
  spaces.push(s);
  activeId = s.id;
  save();
  render();
}

// + button
addBtn.onclick = () => { modal.style.display = "flex"; };

closeModal.onclick = () => { modal.style.display = "none"; };

document.querySelectorAll(".choice").forEach(btn => {
  btn.onclick = () => {
    if (btn.dataset.custom) {
      const url = prompt("Enter URL:");
      if (url) addSpace(url, url);
    } else {
      addSpace(btn.dataset.url, btn.dataset.title);
    }
    modal.style.display = "none";
  };
});

load();
render();