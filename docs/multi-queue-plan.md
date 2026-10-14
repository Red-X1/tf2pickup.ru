# Multi-queue plan

Status: approved. Implementation branch: `feature/multi-queue` (commits go to fork `Red-X1/tf2pickup.ru`, no PR to upstream).

## Shared understanding

Multiple queues (6v6 + 9v9 + ultiduo) run simultaneously in one instance. Path-based URLs `/6v6`, `/9v9`, `/ultiduo`; `/` redirects to 6v6. Left sidebar switches formats and shows live player counters (`5/12`); on mobile it becomes a horizontal strip under the navbar. bball is a later, separate stage.

| Decision           | Outcome                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Exclusivity        | a player may stand in several formats at once; on `launching` of format X the player is auto-removed from all other queues |
| Global (unchanged) | chat, online-players tab, hall-of-fame, skill/ELO, `games.*` runtime config, static game server pool, game numbering       |
| Per-format         | map pools, all `queue.*` runtime config keys, pre-ready, friend-marks, queue slots/state/votes/options                     |
| Games              | global numbering; `queue` field on `GameModel`                                                                             |
| `/games`           | filter by format; `/players`, `/statistics` stay global (skills shared)                                                    |
| Discord            | single channel, `[6v6]`-style prefix in messages                                                                           |
| API v1             | `GET /api/v1/queues` + `/api/v1/queues/:id`; `/api/v1/queue` stays as 6v6 alias                                            |
| Admin              | per-format clear queue, map pool tabs, runtime-config format picker                                                        |
| Migration          | backfill all existing games as `6v6`; wipe-and-reseed queue slots (pattern of `009-reset-queue.ts`)                        |
| Sidebar counters   | WS broadcast of a summary of all queues (occupied/capacity/state) to every client                                          |
| Ready-up dialog    | single dialog listing formats where the player is in a `ready` queue, one button each                                      |
| Env `QUEUE_CONFIG` | removed; `queueConfigs` registry is the single source of truth; telemetry/atlas/e2e updated                                |

## Stage 1 — Domain and data

1. **Types/models**: `QueueId` (`'6v6' | '9v9' | 'ultiduo'`); `queue` field on `QueueSlotModel`, `QueueStateModel`, `QueueFriendshipModel`, `QueueMapOptionModel`, `QueueMapVoteModel`, `GameModel`, `MapPoolEntry`.
2. **Indexes** (`ensure-indexes.ts`): composite `{queue, id}` for slots; scope friends/votes/options by `queue`; global unique `games.number` stays.
3. **Domain parameterization**: thread `queueId` through all `src/queue-auto/*` and `src/queue/*` operations (`join`, `leave`, `ready-up`, `unready`, `unready-queue`, `kick`, `mark-as-friend`, `vote-map`, `reset`, `get-*`, `set-state`); join allowed in different formats, not twice in one; auto-leave other queues on `launching`; task names scoped by format; pre-ready and friend-marks carry `queue`.
4. **Config singleton removal**: `src/queue-auto/config.ts` → `getQueueConfig(queueId)`; delete `environment.QUEUE_CONFIG` (verify consumers: telemetry `build-snapshot`, atlas heartbeat, admin tools, e2e `tests/queue-slots.ts`, unit test mocks).
5. **Games**: stamp `games.queue` on create (`create.ts` / `launch-game.ts`); `auto-reset` resets only the queue that launched; `pick-teams` unchanged (6v6/9v9/ultiduo class counts satisfy the 2|4 constraint); CSS class `config-${game.queue}` in `game-slot-list.tsx` / `game.page.tsx`.
6. **Queue configs**: registry without env; boot seeds all three queues in `queue-auto/index.ts`.
7. **Migration**: `src/migrations/0XX-multi-queue.ts` — backfill `queue: '6v6'` on `games`, wipe + reseed slots for all three formats, move current map pool to 6v6, duplicate `queue.*` configuration values into all formats.
8. **Map pools**: defaults for 9v9 (`koth_product`, `cp_gullywash`, `cp_process`, `cp_granary`, `cp_metalworks`, `cp_snakewater`, `cp_sunshine`, `cp_bagel`) and ultiduo (small maps such as `koth_product`, `koth_bagel`) in `maps/pool/reset.ts`; admin UI comes in stage 3.
9. **Domain tests**: update/add unit tests (join across formats, per-format state machine, auto-leave on launching, per-format reset).

## Stage 2 — Routes and WebSocket

1. **Routes**: `src/routes/6v6|9v9|ultiduo/` (or one parameterized route plugin) render `QueuePage({ queue })`; `src/routes/index.ts` redirects to `/6v6`.
2. **WS scoping**: replace every `.to({ url: '/' })` in `sync-clients.ts` (~8 spots) and `socket.currentUrl !== '/'` checks in `gateway.ts` with per-format path matching; `queue:join`/`leave`/`readyup`/`votemap`/`markasfriend`/`togglepreready` take the queue id from the socket's URL scope (not the payload).
3. **Sidebar summary**: new `queues/summary:updated` event + broadcast to all clients on any slots/state change in any queue.
4. **Ready-up dialog**: `ReadyUpDialog` lists formats with one ready-up button each.
5. `sync-clients` renders slots/counters/title for the correct format; `navigated` keeps reporting the path.

## Stage 3 — UI and admin

1. **Left sidebar** (`format-sidebar` component): format entries with emblem, name, `5/12` counter and state indicator; active format highlighted; mobile = horizontal strip under the navbar (Tailwind, `lg:` breakpoint).
2. **Queue page**: `QueuePage({ queue })` renders classes/slots from the format config; page description, title, `IsInQueue`, `CurrentPlayerCount`, MapVote all carry queue id.
3. **Right sidebar** (Queue/Online/Chat): chat and online stay global; Queue tab shows current format.
4. **`/games`**: format filter (tabs or select); `/games/123` links unchanged.
5. **Admin**: runtime-config settings (`queue.*`) get a format picker (default "all formats" after backfill); Clear queue button per format page; `/admin/map-pool` gets per-format tabs.
6. **Navigation**: `NavigationBar` unchanged (global items); `aria-current` for format routes lives in the sidebar.

## Stage 4 — Polish

1. **API v1**: `GET /api/v1/queues`, `GET /api/v1/queues/:id`; `/api/v1/queue` alias to 6v6 with `Deprecation` header; update `docs/api/README.md`.
2. **Discord**: `[6v6]`/`[9v9]`/`[ultiduo]` prefixes in join-prompts, notify-queue-cleared, notify-unbalanced-game.
3. **Telemetry/atlas**: `build-snapshot.ts` reports the list of active queues with occupancy; `send-heartbeat.ts` reports per-format occupied/capacity.
4. **Tests and CI**: e2e matrix without env tags — all three formats in one run or URL-based tags; `tests/queue-slots.ts` without `process.env.QUEUE_CONFIG`; unit tests no longer mock env.
5. **sample.env / docs**: remove `QUEUE_CONFIG`, document behaviour.
6. **Final verification**: `pnpm lint && pnpm test`, manual run of the dev server across all three formats.

## Out of scope (follow-up)

- bball config and matching game-server configs;
- per-format skills/ELO;
- per-format static game server pools;
- "Hide a Format" with persistence;
- per-format Discord channels;
- format scoping of `/players`, `/statistics`, `/hall-of-fame`.
