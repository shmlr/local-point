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
- browser profile stays under `.local/` and is gitignored;
- collection mode allows only GET / HEAD / OPTIONS;
- POST / PUT / PATCH / DELETE are blocked;
- no messages are opened;
- no publication, edit, delete, reply or settings mutation;
- if VK needs non-read requests to render required evidence, the run returns BLOCKED instead of silently weakening the policy.

This collector records what VK publishes. It does **not** promote platform data to current business truth.

## Dependency

One runtime dependency is used:

`playwright@1.64.1`

See `docs/DEPENDENCY_GATE.md`.

## Windows setup

From this directory:

```powershell
npm install
```

The scripts use installed Google Chrome by default.

If needed, set another Playwright browser channel:

```powershell
$env:VK_BROWSER_CHANNEL="msedge"
```

## 1. Manual login

```powershell
npm run login
```

A browser opens. Sign in to VK yourself.

The script does not read the password or 2FA code.

After successful login, return to the terminal and press Enter.

## 2. READ-ONLY collection

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

## Evidence output

Evidence is written locally to:

`evidence/<timestamp>/`

Files:

- `snapshot.json` - provenance and run status;
- `visible-text.txt` - visible page text;
- `links.json` - discovered public links;
- `blocked-requests.json` - non-read requests blocked by policy;
- `manifest.sha256.json` - hashes for evidence integrity.

The whole `evidence/` directory is gitignored.

## Statuses

- `COLLECTED_READ_ONLY` - usable page evidence was captured.
- `BLOCKED` - login/security/rendering/policy prevented a useful snapshot.

A BLOCKED run is a valid result. Do not bypass CAPTCHA, security checks or the READ-ONLY boundary.

## v0.1 scope

Included:
- public community page snapshot;
- visible text;
- links;
- immutable evidence manifest.

Not yet included:
- stable post-level extraction;
- products;
- comments;
- admin settings;
- statistics;
- private messages;
- official VK API adapter.

Those are separate checkpoints after the first Palleta run proves the local browser path works.
