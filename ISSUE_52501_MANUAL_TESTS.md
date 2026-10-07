# Issue #52501 — manual reproduction on Windows, WSL, macOS, Linux

Goal: show, on each platform, whether one folder reached through two spellings becomes two identities.

Each run checks three symptoms:

| Symptom | Command | Bug looks like |
|---|---|---|
| Stored directory keeps the typed spelling | `session.create` with the variant spelling | response `directory` is the variant, not the on-disk name |
| Session list splits | `session.list` with each spelling | each spelling lists only its own session |
| Project splits (non-git folders) | `location.get` with each spelling | two different `project.id` values |

Reference result (Windows 11, `v2` source, 2026-10-07): all three reproduced. The variant session was stored as
`...\caserepro\myapp`, each list returned only its own session, and `location.get` returned two project IDs.

## Before you start

1. **opencode v2**: `opencode --version` should print `2.0.x`. To test this branch instead, replace `opencode` with
   `bun run --cwd <repo>/packages/cli src/index.ts` in the helper below.
2. **Use operation IDs, not raw paths.** `opencode api session.list --param directory=...` works in every shell and
   URL-encodes for you. Raw `opencode api GET /api/...` breaks in Git Bash, which rewrites arguments starting with
   `/` into `C:/Program Files/Git/...`.
3. **`--standalone`** runs a private server per command, so no background service is needed and state persists in
   the data directory.
4. **Isolate test data (recommended)** so test sessions don't land in your real opencode database. Set these
   *after* defining `REAL`/`VARIANT` paths, and confirm with `opencode debug paths` that `data` and `db` point into
   the temp folder:
   - bash/zsh:
     ```bash
     export OC_TEST="$(mktemp -d)"
     export XDG_DATA_HOME="$OC_TEST/data" XDG_CONFIG_HOME="$OC_TEST/config" XDG_STATE_HOME="$OC_TEST/state" XDG_CACHE_HOME="$OC_TEST/cache"
     ```
   - PowerShell:
     ```powershell
     $env:OC_TEST = Join-Path $env:TEMP "oc-case-$(Get-Random)"
     $env:XDG_DATA_HOME = "$env:OC_TEST\data"; $env:XDG_CONFIG_HOME = "$env:OC_TEST\config"
     $env:XDG_STATE_HOME = "$env:OC_TEST\state"; $env:XDG_CACHE_HOME = "$env:OC_TEST\cache"
     ```
5. Use folder paths **without spaces**.

## The reproduction block

### bash / zsh (macOS, Linux, WSL, Git Bash)

Set `REAL` and `VARIANT` per platform section below, then:

```bash
oc() { opencode "$@" --standalone; }
ls -d "$VARIANT" && echo "case-INSENSITIVE here" || echo "case-SENSITIVE here"
oc api session.create -d "{\"location\":{\"directory\":\"$REAL\"},\"title\":\"real\"}"
oc api session.create -d "{\"location\":{\"directory\":\"$VARIANT\"},\"title\":\"variant\"}"
oc api session.list --param "directory=$REAL"
oc api session.list --param "directory=$VARIANT"
oc api location.get --param "location[directory]=$REAL"
oc api location.get --param "location[directory]=$VARIANT"
```

### PowerShell 7 (Windows)

Windows PowerShell 5.1 mangles quotes passed to native commands; use PowerShell 7 (`pwsh`) or Git Bash.

```powershell
function oc { opencode @args --standalone }
if (Test-Path $VARIANT) { "case-INSENSITIVE here" } else { "case-SENSITIVE here" }
oc api session.create -d (@{ location = @{ directory = $REAL }; title = "real" } | ConvertTo-Json -Compress)
oc api session.create -d (@{ location = @{ directory = $VARIANT }; title = "variant" } | ConvertTo-Json -Compress)
oc api session.list --param "directory=$REAL"
oc api session.list --param "directory=$VARIANT"
oc api location.get --param "location[directory]=$REAL"
oc api location.get --param "location[directory]=$VARIANT"
```

## Windows

```powershell
$REAL = "$HOME\CaseRepro\MyApp"; $VARIANT = "$HOME\caserepro\myapp"
New-Item -ItemType Directory -Force $REAL | Out-Null
```

Run the PowerShell block. **Expected today:** case-insensitive; all three symptoms reproduce.

Extra scenarios:

| Scenario | How | Expected today |
|---|---|---|
| Lowercase drive letter only | `$VARIANT = $REAL.Substring(0,1).ToLower() + $REAL.Substring(1)` and rerun | split (most common real-world trigger; cmd.exe produces it) |
| Real-world launch from Git Bash | `cd ~/caserepro/myapp && opencode` vs `cd ~/CaseRepro/MyApp && opencode` | TUI session lists differ (Git Bash passes the typed spelling through `PWD`) |
| Real-world launch from cmd.exe | `cd /d c:\users\<you>\CaseRepro\MyApp` then `opencode` | drive letter stays lowercase → split |
| Case-sensitive directory | admin shell: `fsutil file setCaseSensitiveInfo $REAL enable` (needs the WSL feature) | `Test-Path $VARIANT` is False; no split possible (control) |
| Junction | `New-Item -ItemType Junction -Path "$HOME\CaseRepro\Link" -Target $REAL`, use it as `$VARIANT` | record: split today (alias); a real-path fix would merge it |

## macOS

```bash
REAL="$HOME/CaseRepro/MyApp"; VARIANT="$HOME/caserepro/myapp"
mkdir -p "$REAL"
```

Run the bash block. **Expected today:** default APFS is case-insensitive, so all three symptoms reproduce. Nobody
has confirmed this on the issue yet, so this result matters most.

Also record whether Bun's real path already fixes case on macOS (Phase 0.1):

```bash
bun -e "console.log(require('fs').realpathSync.native(process.argv.at(-1)))" "$VARIANT"
```

Expected: prints `.../CaseRepro/MyApp`.

Extra scenarios:

| Scenario | How | Expected today |
|---|---|---|
| Case-sensitive volume | `hdiutil create -size 100m -fs "Case-sensitive APFS" -volname CaseSens ~/casesens.dmg && hdiutil attach ~/casesens.dmg`, then `REAL=/Volumes/CaseSens/MyApp VARIANT=/Volumes/CaseSens/myapp` | `ls -d "$VARIANT"` fails; behaves like Linux (control) |
| Unicode normalization | `REAL="$HOME/CaseRepro/$(printf 'Caf\xc3\xa9')"; VARIANT="$HOME/CaseRepro/$(printf 'Cafe\xcc\x81')"; mkdir -p "$REAL"` | record whether both spellings split (NFC vs NFD) |

Clean up the image afterwards with `hdiutil detach /Volumes/CaseSens && rm ~/casesens.dmg`.

## Linux (Mint ext4 / Omarchy btrfs)

```bash
REAL="$HOME/CaseRepro/MyApp"; VARIANT="$HOME/caserepro/myapp"
mkdir -p "$REAL" "$VARIANT"
```

Both folders really exist here and are different. Run the bash block. **Expected today (correct behavior):**
case-sensitive; each list shows only its own session and project IDs differ, which is right because they are
different folders. Any fix must keep this.

Extra scenario: symlink, to record current behavior for the maintainers' symlink decision.
`ln -s "$REAL" "$HOME/CaseRepro/link"`, then rerun with `VARIANT="$HOME/CaseRepro/link"`. Today the symlink and its
target are separate identities.

## WSL

First confirm you are running the **Linux** opencode inside WSL, not the Windows one through interop:
`which opencode` must print a Linux path (e.g. `/home/<you>/...`), not `/mnt/c/...`. The installer has a known
WSL issue that can skip the Linux install (#48153).

| # | Scenario | Setup | Expected today |
|---|---|---|---|
| W1 | Project on the Linux filesystem | Linux section commands inside WSL | case-sensitive; like Linux |
| W2 | Windows-created folder on `/mnt/c` (DrvFs) | In PowerShell: `mkdir C:\CaseRepro\MyApp`. In WSL: `REAL=/mnt/c/CaseRepro/MyApp VARIANT=/mnt/c/caserepro/myapp` | **unknown; most important WSL result.** `process.platform` is `linux` here, yet the folder may be case-insensitive |
| W3 | WSL-created folder on `/mnt/c` | In WSL: `mkdir -p /mnt/c/CaseRepro/FromWsl; REAL=/mnt/c/CaseRepro/FromWsl VARIANT=/mnt/c/CaseRepro/fromwsl` | record; inspect the flag with `fsutil.exe file queryCaseSensitiveInfo 'C:\CaseRepro\FromWsl'` |
| W4 | Windows opencode opening a WSL folder | In WSL: `mkdir -p ~/CaseRepro/MyApp`. In PowerShell: `$REAL = "\\wsl.localhost\<distro>\home\<you>\CaseRepro\MyApp"; $VARIANT = "\\wsl.localhost\<distro>\home\<you>\caserepro\myapp"` | variant should not exist (ext4); record what `session.create` does |
| W5 | Two prefixes for one WSL folder | Same as W4 but `$VARIANT = "\\wsl$\<distro>\home\<you>\CaseRepro\MyApp"` | record: likely split (same folder, two strings) |

For W2 and W3, also record what the real-path primitives return (Phase 0.3):

```bash
realpath "$VARIANT"
bun -e "console.log(require('fs').realpathSync.native(process.argv.at(-1)))" "$VARIANT"
```

If these print the variant spelling rather than the on-disk name, a real-path fix alone will not cover DrvFs.

## Automated tests (all platforms)

From a checkout of the `location-path-case` branch:

```bash
cd packages/core
bun run test test/location-layer.test.ts test/session-store.test.ts test/session-create.test.ts test/session-move.test.ts
```

| Where | Expected today |
|---|---|
| Windows, macOS (default APFS) | 6 new tests fail (cache coalescing, location binding, create, import, move, listing); the Linux guard skips |
| Linux, WSL `/home` | the 6 skip; "keeps directories that differ only in case" and "lists sessions recorded for a directory that no longer exists" pass |
| WSL on DrvFs | prefix with `TMPDIR=/mnt/c/Users/<you>/AppData/Local/Temp` so test folders land on `/mnt/c`; record which group runs |

The test files decide by probing the temp volume, not by OS. Known unrelated failure on Windows:
"Session.create > runs a shell command and projects the started/ended shell message" fails without these changes too.

## Recording results

Paste the outputs into a table like this for the issue comment:

| Platform / scenario | FS case behavior | Variant stored as | Lists split? | Project IDs differ? | realpath result |
|---|---|---|---|---|---|
| Windows 11, NTFS | insensitive | variant | yes | yes | on-disk casing (`.native`) |
| macOS, APFS | | | | | |
| Linux, ext4/btrfs | | | | | n/a |
| WSL W2 (`/mnt/c`) | | | | | |

## Cleanup

Isolated data: delete the temp folder (`rm -rf "$OC_TEST"` or `Remove-Item -Recurse $env:OC_TEST`) and unset the
`XDG_*` variables. Without isolation, delete test sessions with `opencode session delete <sessionID>`. Remove the
`CaseRepro` folders.
