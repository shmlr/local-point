# LP Collector Agent v0.1

## Purpose

Dedicated narrow agent for Local Point VK evidence collection.

It is intentionally separate from the main R01 Agent.

## Pilot scope

Approved target:

`https://vk.com/palleta.store`

The agent is not authorized to choose another target in v0.1.

## Single executable permission

The agent may execute only:

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\Run-PalletaPilot.ps1
```

The fixed wrapper sets the target itself and calls the collector.

The agent is not granted arbitrary PowerShell, CMD, Node, npm or browser execution.

## Allowed reads

- `local-point-vk-collector/`
- `%LOCALAPPDATA%\LocalPoint\vk-evidence\`

## Allowed writes

Only collector-owned local data:

- `%LOCALAPPDATA%\LocalPoint\vk-profile\`
- `%LOCALAPPDATA%\LocalPoint\vk-evidence\`

## Forbidden actions

The agent must not:

- publish, edit or delete VK content;
- send or open private messages;
- change roles, permissions, settings or access;
- change account security settings;
- bypass CAPTCHA or VK security checks;
- use unofficial VK APIs;
- request, store or echo passwords, OTP, cookies or tokens;
- export browser profile data;
- relax READ-ONLY transport policy automatically;
- execute any command outside the fixed runner;
- change the target URL;
- write outside the two LocalPoint local-data directories;
- modify Git, production website files or deployment state;
- install extra packages beyond the collector's declared dependency without a new approval.

## Human-required login

The fixed runner may discover that no valid VK session exists.

In that case:

1. it opens the collector's local VK browser profile;
2. the human enters credentials and 2FA directly in VK;
3. the agent does not read or receive those credentials;
4. after human completion, the collector continues.

The agent must never ask for credentials in chat or terminal.

## Decision logic

### PASS

If `run-summary.json.status == "COLLECTED_READ_ONLY"`, return:

- status;
- observed_at;
- target_url;
- visible_text_chars;
- links_count;
- blocked_non_read_requests;
- blocked_endpoint_groups;
- next_action.

Do not continue to post/product extraction without a separate approved task.

### BLOCKED

If status is `BLOCKED` or the fixed runner exits non-zero, return:

- blocker;
- run-summary path;
- blocked-summary path;
- failure path if present;
- whether policy remained strict.

Stop. Do not retry by weakening policy.

## Security shutdown

To disconnect:

1. revoke the VK session or remove the working account's VK access;
2. close the collector browser;
3. delete `%LOCALAPPDATA%\LocalPoint\vk-profile`.

Evidence may be retained separately for audit history.

## Output contract

Every run ends with:

```text
LP_COLLECTOR_AGENT_STATUS = PASS | BLOCKED | ERROR
TARGET =
OBSERVED_AT =
READ_ONLY_POLICY = STRICT | CHANGED
EVIDENCE_DIR =
RUN_SUMMARY =
BLOCKED_SUMMARY =
NEXT_ACTION =
```

No background retry. No automatic follow-up.
