// ==========================================
// Arena Win Tracker - Core Application Logic
// ==========================================

let DATA_DRAGON_VERSION = DEFAULT_DATA_DRAGON_VERSION;

// --- State Variables ---
let champions = {};              // { [champName]: boolean }
let championRoster = [...CANONICAL_FALLBACK_ROSTER];
let historyStack = [];
let currentTab = "remaining";    // 'remaining' | 'completed' | 'all'
let currentRole = "all";         // 'all' | 'Fighter' | 'Tank' | 'Mage' | 'Assassin' | 'Marksman' | 'Support'
let searchQuery = "";
let isSharedMode = false;
let selectedContextMenuChamp = null;
let rouletteSelectedChamp = null;
let rouletteInterval = null;

let settings = {
  quickClick: true,
  autoPatch: true
};

// --- DataDragon Dynamic Loader ---
async function loadDataDragonRoster() {
  if (!settings.autoPatch) return;

  try {
    const verRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    if (!verRes.ok) return;
    const versions = await verRes.json();
    if (versions && versions.length > 0) {
      DATA_DRAGON_VERSION = versions[0];
      document.getElementById("patch-indicator").innerText = `Patch ${DATA_DRAGON_VERSION} • Arena God Challenge`;
    }

    const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DATA_DRAGON_VERSION}/data/en_US/champion.json`);
    if (!champRes.ok) return;
    const champData = await champRes.json();
    
    if (champData && champData.data) {
      const fetchedList = [];
      const seen = new Set();

      // Merge fetched champions
      Object.values(champData.data).forEach(c => {
        fetchedList.push({
          id: c.id,
          name: c.name,
          tags: c.tags || [],
          title: c.title || ""
        });
        seen.add(c.name);
      });

      // Keep any fallback roster entries not in dynamic fetch
      CANONICAL_FALLBACK_ROSTER.forEach(c => {
        if (!seen.has(c.name)) {
          fetchedList.push(c);
          seen.add(c.name);
        }
      });

      // Sort alphabetically
      fetchedList.sort((a, b) => a.name.localeCompare(b.name));
      championRoster = fetchedList;

      // Ensure state object has all keys
      championRoster.forEach(c => {
        if (champions[c.name] === undefined) {
          champions[c.name] = false;
        }
      });

      renderGrid();
      updateProgressBars();
    }
  } catch (err) {
    console.warn("Using offline fallback champion roster:", err);
  }
}

// --- Storage & Migration ---
function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      settings = { ...settings, ...JSON.parse(saved) };
    }
  } catch (e) {}
  document.getElementById("setting-quick-click").checked = settings.quickClick;
  document.getElementById("setting-auto-patch").checked = settings.autoPatch;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

function updateSetting(key, val) {
  settings[key] = val;
  saveSettings();
  if (key === "autoPatch" && val) {
    loadDataDragonRoster();
  }
}

function saveState() {
  if (isSharedMode) return;
  try {
    const wonList = championRoster.filter(c => champions[c.name]).map(c => c.name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wonList));
  } catch (e) {}
}

function loadState() {
  // Initialize map
  championRoster.forEach(c => champions[c.name] = false);

  // 1. Try modern localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) {
        list.forEach(name => {
          champions[name] = true;
        });
        return;
      }
    }
  } catch (e) {}

  // 2. Fallback: migrate from legacy cookie
  try {
    const cookieVal = getCookie(COOKIE_LEGACY_KEY);
    if (cookieVal) {
      const list = JSON.parse(cookieVal);
      if (Array.isArray(list)) {
        list.forEach(name => {
          champions[name] = true;
        });
        saveState(); // Migrate to localStorage
      }
    }
  } catch (e) {}
}

function getCookie(name) {
  const cname = name + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(cname) === 0) return c.substring(cname.length, c.length);
  }
  return "";
}

// --- URL Safe Base64 Bitfield Share Utility ---
function encodeProgressToBase64() {
  const numBytes = Math.ceil(CANONICAL_FALLBACK_ROSTER.length / 8);
  const byteArray = new Uint8Array(numBytes);

  CANONICAL_FALLBACK_ROSTER.forEach((champ, idx) => {
    if (champions[champ.name]) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      byteArray[byteIdx] |= (1 << bitIdx);
    }
  });

  let binary = '';
  byteArray.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeProgressFromBase64(base64Str) {
  try {
    let pad = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    while (pad.length % 4) pad += '=';
    const binary = atob(pad);
    const byteArray = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i);
    }

    const decoded = {};
    championRoster.forEach(c => decoded[c.name] = false);

    CANONICAL_FALLBACK_ROSTER.forEach((champ, idx) => {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      decoded[champ.name] = byteIdx < byteArray.length ? Boolean(byteArray[byteIdx] & (1 << bitIdx)) : false;
    });
    return decoded;
  } catch (e) {
    console.error("Failed to decode share code:", e);
    return null;
  }
}

// --- Image & Guide URLs ---
function getImgUrl(champObj) {
  return `https://ddragon.leagueoflegends.com/cdn/${DATA_DRAGON_VERSION}/img/champion/${champObj.id}.png`;
}

function getMetaSrcUrl(champName) {
  let slug = METASRC_SLUG_MAP[champName];
  if (!slug) {
    slug = champName.toLowerCase().replace(/['.]/g, "").replace(/\s+/g, "-");
  }
  return `https://www.metasrc.com/lol/arena/champions/${slug}/build`;
}

// --- Gamification & Tier Calculations ---
function getArenaTier(wonCount) {
  if (wonCount >= 168) return { label: "Grandmaster Arena", class: "tier-arenagod", icon: "✨" };
  if (wonCount >= 60) return { label: "Arena God", class: "tier-arenagod", icon: "👑" };
  if (wonCount >= 50) return { label: "Diamond Arena", class: "tier-diamond", icon: "💎" };
  if (wonCount >= 40) return { label: "Platinum Arena", class: "tier-platinum", icon: "🛡️" };
  if (wonCount >= 30) return { label: "Gold Arena", class: "tier-gold", icon: "🥇" };
  if (wonCount >= 20) return { label: "Silver Arena", class: "tier-silver", icon: "🥈" };
  if (wonCount >= 10) return { label: "Bronze Arena", class: "tier-bronze", icon: "🥉" };
  return { label: "Iron Arena", class: "tier-iron", icon: "⚔️" };
}

function updateProgressBars() {
  const wonCount = championRoster.filter(c => champions[c.name]).length;
  const totalCount = championRoster.length;
  const remCount = totalCount - wonCount;

  // Arena God 60 Wins
  const arenaGodCap = 60;
  const arenaGodPct = Math.min(100, Math.round((wonCount / arenaGodCap) * 100));
  document.getElementById("arena-god-val").innerText = wonCount;
  document.getElementById("arena-god-pct").innerText = `${arenaGodPct}%`;
  document.getElementById("arena-god-fill").style.width = `${Math.min(100, (wonCount / arenaGodCap) * 100)}%`;

  const tier = getArenaTier(wonCount);
  const tierBadge = document.getElementById("arena-tier-badge");
  tierBadge.className = `tier-badge ${tier.class}`;
  tierBadge.innerHTML = `${tier.icon} ${tier.label}`;

  // Total Roster
  const rosterPct = Math.round((wonCount / totalCount) * 100) || 0;
  document.getElementById("won-count-val").innerText = wonCount;
  document.getElementById("rem-count-val").innerText = remCount;
  document.getElementById("total-count-val").innerText = totalCount;
  document.getElementById("roster-fill").style.width = `${rosterPct}%`;

  // Tab count badges
  document.getElementById("tab-rem-cnt").innerText = remCount;
  document.getElementById("tab-comp-cnt").innerText = wonCount;
  document.getElementById("tab-all-cnt").innerText = totalCount;

  // Header controls state
  document.getElementById("undo-btn").disabled = historyStack.length === 0 || isSharedMode;
}

// --- Grid Rendering ---
function renderGrid() {
  const grid = document.getElementById("champ-grid");
  const search = searchQuery.trim().toLowerCase();

  // Check alias mapping (can be string or array of strings)
  const aliasTarget = SEARCH_ALIASES[search];
  let aliasList = null;
  if (aliasTarget) {
    aliasList = Array.isArray(aliasTarget) ? aliasTarget.map(s => s.toLowerCase()) : [aliasTarget.toLowerCase()];
  }

  let filtered = championRoster.filter(c => {
    // Tab filter
    const isWon = champions[c.name];
    if (currentTab === "remaining" && isWon) return false;
    if (currentTab === "completed" && !isWon) return false;

    // Role filter
    if (currentRole !== "all" && !c.tags.includes(currentRole)) return false;

    // Search filter (names, aliases, and easter eggs)
    if (search) {
      if (aliasList && aliasList.some(target => c.name.toLowerCase().includes(target))) {
        return true;
      }
      const cleanName = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanSearch = search.replace(/[^a-z0-9]/g, "");
      const matchName = c.name.toLowerCase().includes(search) || (cleanSearch && cleanName.includes(cleanSearch));
      if (!matchName) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No Champions Found</h3>
        <p>Try adjusting your search query, role filter, or status tab.</p>
      </div>
    `;
    return;
  }

  let html = "";
  filtered.forEach(c => {
    const isWon = champions[c.name];
    const primaryTag = c.tags && c.tags.length ? c.tags[0] : "";

    html += `
      <div class="champ-card ${isWon ? 'completed' : ''}" 
           data-champ="${c.name}"
           onclick="handleCardClick('${c.name}')" 
           oncontextmenu="openContextMenu(event, '${c.name}')">
        <div class="portrait-wrap">
          <img class="portrait-img" 
               src="${getImgUrl(c)}" 
               alt="${c.name}" 
               loading="lazy" 
               onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'70\\' height=\\'70\\'><rect width=\\'70\\' height=\\'70\\' fill=\\'%230e1a26\\'/></svg>';">
          <div class="win-overlay">
            <div class="win-badge">✓</div>
          </div>
        </div>
        <div class="champ-name" title="${c.name} - ${c.title || ''}">${c.name}</div>
        <div class="champ-role-tag">${primaryTag}</div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// --- Tab & Role Filters ---
function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderGrid();
}

function switchRole(role, btn) {
  currentRole = role;
  document.querySelectorAll(".role-pill").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderGrid();
}

function handleSearchInput() {
  const input = document.getElementById("search-input");
  searchQuery = input.value;
  document.getElementById("search-clear").style.display = searchQuery ? "block" : "none";
  renderGrid();
}

function clearSearch() {
  const input = document.getElementById("search-input");
  input.value = "";
  searchQuery = "";
  document.getElementById("search-clear").style.display = "none";
  renderGrid();
  input.focus();
}

// --- Card Click & Toggle Handlers ---
function handleCardClick(champName) {
  if (isSharedMode) {
    showToast("Exit shared view to edit status!", null);
    return;
  }

  if (settings.quickClick) {
    toggleChampionWon(champName);
  } else {
    const isWon = champions[champName];
    const action = isWon ? "unmark (set as Remaining)" : "mark as COMPLETED";
    openConfirmModal(`Are you sure you want to ${action} ${champName}?`, () => {
      toggleChampionWon(champName);
    });
  }
}

function toggleChampionWon(champName) {
  const prev = champions[champName];
  historyStack.push({ champ: champName, prev: prev });
  champions[champName] = !prev;

  saveState();
  updateProgressBars();
  renderGrid();

  const actionText = !prev ? "Marked as Won" : "Set as Remaining";
  showToast(`${champName} ${actionText}`, () => undoAction());
}

function undoAction() {
  if (historyStack.length === 0 || isSharedMode) return;
  const last = historyStack.pop();
  champions[last.champ] = last.prev;
  saveState();
  updateProgressBars();
  renderGrid();
  showToast(`Reverted ${last.champ}`, null);
}

// --- Toast Notifications ---
function showToast(message, undoCallback) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";

  let html = `<span>${message}</span>`;
  if (undoCallback) {
    html += `<button class="toast-undo-btn" id="toast-undo">Undo</button>`;
  }
  toast.innerHTML = html;

  if (undoCallback) {
    toast.querySelector("#toast-undo").onclick = () => {
      undoCallback();
      toast.remove();
    };
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Context Menu Handlers ---
function openContextMenu(e, champName) {
  e.preventDefault();
  selectedContextMenuChamp = champName;
  const menu = document.getElementById("context-menu");
  const isWon = champions[champName];

  document.getElementById("cm-champ-name").innerText = champName;
  document.getElementById("cm-toggle").innerText = isWon ? "↩️ Set as Remaining" : "✓ Mark as Completed";

  // Position correctly within viewport
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - 200);

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "block";
}

function hideContextMenu() {
  document.getElementById("context-menu").style.display = "none";
  selectedContextMenuChamp = null;
}

function handleContextMenuToggle() {
  if (selectedContextMenuChamp) {
    toggleChampionWon(selectedContextMenuChamp);
  }
  hideContextMenu();
}

function handleContextMenuOpenGuide() {
  if (selectedContextMenuChamp) {
    const url = getMetaSrcUrl(selectedContextMenuChamp);
    window.open(url, "_blank");
  }
  hideContextMenu();
}

function handleContextMenuCopyName() {
  if (selectedContextMenuChamp) {
    navigator.clipboard.writeText(selectedContextMenuChamp);
    showToast(`Copied "${selectedContextMenuChamp}" to clipboard`, null);
  }
  hideContextMenu();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("#context-menu")) {
    hideContextMenu();
  }
});

// --- Roulette / Random Champion Picker ---
function openRouletteModal() {
  document.getElementById("roulette-modal").style.display = "flex";
  spinRoulette();
}

function spinRoulette() {
  // Get pool of remaining champions (respecting role filter if selected)
  let pool = championRoster.filter(c => !champions[c.name]);
  if (currentRole !== "all") {
    const rolePool = pool.filter(c => c.tags.includes(currentRole));
    if (rolePool.length > 0) pool = rolePool;
  }

  if (pool.length === 0) {
    document.getElementById("roulette-name").innerText = "🎉 All Champions Won!";
    document.getElementById("roulette-subtitle").innerText = "You have conquered the Arena roster!";
    document.getElementById("roulette-mark-btn").style.display = "none";
    return;
  }

  document.getElementById("roulette-mark-btn").style.display = "inline-flex";

  let counter = 0;
  const totalTicks = 18;
  clearInterval(rouletteInterval);

  rouletteInterval = setInterval(() => {
    const randomIdx = Math.floor(Math.random() * pool.length);
    const champ = pool[randomIdx];
    rouletteSelectedChamp = champ;

    document.getElementById("roulette-img").src = getImgUrl(champ);
    document.getElementById("roulette-name").innerText = champ.name;
    document.getElementById("roulette-subtitle").innerText = champ.title || champ.tags.join(" • ");

    counter++;
    if (counter >= totalTicks) {
      clearInterval(rouletteInterval);
    }
  }, 70);
}

function handleRouletteMarkWon() {
  if (rouletteSelectedChamp) {
    toggleChampionWon(rouletteSelectedChamp.name);
    closeModal("roulette-modal");
  }
}

function handleRouletteOpenGuide() {
  if (rouletteSelectedChamp) {
    const url = getMetaSrcUrl(rouletteSelectedChamp.name);
    window.open(url, "_blank");
  }
}

// --- Modals & Share System ---
function openModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
  clearInterval(rouletteInterval);
}

let confirmCallback = null;
function openConfirmModal(message, callback) {
  document.getElementById("confirm-modal-text").innerText = message;
  confirmCallback = callback;
  document.getElementById("confirm-modal-ok-btn").onclick = () => {
    if (confirmCallback) confirmCallback();
    closeModal("confirm-modal");
  };
  openModal("confirm-modal");
}

function openSettingsModal() {
  openModal("settings-modal");
}

function openShareModal() {
  // 1. Generate share link
  const code = encodeProgressToBase64();
  const shareUrl = `${window.location.origin}${window.location.pathname}?share=${code}`;
  document.getElementById("share-link-input").value = shareUrl;

  // 2. Generate Discord summary
  const wonList = championRoster.filter(c => champions[c.name]).map(c => c.name);
  const wonCount = wonList.length;
  const totalCount = championRoster.length;
  const tier = getArenaTier(wonCount);

  const discordSummary = `🏆 **League Arena Win Progress**: ${wonCount} / 60 (${Math.min(100, Math.round(wonCount / 60 * 100))}%) [${tier.icon} ${tier.label}]\n🌟 **Total Roster**: ${wonCount} / ${totalCount} Champions Won\n🔗 **View Tracker**: ${shareUrl}`;
  document.getElementById("discord-summary-input").value = discordSummary;

  openModal("share-modal");
}

function switchDataTab(tabId, btn) {
  document.querySelectorAll(".data-tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  document.getElementById("data-sec-share-link").style.display = tabId === "share-link" ? "block" : "none";
  document.getElementById("data-sec-discord-summary").style.display = tabId === "discord-summary" ? "block" : "none";
  document.getElementById("data-sec-backup-restore").style.display = tabId === "backup-restore" ? "block" : "none";
  document.getElementById("data-sec-reset-data").style.display = tabId === "reset-data" ? "block" : "none";
}

function copyShareLink() {
  const input = document.getElementById("share-link-input");
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast("Share link copied to clipboard!", null);
  });
}

function copyDiscordSummary() {
  const input = document.getElementById("discord-summary-input");
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast("Discord summary copied to clipboard!", null);
  });
}

function exportJsonFile() {
  const wonList = championRoster.filter(c => champions[c.name]).map(c => c.name);
  const data = {
    app: "ArenaWinTracker",
    version: DATA_DRAGON_VERSION,
    timestamp: new Date().toISOString(),
    wonCount: wonList.length,
    wonChampions: wonList
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `arena-wins-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup file downloaded!", null);
}

function importJsonFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      applyImportedList(parsed.wonChampions || parsed);
    } catch (err) {
      showToast("Failed to parse JSON backup file.", null);
    }
  };
  reader.readAsText(file);
}

function importRawData() {
  const raw = document.getElementById("raw-json-input").value.trim();
  if (!raw) return;

  try {
    if (raw.startsWith("[") || raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      applyImportedList(parsed.wonChampions || parsed);
    } else {
      // Comma or newline separated
      const names = raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      applyImportedList(names);
    }
  } catch (err) {
    showToast("Invalid format. Please check your data.", null);
  }
}

function applyImportedList(list) {
  if (!Array.isArray(list)) {
    showToast("Import error: expected an array of champion names.", null);
    return;
  }

  historyStack = [];
  championRoster.forEach(c => champions[c.name] = false);

  let count = 0;
  list.forEach(item => {
    const name = typeof item === "string" ? item : item.name;
    if (champions[name] !== undefined) {
      champions[name] = true;
      count++;
    }
  });

  saveState();
  updateProgressBars();
  renderGrid();
  closeModal("share-modal");
  showToast(`Imported ${count} champions!`, null);
}

function promptReset() {
  openConfirmModal("Are you sure you want to RESET all progress? This will clear all completed champions.", () => {
    championRoster.forEach(c => champions[c.name] = false);
    historyStack = [];
    saveState();
    updateProgressBars();
    renderGrid();
    closeModal("share-modal");
    showToast("All progress reset.", null);
  });
}

// --- Shared Mode Handler ---
function importSharedProgress() {
  isSharedMode = false;
  saveState();
  document.getElementById("shared-banner").style.display = "none";
  window.history.replaceState({}, document.title, window.location.pathname);
  showToast("Progress imported to your tracker!", null);
  updateProgressBars();
  renderGrid();
}

function exitSharedMode() {
  isSharedMode = false;
  document.getElementById("shared-banner").style.display = "none";
  window.history.replaceState({}, document.title, window.location.pathname);
  loadState();
  updateProgressBars();
  renderGrid();
}

// --- Global Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  // Don't trigger hotkeys if typing in input/textarea
  const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

  if (e.key === "Escape") {
    document.querySelectorAll(".modal-backdrop").forEach(m => m.style.display = "none");
    hideContextMenu();
    if (isInput) document.activeElement.blur();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undoAction();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("search-input").focus();
    return;
  }

  if (e.key === "/" && !isInput) {
    e.preventDefault();
    document.getElementById("search-input").focus();
    return;
  }

  if ((e.key === " " || e.key.toLowerCase() === "r") && !isInput) {
    e.preventDefault();
    const rouletteModal = document.getElementById("roulette-modal");
    if (rouletteModal.style.display === "flex") {
      spinRoulette();
    } else {
      openRouletteModal();
    }
  }
});

// --- Initialization ---
async function init() {
  loadSettings();

  const urlParams = new URLSearchParams(window.location.search);
  const shareCode = urlParams.get("share");

  if (shareCode) {
    const decoded = decodeProgressFromBase64(shareCode);
    if (decoded) {
      champions = decoded;
      isSharedMode = true;
      document.getElementById("shared-banner").style.display = "flex";
    } else {
      loadState();
    }
  } else {
    loadState();
  }

  renderGrid();
  updateProgressBars();

  // Dynamically fetch newest live patch & champions in background
  await loadDataDragonRoster();
}

init();
