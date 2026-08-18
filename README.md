# 🏆 League of Legends Arena Champion Win Tracker

Link to site: [Arena Win Tracker](https://farhan1666.github.io/arena-wins/)

A high-performance, Hextech-styled web tracker for logging champion 1st place wins in League of Legends **Arena mode** and conquering the **"Arena God" (60 Unique Champion Wins)** challenge. 

Built as a lightweight, zero-backend single-page app hosted directly on GitHub Pages.

---

## ⚡ Key Features

* **👑 Arena God Milestone (60 Wins)**: Dual progress trackers with visual tier badges (Iron ➔ Bronze ➔ Silver ➔ Gold ➔ Platinum ➔ Diamond ➔ Master ➔ Grandmaster ➔ Challenger ➔ **Arena God**) and total roster mastery.
* **🎲 "Roll Next Champion" (Arena Roulette)**: Spin the wheel to randomly pick your next champion from your remaining pool, optionally filtered by role/class (Hotkey: `R` or `Space`).
* **🛡️ Role & Class Filters**: Filter between **Fighter**, **Tank**, **Mage**, **Assassin**, **Marksman**, and **Support**.
* **⚡ Instant 1-Click Toggle & Undo Toast**: Fast 1-click toggling with floating undo toasts and full `Ctrl+Z` history undo support.
* **🔍 Smart Search & Aliases**: Instant search with support for champion nicknames and acronyms (e.g. `MF`, `GP`, `ASol`, `WW`, `TK`, `TF`, `Yi`, `Mundo`, `J4`, `LB`).
* **🔄 Auto-Updating DataDragon Integration**: Automatically checks Riot's official DataDragon API for the latest patch, champion releases, portraits, and tags, with seamless offline fallback.
* **💾 Modern Storage & Portability**: Saves locally with automatic migration from legacy cookies, URL-safe Base64 sharing, Discord formatted summaries, and JSON backup export/import.
* **📖 Multi-Site Arena Build Links**: Right-click or roulette shortcuts to jump directly to Arena build guides on MetaSRC, U.GG, and Lolalytics.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `R` or `Space` | Roll a random remaining champion (Arena Roulette) |
| `Ctrl + Z` | Undo last mark / unmark action |
| `/` or `Ctrl + K` | Focus the search bar |
| `Esc` | Close open modals, context menu, or clear search |

---

## 🚀 How to Use

### 1. Tracking Wins
* **1-Click Mode (Default):** Click any champion portrait to immediately mark them as completed or remaining. An undo toast appears for 4 seconds if clicked by mistake.
* **Custom Context Menu:** Right-click (or long-press on mobile) any champion portrait to quickly toggle their status, copy their name, or open their Arena build on MetaSRC, U.GG, or Lolalytics.

### 2. Sharing & Backups
* **Share URL:** Click **🔗 Share & Data** to generate a link with your progress encoded in a compact Base64 bitfield. Friends opening your link will see a view-only snapshot that won't overwrite their local data unless they choose to import.
* **Discord Summary:** Copy a pre-formatted markdown snippet showing your current win count, Arena God percentage, and current tier.
* **JSON Backup:** Export a `.json` backup file or restore previously saved data on any device.