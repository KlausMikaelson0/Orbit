# Orbit — The Evolution of Communication

Orbit is a realtime productivity-social platform built in phases:
- **Phase 1**: Cosmic UI foundation + auth shell
- **Phase 2**: Supabase schema + realtime servers/channels/messages
- **Phase 3**: Media uploads + LiveKit voice/video + moderation controls
- **Phase 4**: Social engine (DMs, friends, command palette, notifications, privacy mode)
- **Phase 5**: Theme engine, Orbit-Bot commands/moderation, channel tasks, threaded replies, PWA readiness
- **Phase 6**: Mobile gestures, developer webhook API, onboarding + analytics, security hardening
- **Phase 7**: Orbit Pulse subscriptions, Starbits wallet economy, Orbit Vault cosmetics store
- **Phase 8**: Orbit Missions quest engine for sponsored engagement revenue
- **Phase 9**: Orbit Labs supercharge (forum channels, templates, permissions, events, marketplace, creator tools, season pass)

## Stack

- Next.js 16 (App Router + TypeScript)
- Tailwind CSS + shadcn-style primitives
- Zustand
- Supabase (Auth, Postgres, Realtime, Storage)
- LiveKit
- Cmdk
- Framer Motion + Lucide

## Feature highlights

### Core
- Multi-sidebar Discord-style dashboard
- Invite-based servers and channels
- Realtime chat + optimistic message delivery
- Attachment support (images + PDFs)
- Voice/video channels via LiveKit

### Social
- DM home + private threads
- Friends (All / Pending / Add by `username#tag`)
- Presence indicators
- Global command palette (`Ctrl/Cmd + K`)

### Power user (Phase 5)
- **Theme engine**: Midnight, Onyx, Cyberpunk, Custom CSS
- **Orbit-Bot slash commands** in channels:
  - `/summarize` (last 24h summary)
  - `/clear [count]`
  - `/poll question | option 1 | option 2`
- **Sentiment-based moderation flags** for toxic message patterns
- **Channel tasks tab** (realtime task board per channel)
- **Threaded replies** for cleaner conversations
- **PWA support** (installable manifest + service worker registration)
- **Skeleton loaders** for smoother loading states

### Growth & Ecosystem (Phase 6)
- **Swipe-to-close** for mobile sidebars + dialogs
- **Orbit Developer API** for webhook-based bot messaging
- **Welcome tutorial** onboarding flow for new users
- **Global analytics dashboard** for server owners (Edge Function + client fallback)
- **2FA support** with Supabase MFA (TOTP enroll / verify / unenroll)
- **Rate limiting** for AI + webhook APIs and client send pacing
- **Image moderation mock** for uploads and webhook attachments
- **PWA icon pack** for iOS/Android install experience
- **Electron desktop runtime** (system tray, frameless shell, unified web/desktop UX)

### Monetization Foundation (Phase 7)
- **Orbit Pulse plans**: Free / Pulse / Pulse+ membership model
- **Starbits wallet** with daily claim loop and transaction history
- **Orbit Vault store** with purchasable cosmetic inventory
- **Background cosmetics** users can buy, own, and equip per profile

### Creator Payouts (Phase 10)
- **Payout destination setup** per creator profile (bank/card/wallet target)
- **Withdrawal requests** from Starbits balance with request lifecycle tracking
- **Cancelable pending requests** with automatic Starbits refund
- **Wallet ledger entries** for payout request/cancel events

### Quest Monetization (Phase 8)
- **Orbit Missions**: repeatable quests for visit/watch/play/social actions
- **Sponsored mission fields** (`sponsor_name`, `sponsor_url`) for ad-backed campaigns
- **Quest action events** to track engagement and feed ad/revenue analytics
- **Quest reward claiming** that pays out Starbits into user wallets

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Why you see "Supabase setup required"

If Orbit shows:

> Supabase setup required  
> Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY...

that means the deployment environment is missing Supabase variables.

### Fix on Vercel
In Vercel Project Settings -> Environment Variables, add at least:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Recommended full set for complete Orbit features:
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GIPHY_API_KEY`

Then redeploy the project.

## Desktop development (Electron)

Run Orbit web + Electron shell together:

```bash
npm run electron-dev
```

Desktop static export bundle (for Electron packaging):

```bash
npm run desktop-export
```

Build installables via electron-builder:

```bash
npm run electron-build
```

This generates artifacts in `release/` (e.g. NSIS `.exe`, macOS `.dmg`).

## Desktop downloads for all devices (Windows + macOS + Linux)

Orbit now includes a GitHub Actions workflow:

- `.github/workflows/desktop-multi-platform.yml`

How to use:
1. Push your code to GitHub.
2. Open **Actions** tab.
3. Run **Desktop Multi-Platform Builds** (or push a tag like `v1.0.0`).
4. Download artifacts:
   - `orbit-desktop-windows-latest` -> `.exe` (NSIS)
   - `orbit-desktop-macos-latest` -> `.dmg`
   - `orbit-desktop-ubuntu-latest` -> `.AppImage`

This is the reliable way to get installers for all devices, not just one OS.

## Environment variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (e.g. `https://your-app.vercel.app`)
- `SUPABASE_SERVICE_ROLE_KEY` (required for developer API + edge analytics)
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GIPHY_API_KEY` (for GIF picker search)

Optional but recommended for stable OAuth redirects:
- `NEXT_PUBLIC_AUTH_REDIRECT_URL` (explicit OAuth base URL, e.g. `https://your-app.vercel.app`)

Optional AI provider keys (Orbit-Bot summarize endpoint):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Incoming call ringtone source:
- replace `ORBIT_RINGTONE_URL` in `src/lib/orbit-notifications.ts` with your own Heavenly ringtone URL (for example `Heavenly.mp3`).

## Supabase setup

Run migrations in order from `supabase/migrations/`:

1. `20260219_orbit_phase2.sql`
2. `20260219_orbit_phase3_media_voice.sql`
3. `20260219_orbit_phase4_social.sql`
4. `20260219_orbit_phase5_power_user.sql`
5. `20260219_orbit_phase6_growth.sql`
6. `20260220_orbit_phase7_monetization.sql`
7. `20260220_orbit_phase8_quests.sql`
8. `20260220_orbit_phase9_supercharge.sql`
9. `20260221_orbit_phase10_creator_payouts.sql`
10. `20260222_orbit_phase11_media_assets.sql`
11. `20260222_orbit_phase12_soundboard.sql`
12. `20260223_orbit_phase13_server_lift.sql`
13. `20260223_orbit_phase14_channel_settings.sql`

Phase 5 adds:
- `orbit_bots` (per-server bot metadata)
- `channel_tasks` (per-channel task board)
- `message_flags` (moderation signals)
- `messages.thread_parent_id` (threaded replies)

Phase 6 adds:
- `server_webhooks` (bot/webhook integration records)

Phase 7 adds:
- `profile_subscriptions` (membership tier + status)
- `profile_wallets` and `profile_wallet_transactions` (Starbits economy ledger)
- `orbit_store_items` and `profile_store_inventory` (store catalog + owned cosmetics)
- profile background personalization columns on `profiles`
- RPCs: `claim_daily_starbits`, `buy_store_item`, `set_active_store_background`

Phase 8 adds:
- `orbit_quests`, `profile_quest_progress`, `orbit_quest_action_events`
- RPCs: `orbit_log_quest_action`, `orbit_claim_quest_reward`
- seeded mission templates for visit, watch, play, and social quest loops

Phase 9 adds:
- Forum channels (`channel_type = FORUM`) + `forum_tags`, `forum_posts`, `forum_replies`
- Server templates, channel permission matrix, stage/live events, call clips
- AI server settings, app marketplace install model, creator tiers and tipping
- Season pass + achievements + leaderboard progression RPCs
- Profile performance mode switch for lower-end devices

Phase 10 adds:
- `creator_payout_accounts` and `creator_payout_requests`
- RPCs: `orbit_upsert_payout_account`, `orbit_request_payout`, `orbit_cancel_payout_request`
- Creator withdrawal workflow with wallet-safe debit/refund ledger events

Phase 11 adds:
- `server_media_assets` (server-owned custom GIF and sticker library)
- RLS policies so only server members can view and only server staff can manage
- Orbit official sticker pack in `public/stickers/*`

Phase 12 adds:
- `server_soundboard_items` for custom server call sounds
- RLS policies so server staff can manage items and members can use them
- Realtime pub/sub support for in-call soundboard sync

Phase 13 adds:
- `servers.description` for editable server profile text
- `server_orbit_lifts` for the Orbit Lift system (Server Boost equivalent)
- owner/staff server hub management flow (invite, profile settings, lift level)

Phase 14 adds:
- Channel settings fields (`channels.topic`, `slowmode_seconds`, `is_age_restricted`, `hide_after_days`)
- Discord-style channel settings modal with public/private visibility controls
- Per-role channel visibility enforcement for owner/admin/moderator-managed private channels

Also make sure Supabase Auth providers include:
- Email/Password
- Google OAuth

Callback URL:
- `https://your-app-domain/auth/callback`
- for Vercel previews, add your preview domain callback too (or use a wildcard pattern supported by Supabase).

## LiveKit setup

`/api/livekit/token` issues room tokens server-side.  
Room names are derived from server/channel IDs.

## PWA

Orbit ships with:
- `app/manifest.ts`
- `public/sw.js`
- `public/orbit-icon-192.png`
- `public/orbit-icon-512.png`
- `public/apple-touch-icon.png`
- runtime registration via `OrbitPwaRegister`

Users can install Orbit from supported browsers (desktop + mobile).

## Hybrid platform notes

- Electron entrypoint: `main.js`
- Desktop bridge: `preload.js`
- Next desktop export mode is controlled by `ORBIT_DESKTOP_EXPORT=1` in `next.config.mjs`
- Supabase browser client is configured to persist sessions in `localStorage`

## Orbit Developer API (Webhook Bots)

### Create a webhook (staff only)
`POST /api/developer/webhooks` with bearer auth token

```json
{
  "channelId": "CHANNEL_UUID",
  "name": "CI Bot"
}
```

Response includes:
- `endpoint`: `/api/developer/webhooks/{webhookId}/{webhookSecret}`
- `webhookSecret`: only returned once

### Send message as webhook
`POST /api/developer/webhooks/{webhookId}/{webhookSecret}`

```json
{
  "content": "Build passed on main branch",
  "username": "Pipeline Bot"
}
```

Optional:
- `fileUrl` for attachments (subject to moderation checks)

### Revoke webhook
`DELETE /api/developer/webhooks/{webhookId}` with bearer auth token

## Supabase Edge Function

Analytics function source:
- `supabase/functions/orbit-analytics/index.ts`

Deploy with Supabase CLI:

```bash
supabase functions deploy orbit-analytics
```

## 2FA Setup Notes

- Orbit Settings includes TOTP management built on Supabase MFA.
- Ensure MFA is enabled in your Supabase Auth settings.
- Users can enroll, verify, and remove authenticator factors directly in app.

## Deployment (Vercel)

### Manual
1. Create a Vercel project and connect this repo.
2. Add all required environment variables in Vercel Project Settings.
3. Deploy:

```bash
npm run lint
npm run build
vercel --prod
```

### Scripted
Use the included deployment helper:

```bash
./scripts/deploy-vercel.sh
```

This runs lint/build before `vercel --prod`.

## Final Go-Live Checklist (Vercel)

- [ ] All migrations applied through Phase 7
- [ ] All migrations applied through Phase 8
- [ ] All migrations applied through Phase 9
- [ ] All migrations applied through Phase 10
- [ ] All migrations applied through Phase 11
- [ ] All migrations applied through Phase 12
- [ ] All migrations applied through Phase 13
- [ ] All migrations applied through Phase 14
- [ ] Supabase Auth providers configured (Email/Password + Google + MFA)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` added in Vercel
- [ ] LiveKit keys configured and `/api/livekit/token` verified
- [ ] Edge Function `orbit-analytics` deployed
- [ ] Webhook endpoint tested with a sample bot payload
- [ ] `npm run lint` and `npm run build` both pass on main branch
- [ ] PWA install verified on iOS Safari + Android Chrome
- [ ] Browser notifications permission flow validated
- [ ] Privacy mode, rate limits, and moderation checks smoke-tested

## Google Search visibility checklist

If you want Orbit to appear like a product page in Google (open page + download or continue in browser):

1. Deploy publicly (no authentication wall on the whole site).
2. Set `NEXT_PUBLIC_APP_URL` to your production domain.
3. Verify:
   - `https://your-domain/robots.txt`
   - `https://your-domain/sitemap.xml`
4. Submit the domain and sitemap to Google Search Console.
5. Wait for indexing/crawl refresh (can take from minutes to days).
