# Manual testing: one folder, two spellings (issue #52501)

## Why we are testing

opencode remembers which folder a session belongs to by saving the folder's path **as text**. Windows and a default
Mac ignore capitalization, so `CaseRepro/MyApp` and `caserepro/myapp` open the **same folder**, but as text they are
different. opencode then files that folder's sessions under two different places, and users see sessions vanish or
the same folder listed twice. On Linux the two spellings really are two different folders, and keeping them apart is
correct.

These steps are for two jobs:

1. **Reproduce the bug** on each platform with the released app, in both the terminal app (TUI) and the desktop app.
   macOS matters most: nobody has confirmed it there yet.
2. **Test the fix** later, with the same steps, to confirm the bug is gone and nothing else broke (especially on
   Linux, where the spellings must stay separate).

## Why the steps look like this

- **A mixed-case folder name (`CaseRepro/MyApp`).** The bug needs a name whose capitalization you can change while
  still reaching the same folder.
- **A plain folder, not a git repo.** For a plain folder, opencode identifies the folder from its path text alone, so
  the split always shows. For a git repo, opencode identifies the project by the repository, which can hide the split
  in session lists.
- **Sending `hi`.** A session only exists once its first message is sent. Any model works; the text doesn't matter.
- **Renaming every session (`real`, `variant`, `from-desktop`, ...).** opencode titles sessions automatically from the
  first message, so sessions that all start with `hi` look alike. Each name records **which spelling or app created
  it**, so when you look at a list you can tell exactly which session is missing or duplicated.
- **Quitting and reopening.** opencode fixes the folder it works in when it starts. Reopening with the other spelling
  is what hands it the different text. If an old session tab reopens on start, ignore it and use `/sessions`.
- **Switching the TUI session list to "current directory".** `/sessions` starts in **all projects**, which lists
  everything and hides the problem. **ctrl+a** switches to **current directory**, which lists only the sessions
  opencode thinks belong to this folder; that's where sessions go missing. The footer label names the scope ctrl+a
  switches *to*. Switching back to all projects then shows the same folder under two entries.
- **`opencode <folder>`.** Some shells pass the folder's real spelling to programs no matter what you typed.
  `opencode <folder>` always uses exactly what you typed, so it reproduces from any shell.
- **The desktop app.** The TUI and the desktop app share one background service, and people switch between them. A
  session made in one and missing in the other is how users actually meet this bug.

## Before you start

- Check the installed app: `opencode --version` should print `2.0.x`. Have the desktop app installed on Windows and
  macOS.
- Use folder paths without spaces.
- Each run creates a few throwaway sessions in your real session list; the cleanup section removes them.

---

## Part 1 — Reproduce the bug (released app)

### macOS

Setup: `mkdir -p ~/CaseRepro/MyApp`, then `ls -d ~/caserepro/myapp`. If it prints the folder, your drive ignores
case (the default). If it says "No such file", your drive is case-sensitive: follow the Linux steps instead.

TUI:

- [ ] 1. `opencode ~/CaseRepro/MyApp` → send `hi` → `/rename real` → quit.
- [ ] 2. `opencode ~/caserepro/myapp` → `/sessions` → ctrl+a until the list shows **current directory**.
      **Bug:** `real` is missing. Then send `hi` → `/rename variant` → quit.
- [ ] 3. `opencode ~/CaseRepro/MyApp` → `/sessions` → current directory. **Bug:** only `real` is listed.
- [ ] 4. ctrl+a to **all projects**. **Bug:** `real` and `variant` appear under two entries for the same folder.

Desktop (after the TUI steps):

- [ ] 5. Open the desktop app → **Add project** → choose `CaseRepro/MyApp` in the folder dialog.
- [ ] 6. Select the project and look at its sessions. **Bug:** `variant` (made with the lowercase spelling) is missing.
      Check **All projects** too: note whether `MyApp` appears twice.
- [ ] 7. In that project click **New session** → send `hi` → right-click the session → **Rename** → `from-desktop`.
- [ ] 8. `opencode ~/caserepro/myapp` → `/sessions` → current directory. **Bug:** `from-desktop` is missing.
- [ ] 9. Optional: in the desktop folder dialog, type the path in lowercase (press cmd+shift+G and enter
      `~/caserepro/myapp`) instead of clicking through. Note whether the project then shows up in lowercase. If it
      does, the desktop app can trigger the bug on its own.

### Windows

Setup (PowerShell): `New-Item -ItemType Directory -Force "$HOME\CaseRepro\MyApp"`.

TUI (works from any shell, because the folder is passed as typed):

- [ ] 1. `opencode C:\Users\<you>\CaseRepro\MyApp` → send `hi` → `/rename real` → quit.
- [ ] 2. `opencode c:\users\<you>\caserepro\myapp` → `/sessions` → ctrl+a to **current directory**.
      **Bug:** `real` is missing. Send `hi` → `/rename variant` → quit.
- [ ] 3. `opencode C:\Users\<you>\CaseRepro\MyApp` → `/sessions` → current directory. **Bug:** only `real` is listed.
- [ ] 4. ctrl+a to **all projects**. **Bug:** two entries for the same folder.

How users trigger it by accident (try each with a fresh session name, e.g. `/rename gitbash`):

| Shell | What to type | Expected |
|---|---|---|
| Git Bash | `cd ~/caserepro/myapp` then `opencode` | reproduces: Git Bash passes the typed spelling |
| Command Prompt | `cd /d c:\Users\<you>\CaseRepro\MyApp` then `opencode` | reproduces through the lowercase drive letter alone |
| PowerShell | `cd ~\caserepro\myapp` then `opencode` | **doesn't reproduce**: PowerShell passes the real spelling. This shows why some users never see the bug |

Desktop: same as macOS steps 5–9. For step 9, type `c:\users\<you>\caserepro\myapp` into the folder dialog's
address bar.

Optional, junction (a Windows folder shortcut):
`New-Item -ItemType Junction -Path "$HOME\CaseRepro\Link" -Target "$HOME\CaseRepro\MyApp"`, then
`opencode $HOME\CaseRepro\Link` → `/sessions` → current directory. Note whether `real` is listed. Today it isn't:
the shortcut counts as a separate place. The fix may change this, so record it.

### Linux (Mint / Omarchy): the control

Here, two spellings are two different folders, and opencode must keep them apart.

Setup: `mkdir -p ~/CaseRepro/MyApp`, then `ls -d ~/caserepro/myapp`. **Expected:** "No such file or directory".

TUI:

- [ ] 1. `opencode ~/CaseRepro/MyApp` → send `hi` → `/rename real` → quit.
- [ ] 2. `mkdir -p ~/caserepro/myapp && opencode ~/caserepro/myapp` → `/sessions` → current directory.
      **Correct:** `real` is not listed. Send `hi` → `/rename variant` → quit.
- [ ] 3. `opencode ~/CaseRepro/MyApp` → `/sessions` → current directory. **Correct:** only `real` is listed.

Desktop (if installed on Linux): add both `~/CaseRepro/MyApp` and `~/caserepro/myapp` as projects. **Correct:** two
separate projects, each with only its own sessions.

Optional, symlink: `ln -s ~/CaseRepro/MyApp ~/CaseRepro/link && opencode ~/CaseRepro/link` → `/sessions` → current
directory. Note whether `real` is listed (today: no). Record it; the fix may change this.

### WSL

First make sure you're running the Linux version inside WSL: `which opencode` must print a path like
`/home/<you>/...`, not one under `/mnt/c/`.

- [ ] **Linux home folder:** follow the Linux steps inside WSL. Expected: same as Linux.
- [ ] **Folder on the Windows drive (nobody knows yet):** in Windows create `C:\CaseRepro\MyApp`. In WSL run
      `ls -d /mnt/c/caserepro/myapp`. If it exists, follow the macOS TUI steps using `/mnt/c/CaseRepro/MyApp` as the
      real spelling and `/mnt/c/caserepro/myapp` as the wrong one. This is Linux software on a Windows drive that
      ignores case.
- [ ] **Windows app opening a WSL folder:** in WSL `mkdir -p ~/CaseRepro/MyApp`. In Windows run the TUI steps with
      `opencode \\wsl.localhost\<distro>\home\<you>\CaseRepro\MyApp` as one spelling and
      `opencode \\wsl$\<distro>\home\<you>\CaseRepro\MyApp` as the other. Both prefixes reach the same folder. Note
      whether the sessions split.

---

## Part 2 — Test the fix

Run this once the fix is on the `location-path-case` branch.

How to run the fixed version, from the repository root on that branch, after `bun install`:

- TUI: `bun run dev --standalone <folder>` wherever Part 1 says `opencode <folder>`. `--standalone` gives the fixed
  code its own private server, so your installed background service (which still has the bug) isn't involved.
- Desktop: `bun run dev:desktop`. Before relying on a desktop result, confirm the desktop dev build is using the
  branch's server rather than your installed service; otherwise a desktop "pass" or "fail" says nothing about the
  fix.

Use a **new** folder name, `CaseFix/MyApp`, so sessions left over from Part 1 don't confuse the results.

### Windows and macOS: the bug should be gone

- [ ] 1. Open `CaseFix/MyApp` with the real spelling → `hi` → `/rename real` → quit.
- [ ] 2. Open it with the lowercase spelling → `/sessions` → current directory. **Fixed:** `real` is listed. Send
      `hi` → `/rename variant` → quit.
- [ ] 3. Real spelling again → `/sessions` → current directory. **Fixed:** both `real` and `variant` are listed.
- [ ] 4. All projects scope. **Fixed:** one entry for the folder, not two.
- [ ] 5. Desktop: add `CaseFix/MyApp`. **Fixed:** `real` and `variant` both appear, and a desktop session shows up in
      the TUI with either spelling.
- [ ] 6. Windows: repeat with Git Bash and Command Prompt launches. **Fixed:** no split from any shell.
- [ ] 7. Ordinary use still works: open a normal project, create a session, quit, reopen. The session is still there.

### Linux: nothing should change

- [ ] Repeat the Linux steps with `CaseFix/MyApp` and `casefix/myapp`. **Still correct:** two separate folders, each
      with only its own sessions. A fix that merges them is a bug.

### Old sessions from Part 1

The first fix stops **new** splits; it does not merge sessions that were already split. Open `CaseRepro/MyApp` (from
Part 1) with each spelling and record where `real` and `variant` now appear in current-directory and all-projects
scope. Nothing should be lost in all-projects scope. Note anything that was visible before the fix and is hard to
reach after it.

### Links (if you tried them in Part 1)

Repeat the junction (Windows) or symlink (Linux) check and note whether the link now shares sessions with the real
folder. Either answer is useful: it shows the maintainers what the fix does to links.

---

## Results

| Platform / scenario | App | Session missing with other spelling? | Folder listed twice? | Notes |
|---|---|---|---|---|
| macOS, default drive | TUI | | | |
| macOS, default drive | Desktop | | | |
| Windows, `opencode <path>` | TUI | | | |
| Windows, Git Bash / Command Prompt / PowerShell | TUI | | | |
| Windows | Desktop | | | |
| Linux | TUI / Desktop | | | expected: kept separate |
| WSL, home / Windows drive / `\\wsl` prefixes | TUI | | | |
| **After the fix**, each row above | | | | |

## Cleanup

- Delete the test sessions: TUI `/sessions` → select a session → **delete** (shown in the footer); desktop:
  right-click the session.
- Remove the projects you added in the desktop app.
- Delete the folders: `~/CaseRepro`, `~/caserepro`, `~/CaseFix`, `~/casefix` (macOS, Linux, WSL),
  `C:\Users\<you>\CaseRepro`, `C:\Users\<you>\CaseFix` and `C:\CaseRepro` (Windows).
