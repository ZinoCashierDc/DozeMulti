const addBtn = document.getElementById("addBtn");
const chooser = document.getElementById("chooser");
const closeChooser = document.getElementById("closeChooser");
const choices = document.querySelectorAll(".choice");
const customUrlInput = document.getElementById("customUrl");
const addCustom = document.getElementById("addCustom");
const spaceList = document.getElementById("spaceList");
const tabsEl = document.getElementById("tabs");
const frameWrap = document.getElementById("frameWrap");

let spaces = [];
let activeId = null;

function uid() {
  return "s_" + Math.random().toString(36).slice(2, 9);
}

// site templates
function getSite(type) {
  if (type === "facebook") {
    return { title: "Facebook", url: "https://www.facebook.com/?m2w" };
  }
  if (type === "lite") {
    return { title: "Facebook Lite", url: "https://mbasic.facebook.com/" };
  }
  return null;
}

function renderList() {
  spaceList.innerHTML = "";
  spaces.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "space-item";
    item.innerHTML = `<span>${i + 1}. ${s.title}</span>
                      <button onclick="removeSpace('${s.id}')">🗑</button>`;
    item.onclick = () => activate(s.id);
    spaceList.appendChild(item);
  });
}

function renderTabs() {
  tabsEl.innerHTML = "";
  spaces.forEach((s) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (s.id === activeId ? " active" : "");
    tab.textContent = s.title;
    tab.onclick = () => activate(s.id);
    tabsEl.appendChild(tab);
  });
}

function activate(id) {
  activeId = id;
  renderTabs();
  const s = spaces.find((x) => x.id === id);
  frameWrap.innerHTML = `<iframe class="frame" src="${s.url}" sandbox="allow-scripts allow-forms allow-same-origin allow-popups"></iframe>`;
}

function addSite(site) {
  const id = uid();
  spaces.push({ id, ...site });
  activate(id);
  renderList();
  renderTabs();
}

function removeSpace(id) {
  spaces = spaces.filter((s) => s.id !== id);
  if (activeId === id) activeId = null;
  renderList();
  renderTabs();
  if (spaces.length === 0) {
    frameWrap.innerHTML = `<div class="notice">No space selected. Press + to add Facebook, Lite, or custom.</div>`;
  }
}

// handle chooser
addBtn.onclick = () => chooser.classList.remove("hidden");
closeChooser.onclick = () => chooser.classList.add("hidden");

choices.forEach((btn) => {
  btn.onclick = () => {
    const type = btn.getAttribute("data-site");
    const site = getSite(type);
    if (site) addSite(site);
    chooser.classList.add("hidden");
  };
});

addCustom.onclick = () => {
  const url = customUrlInput.value.trim();
  if (url) {
    addSite({ title: url, url });
    customUrlInput.value = "";
    chooser.classList.add("hidden");
  }
};

// init
renderList();
renderTabs();
