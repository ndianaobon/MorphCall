# MorphCall — Architecture & Implementation Plan

MorphCall is a web platform for 1-to-1 (later group) video calls, live streaming, social discovery and messaging, with Premium real-time **AI identity** (face) and **AI voice** transformation during calls.

This folder is the design package requested in §27 of the project brief. Stage 1 is built on it; see the roadmap (07) for status.

| # | Document | Covers (brief §27 items) |
|---|----------|--------------------------|
| 00 | [Decisions log](00-decisions.md) | Product-owner decisions D1–D9. **These override the rest of the docs** |
| 01 | [System architecture](01-architecture.md) | Architecture diagram, data flow, stack decisions and trade-offs, deployment, scalability, bottlenecks (1, 2, 10) |
| 02 | [Video rooms & AI media pipeline](02-video-ai-pipeline.md) | Call lifecycle, LiveKit room design, AI face/voice pipeline, latency budget, model evaluation, failure modes (3, 8, 9) |
| 03 | [Database](03-database.md) + [`supabase/migrations`](../supabase/migrations) | ERD, table design, indexes, retention (4) |
| 04 | [API specification](04-api.md) | REST endpoints, realtime events, auth/entitlement/rate limits per route (5) |
| 05 | [Security, entitlements & privacy](05-security-privacy.md) | AuthN/AuthZ, Premium entitlement enforcement, threat model, consent & AI disclosure (6, 7, 11) |
| 06 | [Design system & UX architecture](06-design-system-ux.md) | Tokens from the MorphCall Uizard mockup, IA/navigation, video-call interaction model, state matrix |
| 07 | [MVP scope & roadmap](07-roadmap-mvp.md) | MVP definition, staged plan with exit criteria, risks, open decisions (12) |
| 08 | [Payments & subscriptions](08-payments.md) | Paystack + Stripe behind one interface, internal subscription state machine, webhooks (7) |

## Design inputs

- **Primary visual source:** the MorphCall dashboard mockup in Uizard (dark navy cards, indigo primary, cyan AI labels, pill call controls).
- **Secondary reference:** Dribbble "Called – Video Call App" by Mehmet Özsoy, used for polish ideas only (glass surfaces, chat panel density). We do not copy it.
- **Spec:** the UI/UX design brief (34 sections) and the project brief (28 sections).

## The six technical decisions that shape everything else

1. **Server-side GPU transformation, with the raw feed isolated.** The user's raw camera and mic go to a private *ingest room* that only an AI worker can join. The worker publishes the transformed tracks into the call. The other person never receives the raw feed. See 02 §3.
2. **AI disclosure is enforced by the architecture, not by trusting clients.** Transformed media can only come from a server-minted `ai-worker` participant, and the worker burns a visible marker into every frame. See 05 §6.
3. **Audio goes through the worker whenever the face is transformed.** Otherwise the lips drift out of sync with the voice. See 02 §3.4.
4. **Open-source, license-clean AI with swappable models.** The best-known real-time swap models do not allow commercial use, so the proof of concept targets portrait reenactment, with stylized avatars as the guaranteed fallback. Everything sits behind a model plug-in interface, so better models drop in later. See 02 §5–6.
5. **The platform owns Premium.** Paystack and Stripe are adapters. Only the internal `PREMIUM_ACTIVE` state unlocks AI, and it is checked at every step, including every 10 s during a call. See 08 and 05 §3.
6. **Modular monolith first.** One NestJS codebase with separate deployables (API, realtime gateway, job workers) plus a separate Python AI service. We split into more services only when metrics call for it.
