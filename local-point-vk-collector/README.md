# Local Point VK Collector v0.1

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

- `snapshot.json` - provenance and run status;
- `visible-text.txt` - visible page text;
- `links.json` - discovered sanitized links;
- `blocked-requests.json` - sanitized non-read requests blocked by policy;
- `blocked-summary.json` - grouped endpoint summary for safe review;
- `manifest.sha256.json` - hashes for evidence integrity.

## Statuses

- `COLLECTED_READ_ONLY` - usable page evidence was captured.
- `BLOCKED` - login/security/rendering/policy prevented a useful snapshot.

A BLOCKED run is a valid result. Do not bypass CAPTCHA, security checks or the READ-ONLY boundary.

## Why POST blocking may cause a partial run

HTTP POST does not always mean a business-data write. Modern SPAs can use POST for read-like RPC calls.

For the first Palleta pilot we intentionally block all POST anyway.

If the first run is BLOCKED:
- inspect `blocked-summary.json`;
- identify only endpoints proven to be read-only;
- add a narrow allowlist in a later reviewed change;
- never enable generic POST access.

## v0.1 scope

Included:
- public community page snapshot;
- visible text;
- sanitized links;
- immutable evidence manifest;
- strict transport policy tests;
- safe diagnostics for blocked endpoints.

Not yet included:
- stable post-level extraction;
- products;
- comments;
- admin settings;
- statistics;
- private messages;
- official VK API adapter.

Those are separate checkpoints after the first Palleta run proves the local browser path works.
