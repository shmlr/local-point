# Local Point VK Collector v0.2

Local READ-ONLY evidence collector for VK community audits.

Initial pilot:
- organization: Palleta
- community: https://vk.com/palleta.store
- mode: local browser, manual login, no cloud session

## Safety model

The collector is deliberately strict:

- no passwords in code;
- login is manual in a local browser window;
- on Windows the browser profile is stored under `%LOCALAPPDATA%\LocalPoint\vk-profile`;
- evidence is stored under `%LOCALAPPDATA%\LocalPoint\vk-evidence`;
- neither location is inside the Git repository;
- first pilot collection allows only GET / HEAD / OPTIONS;
- POST / PUT / PATCH / DELETE are blocked and logged with sanitized URLs;
- URL credentials, query strings and fragments are removed from logs unless a narrow VK wall-post reference can be safely canonicalized;
- no messages are opened;
- no publication, edit, delete, reply or settings mutation;
- if VK needs POST-based read operations to render evidence, the run returns BLOCKED instead of silently weakening policy.

This collector records what VK publishes. It does **not** promote platform data to current business truth.

## Dependency

One runtime dependency:

`playwright@1.64.1`

See `docs/DEPENDENCY_GATE.md`.

## Easiest Windows start

Open PowerShell in this directory and run:

```powershell
.\Start-VKCollector.ps1
```

The runner:

1. installs the local dependency if missing;
2. runs READ-ONLY policy tests;
3. checks that Chrome can start;
4. opens manual VK login only if a local profile does not yet exist;
5. runs the strict READ-ONLY collection.

It never relaxes the policy automatically.

## Manual commands

Install:

```powershell
npm install
```

Check environment:

```powershell
npm run doctor
npm test
```

Manual login:

```powershell
npm run login
```

Collect:

```powershell
npm run collect
```

Default target:

https://vk.com/palleta.store

Override:

```powershell
$env:VK_TARGET_URL="https://vk.com/example"
npm run collect
```

Use Edge instead of Chrome if necessary:

```powershell
$env:VK_BROWSER_CHANNEL="msedge"
.\Start-VKCollector.ps1
```

## Evidence output

Windows default:

`%LOCALAPPDATA%\LocalPoint\vk-evidence\<timestamp>\`

Files:

- `run-summary.json` - single machine-readable result: PASS/BLOCKED, evidence counts and next action;
- `snapshot.json` - provenance and run status;
- `visible-text.txt` - visible page text;
- `links.json` - discovered sanitized links;
- `blocked-requests.json` - sanitized non-read requests blocked by policy;
- `blocked-summary.json` - grouped endpoint summary for safe review;
- `manifest.sha256.json` - hashes for evidence integrity.

For routine review start with `run-summary.json`. Open raw blocked-request data only when the run requires diagnosis.

## Statuses

- `COLLECTED_READ_ONLY` - usable page evidence was captured.
- `BLOCKED` - login/security/rendering/policy prevented a useful snapshot.

A BLOCKED run is a valid result. Do not bypass CAPTCHA, security checks or the READ-ONLY boundary.

## Why POST blocking may cause a partial run

HTTP POST does not always mean a business-data write. Modern SPAs can use POST for read-like RPC calls.

For the first Palleta pilot we intentionally block all POST anyway.

If the first run is BLOCKED:
- inspect `run-summary.json`;
- then inspect `blocked-summary.json`;
- identify only endpoints proven to be read-only;
- add a narrow allowlist in a later reviewed change;
- never enable generic POST access.

## v0.1 scope

Included:
- public community page snapshot;
- visible text;
- sanitized links;
- immutable evidence manifest;
- one-file run summary;
- strict transport policy tests;
- safe diagnostics for blocked endpoints.

## Official VK API adapter v0.2

The browser pilot is complete. Broad browser POST remains blocked.

A second collector now uses only official VK API methods from an exact semantic read-only allowlist.

Setup a service token locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\Setup-VKServiceToken.ps1
```

The script asks for VK APP ID and VK CLIENT SECRET locally. The client secret is not saved. The returned service token is stored with Windows DPAPI under the current Windows user.

Run the API pilot:

```powershell
powershell -ExecutionPolicy Bypass -File .\Run-VKApiPilot.ps1
```

With a service token the API collector can read:
- community identity/profile;
- addresses;
- up to 100 wall posts;
- later, public comments through the same allowlist.

Products are deliberately separate: official VK schema marks `market.get` as user-token only. The collector will report MARKET_ITEMS as SOURCE_DATA_REQUIRED until a separately approved user-token flow is added.

See:
- `docs/VK_API_READ_ONLY_GATE.md`
- `docs/PALLETTA_BLOCKED_POST_REVIEW_2026-10-29.md`

Still not included:
- automatic post normalization to the final Local Point Evidence Contract;
- market products without an approved user token;
- admin settings;
- private messages;
- any VK write method.

## Palleta one-shot video publisher v0.1

This is a separate guarded write path. It does not change the default READ-ONLY collector policy.

Fixed target:
- `palleta.store`
- group ID `197164485`

Allowed write sequence:
1. validate fresh product facts and render the exact approved Palleta Reel template;
2. `video.save` for group `197164485`, with `wallpost=false`;
3. upload one MP4 to the returned VK upload URL;
4. `wall.post` to owner `-197164485`, from the group, with exactly one Palleta-owned video attachment and the validated post text.

All other VK write methods remain blocked.

Dry run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoPublish.ps1 -VideoPath "C:\path\to\video.mp4" -FactsPath "C:\path\to\facts.json"
```

Execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoPublish.ps1 -VideoPath "C:\path\to\video.mp4" -FactsPath "C:\path\to\facts.json" -Execute
```

See `docs/VK_PALLETTA_PUBLISH_GATE.md` before first live use.



### Palleta caption gate

For the current Snezhana 5 kg Reel, live publication is fail-closed until the caption has:
- the approved opening: `ВСЕГДА НИЗКИЕ ЦЕНЫ!`;
- `Снежана` and `5 кг`;
- a verified current retail price;
- the canonical address `Махачкала, проспект Петра I, 49.`;
- the approved CTA `Приходите в «Паллету»!`;
- the approved legal footnote.

The publisher does not accept free-form advertising copy. It renders the caption deterministically from the approved template and verified facts. The example facts file is blocked by default until current price and stock are confirmed.
