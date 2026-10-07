# Issue #52501 — case-variant paths split location identity

Branch: `location-path-case` (from `upstream/v2`). Target: `v2`.

## Problem

On case-insensitive filesystems (NTFS, default APFS, some WSL/DrvFs and removable mounts), the same folder can
arrive with different spellings (`D:\Projects\App`, `d:\projects\app`). Placement identity is the literal string,
so:

- **Live services split**: `LocationServiceMap.canonical()` (`packages/core/src/location-service-map.ts:39`) only
  applies `path.normalize` on win32, so each spelling boots its own services (duplicate MCP/plugin init).
- **Durable placement splits**: `Session.create` publishes `parent?.location ?? input.location` verbatim
  (`packages/core/src/session.ts:268`); `SessionMove.resolveDestination` persists `path.resolve(...)` verbatim
  (`packages/core/src/session/move.ts:80`); forks copy `parent.directory` (`session/projector.ts:166`).
- **Listing misses rows**: `SessionStore.list` filters with exact `eq(SessionTable.directory, ...)`
  (`packages/core/src/session/store.ts:105`).
- **Non-VCS projects split**: their ID is `Hash.fast("directory:" + directory)` (`packages/core/src/project.ts`).

Prior art: #29641 (closed) attempted case-insensitive storage; #29666 (merged) shipped slash-only normalization;
#50394 (open) canonicalizes cache lookups with `realpathSync.native`, win32 only.

## Phase 0 — confirm filesystem behavior (no code)

Use the pinned runtime (`bun@1.4.2`). Each check asserts an explicit expected value; record actual output.
Treat every result as a hypothesis until confirmed on that platform.

| # | Check | Platform | Pass condition |
|---|---|---|---|
| 0.1 | `fs.realpathSync.native(wrongCase)` | macOS APFS (default) | returns on-disk casing |
| 0.2 | same, on case-sensitive APFS image | macOS | wrong-case path → `ENOENT`; correct path unchanged |
| 0.3 | same, on `/mnt/c/...` (DrvFs) | WSL2 | record casing returned; **open question** |
| 0.4 | same, on `\\wsl.localhost\<distro>\home\...` and `\\wsl$\...` | Windows | wrong case → `ENOENT`; record prefix returned |
| 0.5 | same, in a `fsutil file setCaseSensitiveInfo` directory | Windows | wrong case → `ENOENT` |
| 0.6 | NFC vs NFD spelling of a folder named with `é` | macOS | record whether realpath returns one stored form |
| 0.7 | error codes surfaced (`ENOENT`, `EACCES`, `ENOTDIR`, other) | all | `normalizePath` currently swallows *all* errors — record which occur |
| 0.8 | latency of `realpathSync.native` | Windows local, UNC, `\\wsl.localhost`; WSL `/mnt/c` | record p50/p99; warm local alone is not sufficient |

Already observed (Windows 11, bun 1.4.2): `.native`/`promises.realpath` return on-disk casing incl. drive letter
and resolve junctions to targets; non-native `realpathSync`/callback `realpath` preserve input casing; missing paths
throw `ENOENT`. Re-run with explicit asserts.

Must preserve: a **nonexistent wrong-case path** and a **valid path on a case-sensitive filesystem** are different
situations; both currently look like "realpath failed/returned input" and must not be conflated.

Design decision, separate from Phase 1: if 0.3 shows DrvFs does not return on-disk casing, a fallback is needed.
A single case-sensitivity probe does not establish behavior for every ancestor across mounts, so any fallback must
be per-segment. Do not build it unless 0.3 requires it.

## Phase 1 — coordinate

Comment on #52501 and #50394 with Phase 0 results before writing code. Questions for maintainers:

1. Supersede #50394 or build on it? Its core change is the win32 version of the cache fix below.
2. Apply real-path canonicalization on every platform (needed for macOS, DrvFs, case-insensitive Linux mounts)
   rather than win32 only?
3. Real paths resolve symlinks/junctions to targets. `Project.resolve` already does (`FSUtil.Service.resolve`),
   but placement keys for linked folders would change. Acceptable?
4. Repair of existing data: projections are folds of durable events, so a row-only rewrite diverges from replay.
   Preferred mechanism (durable relocation event, lazy repair-on-contact, or migration with a retry policy)?

## Phase 2 — PR 1: cache identity, durable writes, legacy-compatible listing

One core canonicalization function (based on `FSUtil.normalizePath`, `packages/util/src/fs-util.ts:238`), applied at
every boundary that creates identity:

| Boundary | Change |
|---|---|
| Cache lookup (`location-services.ts:58`) | already routes `get`/`contextEffect`/`contextEffectOption`/`invalidate` through `canonical()`; switch `canonical()` to the real-path function |
| Cache invalidation | record the key resolved at acquisition; invalidate by recorded key so an alias whose target changed still hits the cached instance |
| `Session.create` (`session.ts:268`) | canonicalize `input.location` before `projects.resolve` and before publishing `SessionEvent.Created` |
| Inherited placement (child of `parentID`) | keep the parent's stored location so a family stays together; legacy parents are handled by repair |
| `SessionMove.resolveDestination` (`move.ts:80`) | canonicalize after `stat` succeeds, before building `destination` |
| Fork (`projector.ts:166`) | copies parent; no change (consistent with inherited placement) |
| Import (`SessionTransfer.import`, `session/transfer.ts:98`) | canonicalize `input.location` before `projects.resolve` and before publishing `SessionEvent.Created`. Confirmed write path that bypasses `Session.create`; the CLI happens to send `location.get`'s (canonical) directory, but the HTTP endpoint accepts any client's location |
| Listing (`SessionStore.list`, `store.ts:105`) | match `directory IN (input, canonical(input))` in core, inside `WHERE` before anchor/limit, so pagination stays correct and direct core/SDK callers get the same behavior |

Listing guarantee: a stored spelling stays reachable by its own spelling (no regression), and canonical queries find
new rows. Legacy rows in a third spelling remain as reachable as today until repair (Phase 3).

Error handling depends on the boundary:

| Boundary | On canonicalization failure |
|---|---|
| Writes (create, move, import) | fall back to input on `ENOENT`/`ENOTDIR`; surface other errors (these paths need a usable folder; move already `stat`s) |
| Listing | best-effort: on **any** failure filter by the raw input only — exactly today's behavior; listing must never fail because of realpath |
| Cache lookup (`canonical()`) | fall back to input; `canonical()` is synchronous and currently total, so a throw inside `inner.get(canonical(ref))` would be a defect, not a typed error |

No input-string cache unless Phase 0.8 shows UNC/WSL latency requires it; if added, it needs an explicit refresh
policy and its own lifecycle test.

### Tests (packages/core)

Gate by probing the test's temp directory (swapped-case `stat` + bigint `dev`/`ino`), not by `process.platform`, so
coalescing tests run on Windows CI and dev Macs and separation tests run on Linux CI.

- case variants share one location context; concurrent acquisition through both spellings boots one instance
- invalidation through an alias (including a junction/symlink whose target changes) removes the cached instance
- workspace-ID isolation: same directory, different `workspaceID` stay separate
- mixed-case `Session.create` persists canonical directory; child inherits parent's stored location
- mixed-case `SessionMove` persists canonical destination
- mixed-case `SessionTransfer.import` (direct core call, not via CLI) persists canonical directory
- listing when realpath fails with a non-`ENOENT` error returns the same rows as today (raw-spelling match)
- legacy rows with both spellings: listing by either spelling returns expected rows; forward and backward
  pagination across the boundary
- `Proj` and `proj` remain distinct on case-sensitive filesystems
- missing directory: input preserved, no crash; non-`ENOENT` errors surface

Verification: `bun typecheck` in `packages/core` and `packages/util`, `bun test` in each, `bun run check` at root.

## Phase 3 — PR 2: repair existing data (after maintainer answer to Phase 1 Q4)

- **Session directories**: rewrite to canonical where the folder resolves. Missing folders must be retried later —
  a one-shot migration is marked complete permanently (`database/migration.ts:107`), so it cannot be the only
  mechanism.
- **Project consolidation** (non-VCS split projects), all in one transaction:
  - survivor selection (project whose `worktree` equals canonical; else oldest)
  - reassign `session.project_id`, `permission`, `worktree`, `project_directory` before deleting the duplicate
    (all cascade on delete)
  - resolve composite-key collisions (`project_directory` PK, `permission` unique index) by deduplication
  - preserve project metadata (`name`, icon fields, `commands`, `sandboxes`, timestamps)
  - define replay/import policy for `SessionEvent.Created`/move events that carry the old project ID and directory
- **`permission.resource`**: excluded from generic path repair. Values are action-scoped strings and may be
  patterns; any repair must be action-aware. `normalizePathPattern()` handles only a narrow shape. Likely a
  separate issue.

## Phase 4 — cross-platform manual verification

| Platform | Scenarios |
|---|---|
| Windows | pwsh, cmd (lowercase drive letter), Git Bash (wrong casing via `PWD`); case-sensitive directory; junction |
| WSL | project in `/home` (ext4); project in `/mnt/c` (DrvFs); Windows opencode opening `\\wsl.localhost\...` |
| macOS | default APFS; case-sensitive APFS image; NFC/NFD folder name |
| Linux | `Proj` and `proj` side by side; symlinked project (Mint ext4 / Omarchy btrfs) |
| All | create, move, fork, list (both directions) with mixed casing; upgrade from current release with pre-split data |
