# TASK - Palleta VK pilot

## Agent

`LP Collector Agent v0.1`

## Fixed target

`https://vk.com/palleta.store`

## Goal

Run one strict READ-ONLY evidence collection pass and return the collector result.

## Only allowed execution

From `local-point-vk-collector`:

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\Run-PalletaPilot.ps1
```

Do not call Node, npm, another PowerShell script or another browser command directly.

## Procedure

1. Run the fixed command above.
2. If manual VK login is requested by the collector, pause for the human.
3. Do not request or handle credentials.
4. After collection, read the newest:
   - `run-summary.json`
   - `blocked-summary.json` when relevant
5. Return the Output Contract from `LP_COLLECTOR_AGENT.md`.
6. Stop.

## Hard limits

- no publication;
- no edits;
- no messages;
- no admin changes;
- no target change;
- no policy relaxation;
- no CAPTCHA bypass;
- no retries that change permissions or transport policy;
- no browser profile export;
- no Git write or deployment.

## Success gate

`run-summary.json.status == "COLLECTED_READ_ONLY"`

## Blocked gate

Any of:

- `run-summary.json.status == "BLOCKED"`
- browser/security block;
- login unavailable;
- collector non-zero exit;
- missing evidence output.

On BLOCKED, return evidence paths and stop.
