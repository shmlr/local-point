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

- The VK browser session exists only in `.local/vk-profile/`.
- That directory is gitignored.
- Passwords, OTP, cookies and tokens are never written to source files.
- Audit mode blocks POST/PUT/PATCH/DELETE requests.
- The collector does not open private messages or admin write flows in v0.1.
- If strict READ-ONLY breaks required reads, the run returns BLOCKED. It must not relax policy automatically.

## 4. Cost

- No SaaS subscription.
- No cloud browser.
- No API key.
- No recurring external cost.

## 5. Removal path

Delete `local-point-vk-collector/` or remove the Playwright dependency. No production site file depends on it.

## 6. Revisit condition

Revisit when current official VK API documentation/scopes are verified and an API adapter can replace some browser observations with narrower, more stable read-only access.
