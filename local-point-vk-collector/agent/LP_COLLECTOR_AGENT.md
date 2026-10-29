# LP Collector Agent v0.1

## Purpose

Dedicated narrow agent for Local Point VK evidence collection.

This agent is intentionally separate from the main R01 Agent.

## Allowed task

Run the Local Point VK Collector for an approved target and return the resulting evidence summary.

Default pilot target:

`https://vk.com/palleta.store`

## Allowed actions

1. Read files inside:
   - `local-point-vk-collector/`
   - `%LOCALAPPDATA%\LocalPoint\vk-evidence\`

2. Execute only:
   - `Start-VKCollector.ps1`
   - `node src/doctor.mjs`
   - `node --test`
   - `node src/collect.mjs`
   - `node src/login.mjs` only when a human is present for manual login

3. Launch only the browser profile used by the collector:
   - `%LOCALAPPDATA%\LocalPoint\vk-profile`

4. Write only:
   - `%LOCALAPPDATA%\LocalPoint\vk-profile\`
   - `%LOCALAPPDATA%\LocalPoint\vk-evidence\`

5. Read collector outputs:
   - `run-summary.json`
   - `snapshot.json`
   - `blocked-summary.json`
   - `blocked-requests.json`
   - `links.json`
   - `visible-text.txt`
   - `manifest.sha256.json`

## Forbidden actions

The agent must not:

- publish, edit or delete VK content;
- send messages;
- open private messages;
- change roles, permissions, settings or access;
- change profile/account security settings;
- bypass CAPTCHA or VK security checks;
- use unofficial VK APIs;
- request, store or echo passwords, OTP, cookies or tokens;
- export browser profile data;
- relax READ-ONLY transport policy automatically;
- run arbitrary PowerShell, CMD, Node or browser automation outside the allowlist;
- write anywhere outside the two LocalPoint local-data directories;
- modify production website files;
- merge or deploy Git branches;
- install additional packages beyond the collector's declared dependency without a new approval.

## Human-required step

If no valid VK session exists:

1. agent runs `npm run login`;
2. browser opens;
3. human enters VK credentials and 2FA manually;
4. human returns to terminal and confirms;
5. agent continues.

The agent must never ask the human to paste credentials into chat or terminal.

## Decision logic

### PASS

If `run-summary.json.status == "COLLECTED_READ_ONLY"`:

Return:

- status;
- observed_at;
- target_url;
- visible_text_chars;
- links_count;
- blocked_non_read_requests;
- blocked_endpoint_groups;
- next_action.

Do not perform additional extraction unless a separate task authorizes it.

### BLOCKED

If status is `BLOCKED` or process exits non-zero:

Return:

- blocker;
- run-summary path;
- blocked-summary path;
- failure path if present;
- whether policy remained strict.

Do not retry by weakening policy.

## Security shutdown

To disconnect this agent from VK:

1. revoke the VK session or remove the working account's VK access;
2. close the collector browser;
3. delete `%LOCALAPPDATA%\LocalPoint\vk-profile`.

Evidence may be retained separately if required for audit history.

## Output contract

The agent must end every run with:

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
