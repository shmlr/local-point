# VK Palleta Publish Gate v0.1

Status: DRAFT / NOT YET VALIDATED AGAINST LIVE VK

Purpose:
- publish one existing MP4 video to the Palleta VK community;
- keep the existing collector READ-ONLY by default;
- avoid adding broad POST access to browser collection.

Fixed target:
- community: palleta.store
- group_id: 197164485
- owner_id: -197164485

Allowed write operations:
1. `video.save` with:
   - user token only;
   - group_id exactly 197164485;
   - wallpost=false.
2. video upload to the upload URL returned by `video.save`.
3. `wall.post` with:
   - owner_id exactly -197164485;
   - from_group=true;
   - exactly one video attachment owned by group 197164485;
   - one caption rendered deterministically from the approved Palleta Reel template and a verified facts JSON file;
   - deterministic guid derived from the MP4 SHA-256.

Everything else remains blocked.

The publisher cannot:
- publish to another community;
- publish arbitrary or unvalidated text;
- publish photos or multiple attachments;
- edit or delete posts;
- send messages;
- change community settings;
- schedule a post;
- bypass CAPTCHA, 2FA or VK security checks.

Approval:
- write calls require the exact in-process approval token `PALLETTA_VIDEO_ONCE`;
- the Windows runner sets it only when started with `-Execute`;
- without `-Execute`, the runner is dry-run only.

Token:
- reuses the existing VK ID user token stored with Windows DPAPI;
- token is not printed;
- API token is sent in the Authorization header;
- token is not included in the request URL or form body.

Important limitation:
The existing user token has not yet been validated for `video.save` and `wall.post`.
If VK rejects its token type or permissions, status is BLOCKED. Do not broaden permissions automatically and do not retry through another account.

Video:
The selected project asset is:
`Паллета_Reels_мука_Снежана_2_5_10кг.mp4`

The runner requires a local path to that MP4 because the Project Library file cannot currently be materialized directly into the local Windows workspace by this chat session.

Commands:

Dry run:
```powershell
powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoPublish.ps1 -VideoPath "C:\path\to\video.mp4" -FactsPath ".\Palleta_Snezhana_5kg_facts.json"
```

Execute one publication:
```powershell
powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoPublish.ps1 -VideoPath "C:\path\to\video.mp4" -FactsPath ".\Palleta_Snezhana_5kg_facts.json" -Execute
```

Success criteria:
- `PALLETTA_VK_PUBLISH_PREFLIGHT=PASS`
- `PALLETTA_VK_PUBLISH=PASS`
- a returned `POST_ID`
- no other write method executed.

Failure policy:
- fail closed;
- no automatic retry after an unknown external state;
- do not rotate tokens automatically;
- do not relax the target or attachment restrictions.

## Browser fallback using existing local VK profile

Because the existing VK ID token may be incompatible with legacy write methods, there is a second publish path that reuses the already authenticated local browser profile:

`%LOCALAPPDATA%\LocalPoint\vk-profile`

It opens only the Palleta community, confirms group ID evidence from the page, opens Create -> Post, renders the caption only from the approved Palleta template plus verified product facts, uploads exactly one MP4, and clicks exactly one visible publish button. It does not use a new OAuth app or third-party publishing service.

Dry run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoBrowserPublish.ps1 -FactsPath ".\Palleta_Snezhana_5kg_facts.json"
```

Live one-shot publish:

```powershell
powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoBrowserPublish.ps1 -FactsPath ".\Palleta_Snezhana_5kg_facts.json" -Execute
```

The facts file is mandatory for dry-run and live publish. It does not contain advertising copy. For the Snezhana 5 kg Reel it must contain a verified current retail price, stock_confirmed=true, approved evidence sources, and fresh verification timestamps. The caption itself is rendered from the approved Palleta template. Missing, stale or invalid facts -> BLOCKED.

The runner auto-detects `Паллета_Reels_мука_Снежана_2_5_10кг.mp4` in known local project roots. A specific path can still be supplied with `-VideoPath`.

The browser flow is fail-closed:
- no Palleta self-ID evidence -> BLOCKED;
- no unique composer -> BLOCKED;
- no verified facts file -> BLOCKED;
- missing/stale price or stock confirmation -> BLOCKED;
- caption differs from the approved template -> BLOCKED;
- no unique upload input -> BLOCKED;
- no unique enabled publish button -> BLOCKED;
- leaving VK -> BLOCKED.

After submit, the result is reported as `SUBMITTED`, not automatically `CONFIRMED`. A subsequent READ-ONLY audit must verify the post before external state is treated as confirmed.



## Facts gate for Snezhana 5 kg

Current product key: `snezhana_flour_5kg`.

Required facts:
- `price_rub`: current retail price with kopeks;
- `price_type`: exactly `retail` for the current publisher;
- `stock_confirmed`: exactly `true`;
- `price_source`: one of `1C`, `cash_register`, `VK`, `Instagram`, `owner_confirmed`;
- `stock_source`: one of `1C`, `cash_register`, `owner_confirmed`;
- `price_verified_at` and `stock_verified_at`: valid ISO timestamps not older than 24 hours.

The repository example `examples/Palleta_Snezhana_5kg_facts.json` is intentionally blocked by default with null price and stock_confirmed=false.
