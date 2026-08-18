import os
import math
import re
import urllib.request
import threading
import queue
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_FILE = os.path.join(SCRIPT_DIR, "readme.md")
CACHE_DIR = os.path.join(SCRIPT_DIR, ".champ_cache")
VERSION = "16.16.1"

SPECIAL_MAP = {
    "Wukong": "MonkeyKing",
    "Nunu & Willump": "Nunu",
    "Renata Glasc": "Renata",
    "Dr. Mundo": "DrMundo",
    "Jarvan IV": "JarvanIV",
    "Master Yi": "MasterYi",
    "Miss Fortune": "MissFortune",
    "Tahm Kench": "TahmKench",
    "Twisted Fate": "TwistedFate",
    "Xin Zhao": "XinZhao",
    "K'Sante": "KSante",
    "Cho'Gath": "Chogath",
    "Kai'Sa": "Kaisa",
    "Kha'Zix": "Khazix",
    "LeBlanc": "Leblanc",
    "Vel'Koz": "Velkoz",
    "Bel'Veth": "Belveth"
}

def get_ddragon_id(name):
    if name in SPECIAL_MAP:
        return SPECIAL_MAP[name]
    return re.sub(r"[ '.-]", "", name)

def get_img_tag(name):
    cid = get_ddragon_id(name)
    url = f"https://ddragon.leagueoflegends.com/cdn/{VERSION}/img/champion/{cid}.png"
    return f'<img src="{url}" width="20" height="20" align="absmiddle"> '

class ChampionTrackerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("League Champion Win Tracker")
        self.root.geometry("1100x700")
        self.root.minsize(950, 500)
        self.root.configure(bg="#0a141e")

        os.makedirs(CACHE_DIR, exist_ok=True)

        self.champions = {}
        self.history = []
        self.image_cache = {}
        
        # Background download queue
        self.download_queue = queue.Queue()
        self.download_set = set()

        # Placeholders
        self.placeholder_img = self.create_placeholder(is_won=False)
        self.placeholder_won_img = self.create_placeholder(is_won=True)

        # Map champion name -> list of button widgets currently displaying it
        self.active_buttons = {}

        # Style Config
        style = ttk.Style()
        style.theme_use("default")
        style.configure("TNotebook", background="#0a141e", borderwidth=0)
        style.configure("TNotebook.Tab", background="#1e2328", foreground="#cdbe91", padding=[15, 6], font=("Segoe UI", 10, "bold"))
        style.map("TNotebook.Tab", background=[("selected", "#010a13")], foreground=[("selected", "#f0e6d2")])
        style.configure("TFrame", background="#010a13")

        # UI Header & Stats
        header_frame = tk.Frame(root, bg="#010a13", padx=15, pady=10)
        header_frame.pack(fill=tk.X)

        self.stats_label = tk.Label(header_frame, text="Loading...", font=("Segoe UI", 12, "bold"), fg="#f0e6d2", bg="#010a13")
        self.stats_label.pack(side=tk.LEFT)

        self.undo_button = tk.Button(
            header_frame, text="Undo Last Action", command=self.undo_last_action, 
            state=tk.DISABLED, bg="#1e2328", fg="#cdbe91", font=("Segoe UI", 9, "bold"),
            activebackground="#c8aa6e", activeforeground="#010a13", relief="flat"
        )
        self.undo_button.pack(side=tk.RIGHT)

        # Search Bar
        search_frame = tk.Frame(root, bg="#010a13", padx=15, pady=10)
        search_frame.pack(fill=tk.X)

        tk.Label(search_frame, text="Search:", font=("Segoe UI", 10, "bold"), fg="#a09b8c", bg="#010a13").pack(side=tk.LEFT, padx=(0, 8))
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *args: self.refresh_buttons())
        search_entry = tk.Entry(search_frame, textvariable=self.search_var, font=("Segoe UI", 10), bg="#09141d", fg="#f0e6d2", insertbackground="#f0e6d2", relief="solid", bd=1)
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Notebook (Tabs)
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        self.rem_tab = ttk.Frame(self.notebook)
        self.completed_tab = ttk.Frame(self.notebook)
        self.all_tab = ttk.Frame(self.notebook)

        self.notebook.add(self.rem_tab, text="Remaining")
        self.notebook.add(self.completed_tab, text="Completed")
        self.notebook.add(self.all_tab, text="All Champions")

        self.load_data()
        self.refresh_ui()

        # Start single background worker for downloading images sequentially
        threading.Thread(target=self.image_loader_worker, daemon=True).start()

    def create_placeholder(self, is_won):
        base_img = Image.new("RGBA", (70, 70), (15, 25, 35, 255))
        if is_won:
            dim = Image.new("RGBA", (70, 70), (0, 0, 0, 110))
            base_img = Image.alpha_composite(base_img, dim)
            badge = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
            draw = ImageDraw.Draw(badge)
            draw.ellipse([0, 0, 19, 19], fill="#00c8c8")
            draw.line([(5, 10), (8, 14), (14, 5)], fill="#010a13", width=2)
            base_img.paste(badge, (48, 2), badge)
        return ImageTk.PhotoImage(base_img)

    def image_loader_worker(self):
        """Worker thread that processes image downloads sequentially in the background."""
        while True:
            try:
                name = self.download_queue.get()
                cid = get_ddragon_id(name)
                local_file = os.path.join(CACHE_DIR, f"{cid}.png")

                if not os.path.exists(local_file):
                    url = f"https://ddragon.leagueoflegends.com/cdn/{VERSION}/img/champion/{cid}.png"
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    try:
                        with urllib.request.urlopen(req, timeout=2) as resp, open(local_file, 'wb') as out:
                            out.write(resp.read())
                    except Exception:
                        # Create empty marker file on 404/error so it doesn't re-try downloading
                        with open(local_file, 'wb') as out:
                            pass

                # Notify main UI thread to update image on screen
                self.root.after(0, lambda n=name: self.update_champion_button_image(n))
            except Exception:
                pass
            finally:
                self.download_queue.task_done()

    def update_champion_button_image(self, champ_name):
        """Updates image for buttons currently displayed."""
        if champ_name in self.active_buttons:
            is_won = self.champions.get(champ_name, False)
            img = self.get_champion_portrait(champ_name, is_won)
            for btn in self.active_buttons[champ_name]:
                try:
                    btn.config(image=img)
                except tk.TclError:
                    pass

    def get_champion_portrait(self, name, is_won):
        key = (name, is_won)
        if key in self.image_cache:
            return self.image_cache[key]

        cid = get_ddragon_id(name)
        local_file = os.path.join(CACHE_DIR, f"{cid}.png")

        if not os.path.exists(local_file):
            if name not in self.download_set:
                self.download_set.add(name)
                self.download_queue.put(name)
            return self.placeholder_won_img if is_won else self.placeholder_img

        try:
            # If 0 bytes (failed download/custom champ), return placeholder
            if os.path.getsize(local_file) == 0:
                return self.placeholder_won_img if is_won else self.placeholder_img

            base_img = Image.open(local_file).convert("RGBA").resize((70, 70), Image.Resampling.LANCZOS)
            
            if is_won:
                dim = Image.new("RGBA", (70, 70), (0, 0, 0, 110))
                base_img = Image.alpha_composite(base_img, dim)
                badge = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
                draw = ImageDraw.Draw(badge)
                draw.ellipse([0, 0, 19, 19], fill="#00c8c8")
                draw.line([(5, 10), (8, 14), (14, 5)], fill="#010a13", width=2)
                base_img.paste(badge, (48, 2), badge)

            photo = ImageTk.PhotoImage(base_img)
            self.image_cache[key] = photo
            return photo
        except Exception:
            return self.placeholder_won_img if is_won else self.placeholder_img

    def parse_champions(self, content):
        cells = re.findall(r"\|([^|\n]+)", content)
        champions = {}
        for cell in cells:
            cell_str = cell.strip()
            if not cell_str or cell_str.startswith(":---") or "Champions (" in cell_str:
                continue
            
            cell_clean = re.sub(r'<img[^>]*>', '', cell_str).strip()
            
            if "*~~" in cell_clean:
                name = cell_clean.replace("*~~", "").replace("~~*", "").strip()
                if name:
                    champions[name] = True
            elif "<b><u>" in cell_clean:
                name = cell_clean.replace("<b><u>", "").replace("</u></b>", "").strip()
                if name:
                    champions[name] = False
        return champions

    def load_data(self):
        if not os.path.exists(MD_FILE):
            messagebox.showerror("Error", f"Could not find file at:\n{MD_FILE}")
            self.root.destroy()
            return

        with open(MD_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        self.champions = self.parse_champions(content)

    def save_markdown(self):
        remaining = sorted([c for c, won in self.champions.items() if not won], key=lambda x: x.lower())
        completed = sorted([c for c, won in self.champions.items() if won], key=lambda x: x.lower())
        all_champs = sorted(list(self.champions.keys()), key=lambda x: x.lower())

        def build_table(title, items, format_fn):
            num_cols = 7
            rows_count = math.ceil(len(items) / num_cols)
            md = f"| **{title} ({len(items)})** | | | | | | |\n"
            md += "| " + " | ".join([":---" for _ in range(num_cols)]) + " |\n"
            for r in range(rows_count):
                row_cells = []
                for c in range(num_cols):
                    idx = r * num_cols + c
                    if idx < len(items):
                        cname = items[idx]
                        img = get_img_tag(cname)
                        fmt = format_fn(cname)
                        row_cells.append(f"{img}{fmt}")
                    else:
                        row_cells.append("")
                md += "| " + " | ".join(row_cells) + " |\n"
            return md

        rem_md = build_table("Remaining Champions", remaining, lambda x: f"<b><u>{x}</u></b>")
        won_md = build_table("Completed Champions", completed, lambda x: f"*~~{x}~~*")
        all_md = build_table("All Champions", all_champs, lambda x: f"*~~{x}~~*" if self.champions[x] else f"<b><u>{x}</u></b>")

        new_content = f"{rem_md}\n\n{won_md}\n\n{all_md}"

        with open(MD_FILE, "w", encoding="utf-8") as f:
            f.write(new_content)

    def refresh_ui(self):
        won_count = sum(1 for won in self.champions.values() if won)
        rem_count = len(self.champions) - won_count
        self.stats_label.config(text=f"Won: {won_count}  |  Remaining: {rem_count}  |  Total: {len(self.champions)}")

        self.undo_button.config(state=tk.NORMAL if self.history else tk.DISABLED)
        self.refresh_buttons()

    def bind_scroll_events(self, widget, canvas):
        def _on_mousewheel(event):
            if event.delta:
                canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
            elif event.num == 4:
                canvas.yview_scroll(-1, "units")
            elif event.num == 5:
                canvas.yview_scroll(1, "units")

        widget.bind("<MouseWheel>", _on_mousewheel)
        widget.bind("<Button-4>", _on_mousewheel)
        widget.bind("<Button-5>", _on_mousewheel)

        for child in widget.winfo_children():
            self.bind_scroll_events(child, canvas)

    def create_scrollable_grid(self, parent_tab, champ_list):
        for widget in parent_tab.winfo_children():
            widget.destroy()

        canvas = tk.Canvas(parent_tab, bg="#010a13", highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent_tab, orient="vertical", command=canvas.yview)
        scroll_frame = tk.Frame(canvas, bg="#010a13")

        scroll_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        cols = 7
        filter_str = self.search_var.get().strip().lower()
        filtered_champs = [c for c in champ_list if filter_str in c.lower()]

        if not filtered_champs:
            tk.Label(scroll_frame, text="No champions found.", font=("Segoe UI", 10, "italic"), fg="#a09b8c", bg="#010a13").grid(row=0, column=0, padx=20, pady=20)
            self.bind_scroll_events(scroll_frame, canvas)
            self.bind_scroll_events(canvas, canvas)
            return

        for idx, champ in enumerate(filtered_champs):
            r = idx // cols
            c = idx % cols

            is_won = self.champions[champ]
            img = self.get_champion_portrait(champ, is_won)

            card_frame = tk.Frame(scroll_frame, bg="#010a13", padx=6, pady=6)
            card_frame.grid(row=r, column=c, padx=4, pady=4)

            btn = tk.Button(
                card_frame,
                image=img,
                bg="#0ac8b9" if is_won else "#1e2328",
                activebackground="#c8aa6e",
                bd=2,
                relief="solid",
                cursor="hand2",
                command=lambda name=champ: self.confirm_and_toggle(name)
            )
            btn.pack()

            if champ not in self.active_buttons:
                self.active_buttons[champ] = []
            self.active_buttons[champ].append(btn)

            lbl = tk.Label(
                card_frame,
                text=champ,
                font=("Segoe UI", 9, "bold" if not is_won else "normal"),
                fg="#a09b8c" if is_won else "#cdbe91",
                bg="#010a13",
                wraplength=85
            )
            lbl.pack(pady=(4, 0))

        self.bind_scroll_events(canvas, canvas)
        self.bind_scroll_events(scroll_frame, canvas)

    def refresh_buttons(self):
        self.active_buttons.clear()
        remaining = sorted([c for c, won in self.champions.items() if not won], key=lambda x: x.lower())
        completed = sorted([c for c, won in self.champions.items() if won], key=lambda x: x.lower())
        all_champs = sorted(list(self.champions.keys()), key=lambda x: x.lower())

        self.create_scrollable_grid(self.rem_tab, remaining)
        self.create_scrollable_grid(self.completed_tab, completed)
        self.create_scrollable_grid(self.all_tab, all_champs)

    def confirm_and_toggle(self, champ_name):
        current_status = self.champions[champ_name]
        action_word = "unmark (mark as Remaining)" if current_status else "mark as COMPLETED"

        confirm = messagebox.askyesno(
            "Confirm Action",
            f"Are you sure you want to {action_word} {champ_name}?",
            parent=self.root
        )

        if confirm:
            self.history.append((champ_name, current_status))
            self.champions[champ_name] = not current_status
            self.save_markdown()
            self.refresh_ui()

    def undo_last_action(self):
        if not self.history:
            return

        champ_name, prev_status = self.history.pop()
        self.champions[champ_name] = prev_status
        self.save_markdown()
        self.refresh_ui()
        messagebox.showinfo("Undo", f"Reverted {champ_name} back to {'Completed' if prev_status else 'Remaining'}.")

if __name__ == "__main__":
    root = tk.Tk()
    app = ChampionTrackerGUI(root)
    root.mainloop()