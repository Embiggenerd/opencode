# Issue #52501 — manual test guide

Goal: on each machine, find out whether opencode treats **one folder** reached through **two spellings** as two
different places. Work through your machine's checklist top to bottom and fill in the results table at the end.

## What you are looking for

opencode remembers which folder each session belongs to by saving the folder path **as text**. On a filesystem that
ignores case (Windows, a default Mac), `CaseRepro/MyApp` and `caserepro/myapp` open the same folder, but as text they
are different, so opencode files sessions under two different "places". You will see it as:

| Symptom | Where you see it |
|---|---|
| Sessions disappear | A session made with one spelling is missing when you open the folder with the other spelling |
| The folder shows up twice | In the all-projects session list, the same folder appears as two separate entries |
| (Desktop) sessions don't carry over | A session made in the terminal app doesn't appear when the desktop app opens the same folder |

On Linux the opposite is correct: `MyApp` and `myapp` really are two different folders, and must stay separate.

## Why the steps are the way they are

- **A mixed-case folder name (`CaseRepro/MyApp`).** The bug needs a name where changing the capitalization still
  points at the same folder. All-lowercase names give you nothing to vary.
- **A plain folder, not a git repo.** For a plain folder, opencode's identity for the folder comes straight from the
  path text, so the split is guaranteed to be visible. For a git repo, opencode identifies the project by the repo
  itself, and the session picker filters by project, which can hide the split. Try a git repo only as an extra.
- **Sending `hi`.** A session is only created once you send its first message. Any model works; the content doesn't
  matter.
- **`/rename real` and `/rename variant`.** opencode titles new sessions automatically from the first message, so two
  sessions that both started with `hi` end up with similar or identical titles (or "untitled"). Renaming gives each
  one a label that tells you **which spelling created it**, so when you look at a list you can say exactly which
  session is missing or duplicated.
- **Quitting between steps.** opencode decides which folder it's working in when it starts. Restarting with the other
  spelling is what feeds it the different text. If a previous session tab reopens on start, ignore it and use
  `/sessions`.
- **ctrl+a in `/sessions`.** The picker starts in **all projects** scope, which lists every session everywhere and
  hides the problem. Press **ctrl+a** to switch to **current directory** scope, which lists only the sessions opencode
  thinks belong to this folder; that's where sessions go missing. The footer label names the scope ctrl+a will switch
  *to*. Switching back to all projects then shows both sessions side by side, under two entries.
- **Opening the wrong spelling deliberately.** Shells differ in whether they pass your typed spelling or the real one
  to programs. `opencode <folder>` always uses exactly what you typed, so it works from any shell.

## Before you start (every machine)

- Use the installed app: `opencode --version` should print `2.0.x`. Without an installed app, run from the repo root
  with `bun run dev --standalone <folder>` everywhere this guide says `opencode <folder>` (skip the desktop check
  then; it needs the shared background service).
- Use a folder path without spaces.
- These steps create two or three throwaway sessions in your real session list. Delete them at the end.

---

## macOS — most important result (nobody has confirmed it yet)

Setup:

```bash
mkdir -p ~/CaseRepro/MyApp
ls -d ~/caserepro/myapp
```

If `ls` prints the folder, the drive ignores case (default). If it says "No such file", you have a case-sensitive
volume; follow the Linux checklist instead.

Steps:

- [ ] 1. `cd ~/CaseRepro/MyApp && opencode` → send `hi` → `/rename real` → quit.
- [ ] 2. `cd ~/caserepro/myapp && opencode` → `/sessions` → ctrl+a to **current directory**.
      **Bug if** `real` is missing. Then send `hi` → `/rename variant` → quit.
- [ ] 3. `cd ~/CaseRepro/MyApp && opencode` → `/sessions` → **current directory**.
      **Bug if** only `real` is listed.
- [ ] 4. ctrl+a to **all projects**. **Bug if** `real` and `variant` sit under two different entries for the same
      folder.
- [ ] 5. Desktop check (see [Desktop check](#desktop-check-windows-and-macos)).

Extras (optional):

- [ ] Accented name: `mkdir -p ~/CaseRepro/Café`, then repeat steps 1–3 opening it once by typing the name and once
      via `opencode "$(printf "$HOME/CaseRepro/Cafe\xcc\x81")"` (same name, the accent stored as a separate mark). Bug
      if the sessions split. macOS treats both encodings as the same name.
- [ ] Case-sensitive volume (control): `hdiutil create -size 100m -fs "Case-sensitive APFS" -volname CaseSens
      ~/casesens.dmg && hdiutil attach ~/casesens.dmg`, then `mkdir /Volumes/CaseSens/MyApp` and try
      `cd /Volumes/CaseSens/myapp`. Expected: "No such file", like Linux. Clean up with
      `hdiutil detach /Volumes/CaseSens && rm ~/casesens.dmg`.

## Windows

Setup (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$HOME\CaseRepro\MyApp" | Out-Null
```

Steps:

- [ ] 1. `opencode $HOME\CaseRepro\MyApp` → send `hi` → `/rename real` → quit.
- [ ] 2. `opencode c:\users\<you>\caserepro\myapp` (type it in lowercase) → `/sessions` → ctrl+a to
      **current directory**. **Bug if** `real` is missing. Send `hi` → `/rename variant` → quit.
- [ ] 3. `opencode $HOME\CaseRepro\MyApp` → `/sessions` → **current directory**. **Bug if** only `real` is listed.
- [ ] 4. ctrl+a to **all projects**. **Bug if** the two sessions sit under two entries for the same folder.
- [ ] 5. Desktop check (see [Desktop check](#desktop-check-windows-and-macos)).

Real-world launch styles (each is how users actually hit this; record which reproduce):

| Shell | Wrong-spelling launch | Expected |
|---|---|---|
| Git Bash | `cd ~/caserepro/myapp && opencode` | reproduces (Git Bash passes the typed spelling) |
| cmd.exe | `cd /d c:\Users\<you>\CaseRepro\MyApp` then `opencode` | reproduces via the lowercase drive letter only |
| PowerShell | `cd ~\caserepro\myapp; opencode` | **does not reproduce**: PowerShell passes the real spelling. Record as a control |

Extras (optional):

- [ ] Junction: `New-Item -ItemType Junction -Path "$HOME\CaseRepro\Link" -Target "$HOME\CaseRepro\MyApp"`, then
      open `$HOME\CaseRepro\Link` and check `/sessions`. Record whether its sessions are separate from `MyApp`'s
      (today: separate). This informs the maintainers' symlink decision.

## Linux (Mint / Omarchy) — the control

Setup:

```bash
mkdir -p ~/CaseRepro/MyApp
ls -d ~/caserepro/myapp
```

Expected: "No such file or directory". On Linux that's a different folder name, which is correct.

Steps:

- [ ] 1. `cd ~/CaseRepro/MyApp && opencode` → send `hi` → `/rename real` → quit.
- [ ] 2. `mkdir -p ~/caserepro/myapp && cd ~/caserepro/myapp && opencode` → `/sessions` → **current directory**.
      **Correct if** `real` is **not** listed (this really is a different folder). Send `hi` → `/rename variant` → quit.
- [ ] 3. `cd ~/CaseRepro/MyApp && opencode` → `/sessions` → **current directory**. **Correct if** only `real` is
      listed.

Here, separate is the right answer. These results are what a fix must not break.

Extras (optional):

- [ ] Symlink: `ln -s ~/CaseRepro/MyApp ~/CaseRepro/link && cd ~/CaseRepro/link && opencode` → `/sessions`.
      Record whether `real` is listed (today: not, the link counts as a separate place).

## WSL

First make sure you're running the Linux build inside WSL: `which opencode` must print a Linux path like
`/home/<you>/...`, not `/mnt/c/...`. (The installer has a known WSL problem that can skip the Linux install, #48153.)

- [ ] **W1, Linux home folder:** follow the Linux checklist inside WSL. Expected: same as Linux.
- [ ] **W2, folder on the Windows drive (the unknown):**
  1. In Windows: `mkdir C:\CaseRepro\MyApp`.
  2. In WSL: `ls -d /mnt/c/caserepro/myapp`. Record whether it exists.
  3. If it exists, follow the macOS steps with `/mnt/c/CaseRepro/MyApp` as the real spelling and
     `/mnt/c/caserepro/myapp` as the wrong one. Record whether it splits. This is Linux software on a
     case-ignoring Windows drive, which no one has tested.
  4. Record what the real-path lookup returns:
     `realpath /mnt/c/caserepro/myapp` and
     `bun -e "console.log(require('fs').realpathSync.native(process.argv.at(-1)))" /mnt/c/caserepro/myapp`.
     If they print the lowercase spelling, the planned fix alone won't cover this case.
- [ ] **W3, Windows app opening a WSL folder:** in WSL `mkdir -p ~/CaseRepro/MyApp`. In PowerShell, open it twice:
  `opencode \\wsl.localhost\<distro>\home\<you>\CaseRepro\MyApp` and
  `opencode \\wsl$\<distro>\home\<you>\CaseRepro\MyApp` (same folder, two path prefixes). Record whether
  `/sessions` (current directory) splits between them.

## Desktop check (Windows and macOS)

Why: the terminal app and the desktop app share one background service, and users switch between them. This shows
the bug the way they meet it.

- [ ] 1. In a terminal, open the **wrong spelling** (macOS `cd ~/caserepro/myapp && opencode`, Windows
      `opencode c:\users\<you>\caserepro\myapp`) → send `hi` → `/rename from-terminal` → quit.
- [ ] 2. In the desktop app, open `CaseRepro/MyApp` with its folder picker.
- [ ] 3. **Bug if** `from-terminal` is missing from the desktop app's session list for that folder.
- [ ] 4. Note whether the desktop app ever shows the folder in the lowercase spelling (recent projects, title). If
      it does, that's another way users trigger the bug.

## Automated tests (each machine)

Run from a checkout of the `location-path-case` branch:

```bash
cd packages/core
bun run test test/location-layer.test.ts test/session-store.test.ts test/session-create.test.ts test/session-move.test.ts
```

| Machine | Expected today |
|---|---|
| Windows, macOS (default) | 6 new tests fail: those demonstrate the bug |
| Linux, WSL home | the 6 are skipped; "keeps directories that differ only in case" passes |
| WSL on `/mnt/c` | prefix the command with `TMPDIR=/mnt/c/Users/<you>/AppData/Local/Temp`; record which group runs |

Known unrelated failure on Windows: "Session.create > runs a shell command and projects the started/ended shell
message" fails without these changes too.

## Results table

| Machine / scenario | Wrong spelling opens? | Session missing in current-directory scope? | Two entries in all projects? | Desktop shows terminal session? | Notes |
|---|---|---|---|---|---|
| macOS, default APFS | | | | | |
| Windows, `opencode <lowercase path>` | | | | | |
| Windows, Git Bash / cmd / PowerShell | | | | n/a | |
| Linux | | | | n/a | expected: separate |
| WSL W1 / W2 / W3 | | | | n/a | |

## Cleanup

- Delete the test sessions: in `/sessions`, select each and use **delete** (shown in the picker footer), or
  `opencode session delete <sessionID>`.
- Remove the folders: `rm -rf ~/CaseRepro ~/caserepro` (macOS/Linux/WSL), `Remove-Item -Recurse $HOME\CaseRepro`
  and `C:\CaseRepro` (Windows).

---

## Appendix: API commands (exact output for the issue comment)

Same checks without the UI, useful for pasting precise results. They create sessions with `--standalone`, which runs a
private server per command. Use operation IDs (`session.list`), not raw `/api/...` paths: Git Bash rewrites arguments
that start with `/`.

bash / zsh (set `REAL` and `VARIANT` to the two spellings first):

```bash
oc() { opencode "$@" --standalone; }
oc api session.create -d "{\"location\":{\"directory\":\"$REAL\"},\"title\":\"real\"}"
oc api session.create -d "{\"location\":{\"directory\":\"$VARIANT\"},\"title\":\"variant\"}"
oc api session.list --param "directory=$REAL"
oc api session.list --param "directory=$VARIANT"
oc api location.get --param "location[directory]=$REAL"
oc api location.get --param "location[directory]=$VARIANT"
```

PowerShell 7 (Windows PowerShell 5.1 mangles the quotes):

```powershell
function oc { opencode @args --standalone }
oc api session.create -d (@{ location = @{ directory = $REAL }; title = "real" } | ConvertTo-Json -Compress)
oc api session.create -d (@{ location = @{ directory = $VARIANT }; title = "variant" } | ConvertTo-Json -Compress)
oc api session.list --param "directory=$REAL"
oc api session.list --param "directory=$VARIANT"
oc api location.get --param "location[directory]=$REAL"
oc api location.get --param "location[directory]=$VARIANT"
```

Bug looks like: the variant session's `directory` is the typed spelling; each `session.list` returns only its own
session; the two `location.get` calls return different `project.id` values. Reference result (Windows 11, `v2`
source, 2026-10-07): all three reproduced.
