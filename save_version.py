import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog

def run_cmd(cmd, cwd=None):
    """Run shell command in given directory"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        if result.returncode != 0:
            return False, result.stderr.strip()
        return True, result.stdout.strip()
    except Exception as e:
        return False, str(e)

def get_latest_version(repo_path):
    ok, output = run_cmd("git tag --sort=-v:refname", cwd=repo_path)
    if not ok or not output.strip():
        return "v1.0"
    latest = output.splitlines()[0].strip()
    try:
        # Verwacht formaat: vX.Y
        base = latest[1:] if latest.startswith("v") else latest
        parts = base.split(".")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return f"v{parts[0]}.{int(parts[1])+1}"
        else:
            return latest + "_new"
    except:
        return latest + "_new"

def choose_folder():
    folder = filedialog.askdirectory(title="Kies je Git projectmap")
    if folder:
        repo_path.set(folder)
        suggested = get_latest_version(folder)
        version_entry.delete(0, tk.END)
        version_entry.insert(0, suggested)

def save_version():
    folder = repo_path.get()
    version = version_entry.get().strip()
    message = message_entry.get().strip()

    if not folder:
        messagebox.showwarning("Fout", "Kies eerst een projectmap")
        return
    if not version:
        messagebox.showwarning("Fout", "Voer een versie/tag in")
        return
    if not message:
        messagebox.showwarning("Fout", "Voer een commit-message in")
        return

    steps = [
        ("Bestanden toevoegen", "git add ."),
        ("Commit maken", f'git commit -m "{message}"'),
        (f"Nieuwe tag {version}", f"git tag {version}"),
        ("Code pushen", "git push"),
        ("Tags pushen", "git push --tags")
    ]

    log_output = ""
    for step_name, cmd in steps:
        ok, output = run_cmd(cmd, cwd=folder)
        log_output += f"\n[{step_name}]\n{output}\n"
        if not ok:
            messagebox.showerror("Fout", f"Stap mislukt: {step_name}\n\n{output}")
            return

    messagebox.showinfo("Succes", f"Versie {version} opgeslagen en gepusht!\n\n{log_output}")

# --- UI ---
root = tk.Tk()
root.title("GitHub Version Saver")

repo_path = tk.StringVar()

tk.Button(root, text="Kies projectmap", command=choose_folder).pack(pady=10)
tk.Label(root, textvariable=repo_path, fg="blue").pack(pady=5)

tk.Label(root, text="Versie/tag:").pack(pady=5)
version_entry = tk.Entry(root, width=30)
version_entry.pack(pady=5)

tk.Label(root, text="Commit-message:").pack(pady=5)
message_entry = tk.Entry(root, width=50)
message_entry.pack(pady=5)

button = tk.Button(root, text="Save Nieuwe Versie", command=save_version, width=30, height=2)
button.pack(pady=20)

root.mainloop()
