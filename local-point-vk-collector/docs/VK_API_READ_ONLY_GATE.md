# VK API READ-ONLY Gate v0.2

## Browser POST review

The first Palleta browser run completed with COLLECTED_READ_ONLY while 71 POST requests across 21 endpoint groups were blocked.

Decision: do not add broad browser POST permission.

Keep blocked:
- internal / undocumented VK web calls: al_groups.php, wkview.php, batch.call, groups.getContentForTabs, owners.getContentTabs, al_index.php;
- account/session/messaging calls: login.vk.ru, account.*, messages.getConfig, queue.subscribe, notifier.php;
- telemetry/crash/advertising calls: stacks.vk-portal.net, akashi.vk-portal.net, sdk-api.apptracer.ru, stats.vk-portal.net and Yandex counter POSTs.

## Official schema confirmation

The official VKCOM/vk-api-schema schema v5.199 confirms:
- utils.resolveScreenName: user, group, service token;
- groups.getById: user, group, service token;
- groups.getAddresses: user, service token;
- wall.get: user, service token;
- wall.getComments: user, service token;
- market.get: user token only.

## Architecture

Browser collector:
- visual/public-page evidence;
- all non-read transport requests remain blocked.

Official API collector:
- exact method-name allowlist;
- exact token-type allowlist;
- semantic read-only policy;
- no undocumented API methods.

## Token handling

- VK_SERVICE_TOKEN is optional until the API collector is intentionally enabled;
- VK_USER_TOKEN is optional and is only required for market.get;
- tokens are supplied through environment variables only;
- tokens are never committed to Git;
- tokens are never printed;
- API URLs do not include tokens;
- access tokens are sent only in the Authorization: Bearer header to api.vk.ru.

## Status behavior

If VK_SERVICE_TOKEN is missing, api:collect returns SOURCE_DATA_REQUIRED.

If the service token is present but VK_USER_TOKEN is missing, profile, addresses and wall can be collected while market items remain SOURCE_DATA_REQUIRED.

No fallback reads browser cookies or exports session credentials.

## Security rule

HTTP POST alone is not classified as a business write.
For this API adapter, safety requires all of:
1. official api.vk.ru endpoint;
2. exact allowlisted VK API method;
3. method semantics confirmed in official VK schema;
4. compatible allowlisted token type;
5. no unknown method fallback.
