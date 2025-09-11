// Define proxy-wrapped sites
const sites = {
  facebook: "/api/proxy?url=https://www.facebook.com",       // Blue Facebook
  facebookLite: "/api/proxy?url=https://mbasic.facebook.com" // Lite version
};

const spaceListEl = document.getElementById("spaceList");
const tabsEl = document.getElementById("tabs");
const frameWrap = document.getElementById("frameWrap");
const notice = document.getElementById("notice");
const urlInput = document.getElementById("urlInput");
const addBtn = document.getElementById("addBtn");
const reloadFrameBtn = document.getElementById("reloadFrame");
const openFrameBtn = document.getElementById("openFrame");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");

let spaces = JSON.parse(localStorage.getItem("doza_spaces") || "[]");
let activeId = null;
let fbCounter = 0;
let liteCounter = 0;

function save() {
  localStorage.setItem("doza_spaces", JSON.stringify(spaces));
}
function uid() {
  return "s_" + Math.random().toString(36).slice(2, 9);
}

function buildList() {
  spaceListEl.innerHTML = "";
  spaces.forEach((s) => {
    const el = document.createElement("div");
    el.className = "space-item";
    el.innerHTML = `
      <div class="space-thumb">#</div>
      <div style="flex:1">
        <div style="font-weight:700">${s.title || s.url}</div>
        <div class="small">${s.url}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button data-id="${s.id}" class="btn ghost openBtn">Open</button>
        <button data-id="${s.id}" class="btn ghost delBtn">Delete</button>
      </div>
    `;
    el.querySelector(".openBtn").onclick = () => activateSpace(s.id);
    el.querySelector(".delBtn").onclick = () => {
      spaces = spaces.filter((x) => x.id !== s.id);
      if (activeId === s.id) activeId = null;
      render();
      save();
    };
    spaceListEl.appendChild(el);
  });
}

function buildTabs() {
  tabsEl.innerHTML = "";
  spaces.forEach((s) => {
    const t = document.createElement("div");
    t.className = "tab " + (s.id === activeId ? "active" : "");
    t.textContent = s.title || s.url;
    t.onclick = () => activateSpace(s.id);
    tabsEl.appendChild(t);
  });
}

function activateSpace(id) {
  activeId = id;
  render();
  const s = spaces.find((x) => x.id === id);
  if (!s) return;
  frameWrap.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.className = "frame";
  iframe.sandbox =
    "allow-scripts allow-forms allow-same-origin allow-popups";
  iframe.src = s.url;
  iframe.onload = () => {
    notice.style.display = "none";
  };
  frameWrap.appendChild(iframe);
}

function render() {
  buildList();
  buildTabs();
  if (!activeId && spaces.length) activeId = spaces[0].id;
  if (activeId) activateSpace(activeId);
  if (!spaces.length) {
    frameWrap.innerHTML =
      '<div class="notice">No spaces — add one on the left.</div>';
  }
}

// Add Facebook
document.getElementById("addFacebook").onclick = () => {
  fbCounter++;
  const s = {
    id: uid(),
    url: sites.facebook,
    title: `Facebook ${fbCounter}`,
  };
  spaces.unshift(s);
  activeId = s.id;
  save();
  render();
};

// Add Facebook Lite
document.getElementById("addFacebookLite").onclick = () => {
  liteCounter++;
  const s = {
    id: uid(),
    url: sites.facebookLite,
    title: `Facebook Lite ${liteCounter}`,
  };
  spaces.unshift(s);
  activeId = s.id;
  save();
  render();
};

// Add custom site
addBtn.onclick = () => {
  const raw = urlInput.value.trim();
  if (!raw) return;
  try {
    const url = raw.indexOf("://") === -1 ? "https://" + raw : raw;
    const parsed = new URL(url);
    const s = {
      id: uid(),
      url: `/api/proxy?url=${parsed.href}`,
      title:
        parsed.hostname +
        (parsed.pathname !== "/" ? parsed.pathname : ""),
    };
    spaces.unshift(s);
    urlInput.value = "";
    activeId = s.id;
    save();
    render();
  } catch (e) {
    alert("Invalid URL");
  }
};

reloadFrameBtn.onclick = () => {
  const iframe = frameWrap.querySelector("iframe");
  if (iframe) iframe.contentWindow.location.reload();
};
openFrameBtn.onclick = () => {
  const s = spaces.find((x) => x.id === activeId);
  if (s) window.open(s.url, "_blank");
};
exportBtn.onclick = () => {
  const data = JSON.stringify(spaces, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "doza_spaces.json";
  a.click();
  URL.revokeObjectURL(a.href);
};
importBtn.onclick = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (e) => {
    const f = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          spaces = imported.concat(spaces);
          save();
          render();
          alert("Imported");
        } else alert("Invalid file");
      } catch (err) {
        alert("Could not parse file");
      }
    };
    if (f) reader.readAsText(f);
  };
  input.click();
};

// initial render
render();