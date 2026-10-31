# Palleta VK blocked POST review - 2026-10-29

## Run

Status: COLLECTED_READ_ONLY

Observed at: 2026-10-29T14:48:11.539Z

Visible text chars: 1147

Links: 43

Blocked POST requests: 71

Blocked endpoint groups: 21

Policy relaxed: false

## Decision

Do not allow broad browser POST.

## Classification

### BLOCK - internal or undocumented VK web transport

- vk.ru/al_groups.php
- web.api.vk.ru/method/batch.call
- vk.ru/wkview.php
- web.api.vk.ru/method/groups.getContentForTabs
- web.api.vk.ru/method/owners.getContentTabs
- vk.ru/al_index.php

Reason: internal or undocumented web endpoints are not accepted as a stable Local Point integration contract.

### BLOCK - account/session/messaging not required for audit

- web.api.vk.ru/method/account.getHelpHints
- web.api.vk.ru/method/account.getInfo
- web.api.vk.ru/method/account.getProfileNavigationInfo
- login.vk.ru/
- web.api.vk.ru/method/queue.subscribe
- web.api.vk.ru/method/account.getTogglesExternal
- vk.ru/notifier.php
- web.api.vk.ru/method/messages.getConfig

Reason: not needed to read Palleta business profile, wall, addresses or products.

### BLOCK - telemetry / crash / advertising

- stacks.vk-portal.net/api/25/envelope
- akashi.vk-portal.net/api/v1/web
- sdk-api.apptracer.ru/api/crash/trackSession
- stats.vk-portal.net/web-stats/p
- yandex.ru/an/count/*

Reason: telemetry is not audit evidence.

### CONFIRMED READ-ONLY METHOD, but do not open browser POST

- web.api.vk.ru/method/utils.resolveScreenName

Official VK API schema v5.199 confirms utils.resolveScreenName as a read method.

Decision: call it only through the official api.vk.com adapter, not by allowing the browser internal POST.

## Replacement path

Use official VK API allowlist:

- utils.resolveScreenName
- groups.getById
- groups.getAddresses
- wall.get
- wall.getComments
- market.get with user token only

Browser remains a visual evidence source with strict transport blocking.
