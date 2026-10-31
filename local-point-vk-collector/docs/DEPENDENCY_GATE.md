# Dependency Gate - Playwright

## Decision

Use one local runtime dependency: `playwright@1.64.1`.

## 1. Necessity

VK is a dynamic authenticated web application. The v0.1 collector needs:
- a persistent local browser profile;
- manual login by the owner;
- controlled navigation;
- explicit interception of non-read network methods;
- deterministic evidence capture.

## 2. Alternative without this dependency

- Manual screenshots/screen recording: rejected as too inconvenient for routine client work.
- Raw Chrome DevTools Protocol implementation: possible, but would add custom protocol code, maintenance risk and more security-sensitive surface.
- VK API-only collector: desirable later, but current runtime scopes/capabilities still require verification and do not cover every cabinet observation.

## 3. Security impact

On Windows:
- VK browser session defaults to `%LOCALAPPDATA%\LocalPoint\vk-profile`.
- Evidence defaults to `%LOCALAPPDATA%\LocalPoint\vk-evidence`.
- Neither default location is inside the Git repository.
- Passwords and OTP are entered only in the browser UI.
- Source code does not request or store passwords or 2FA secrets.
- Audit mode blocks POST/PUT/PATCH/DELETE requests in the first pilot.
- Logged URLs are sanitized to remove credentials, query strings and fragments, except a narrowly recognized VK wall-post reference that is converted to a canonical URL.
- The collector does not open private messages or admin write flows in v0.1.
- If strict READ-ONLY breaks required reads, the run returns BLOCKED. It must not relax policy automatically.

A browser session necessarily contains local cookies/session state. That state remains in the local browser profile and is not committed to Git.

## 4. Consequences of compromise

If the local VK browser profile is copied by an attacker, the attacker may be able to reuse the authenticated VK session until it expires or is revoked.

Mitigations:
- profile is local, not cloud-hosted;
- profile is outside Git;
- use a dedicated Local Point working account with minimum rights when the workflow is validated;
- revoke the VK session/account access to disconnect;
- delete the local profile when no longer needed.

## 5. Cost

- No SaaS subscription.
- No cloud browser.
- No API key.
- No recurring external cost.

## 6. Removal / disconnect path

To disable the collector:
1. revoke the relevant VK session or remove the working account's access in VK;
2. close browsers using the collector profile;
3. delete `%LOCALAPPDATA%\LocalPoint\vk-profile`;
4. delete `local-point-vk-collector/` if the code is no longer required.

No production site file depends on it.

## 7. Revisit condition

Revisit when current official VK API documentation/scopes are verified and an API adapter can replace some browser observations with narrower, more stable read-only access.
