# 🏆 League of Legends Arena Champion Win Tracker

This README much like the rest of this project is completely vibe coded. It serves the purpose that I intended but is not something I wanted to spend a great deal of time on. I likely will not update this for new champ releases. If there are weird word choices, this is why.

Link to site: [Arena Win Tracker](https://farhan1666.github.io/arena-wins/)

A lightweight, web-based tracker for logging champion wins in League of Legends (such as completing Arena / ARAM challenges). Built as a single-page app zero external backend dependencies—your progress is saved directly in your browser cookies.

---

## ⚡ Features

* **Zero Backend Required:** Fully client-side app hosted easily via GitHub Pages.
* **Cookie Persistence:** Automatically saves completed champions in your browser cookies (persists for 1 year).
* **League Client Style Grid:** Clean dark-mode UI displaying 7 columns of DataDragon champion portraits with checkmark overlays.
* **Right-Click Context Menu:** Fast controls to bypass popups or jump straight to champion build guides.
* **Real-time Filtering & Tabs:** Quickly filter between **Remaining**, **Completed**, and **All Champions**, with a live search bar.
* **Safety Confirmation & Undo:** Prevents accidental clicks with confirm dialogs and full action history undo support.

---

## 🚀 How to Use the Site

### 1. Tracking Wins
* **Standard Toggle:** Left-click on any champion's card to bring up the confirmation popup. Click **Yes** to mark them as completed or unmark them.
* **Quick Right-Click Menu:** Right-click any champion portrait to open a custom menu with two options:
  * **Set as Completed / Set as Remaining:** Instantly toggles the champion's completion status without needing a confirmation popup.
  * **Open METASRC Guide:** Opens the MetaSRC Arena build page for that champion in a new browser tab.

### 2. Tabs & Navigation
* **Remaining:** Displays only champions you haven't won with yet.
* **Completed:** Displays all champions marked as completed.
* **All Champions:** Shows the full roster with completed champions dimmed out.

### 3. Utility Tools
* **Search Bar:** Type any champion name to instantly filter the list.
* **Undo Last Action:** Reverts your most recent mark/unmark action.
* **Reset All Progress:** Clears all saved progress from your browser cookies (requires confirmation).

---

## ⚙️ Configuration

To update DataDragon patch versions or portrait endpoints in the future, open `index.html` and update the version constant at the top of the `<script>` tag:

```javascript
const VERSION = "16.16.1"; // Update to the latest DataDragon patch version