# TASK - Palleta VK pilot

## Agent

`LP Collector Agent v0.1`

## Target

`https://vk.com/palleta.store`

## Goal

Run one strict READ-ONLY evidence collection pass and return the collector result.

## Procedure

1. Enter `local-point-vk-collector`.
2. Run:
   `powershell -ExecutionPolicy Bypass -File .\Start-VKCollector.ps1`
3. If manual VK login is required, pause for the human to complete login.
4. Do not request credentials.
5. After collection, read only the newest:
   - `run-summary.json`
   - `blocked-summary.json` if present/relevant
6. Return the Output Contract from `LP_COLLECTOR_AGENT.md`.
7. Stop.

## Hard limits

- no publication;
- no edits;
- no messages;
- no admin changes;
- no policy relaxation;
- no CAPTCHA bypass;
- no retries that change permissions or transport policy;
- no browser profile export.

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
