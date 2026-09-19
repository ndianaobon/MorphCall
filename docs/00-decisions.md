# 00 — Product Decisions Log

Decisions made by the product owner. They override anything else in these docs. Newest first.

## 2026-09-19 — Round 2

| # | Topic | Decision | Consequences in the design |
|---|-------|----------|----------------------------|
| D8 | Cancellation | **Cancelling Premium ends access immediately. No refund** for the unused part of the billing period | Cancel = stop the provider subscription now + `PREMIUM_CANCELLED` at once (08 §4). There is no "cancels on <date>" state, and `/subscriptions/resume` is removed (the user subscribes again instead). Cancellation from **any** channel (our app, Stripe portal, Paystack manage link) is treated the same way. The cancel dialog must state clearly that access ends now and no refund is given. The no-refund terms must be shown at checkout and in the ToS. The per-market consumer-law review must confirm this is allowed where we launch (05 §9) |
| D9 | Locked identities & voices | After Premium ends, stored identities (and custom voices) are kept locked for **30 days**, with an **email warning at day 20**, then **purged** | `ai-data-retention` job (03 §5). Re-subscribing before day 30 unlocks everything. The user can delete earlier at any time |

## 2026-09-18 — Round 1

| # | Topic | Decision | Consequences in the design |
|---|-------|----------|----------------------------|
| D1 | Company & payments | Company registered in **Nigeria**. Support **both Paystack and Stripe** from the start, behind a provider abstraction. Provider availability, business-category eligibility, recurring support and compliance are **verified during implementation** | New [08 Payments](08-payments.md). `plans` split into `plans` + `plan_prices` (per provider × currency). Internal subscription state is provider-independent |
| D2 | Markets | Nigeria is the operating base, but the product is **global from day one**. The launch strategy is decided separately. A privacy, data-protection, biometric and AI-regulatory review is needed **per market actually launched**. Nigerian compliance is not assumed to cover anyone else | `users.data_region` + region-aware storage and AI processing (01 §7). Per-country feature availability flags (`country_feature_flags`). Compliance checklist per market (05 §9) |
| D3 | AI technology budget | **No paid commercial face/voice SDK for now.** Prototype with open-source / self-hostable / commercially usable tech (Python, FastAPI, PyTorch, ONNX Runtime, OpenCV, MediaPipe, CUDA), nothing assumed suitable without testing. **The first goal is a working real-time proof of concept.** A high-quality **stylized** release is acceptable if photoreal isn't efficient enough at launch. Models must be **swappable without rebuilding the app** | 02 §5 re-scoped to license-clean candidates only, with portrait reenactment as the primary track. Model plug-in interface + model registry (02 §6). Original identity images are kept encrypted so identities can be re-processed when the model changes |
| D4 | Identity images | Users may upload **any image of their choice** (not only their own face). The product must **never present the transformed person as genuinely being the person in the image**. Required: upload validation, size/format limits, abuse reporting, blocking, moderation where appropriate, deletion, terms and rights language, audit | 05 §7 rewritten: rights attestation, not a self-only rule. Disclosure stays mandatory and architecture-enforced. Hard safety blocks only for clearly unlawful content (e.g. images of minors, sexual content) |
| D5 | Voice | Premium-only. Custom/permitted voices, a personal library, preview, select, switch mid-call, return to natural voice. Priorities: very low latency, natural conversation, intelligibility, stable audio. The engine must be replaceable | The free tier no longer gets DSP voice presets. **All voice transformation is Premium** |
| D6 | Premium rule | **Only the backend decides Premium.** Internal states `FREE`, `PREMIUM_ACTIVE`, `PREMIUM_PAST_DUE`, `PREMIUM_CANCELLED`, `PREMIUM_EXPIRED`. **Only `PREMIUM_ACTIVE` may use AI identity or voice processing.** When Premium ends, access is lost immediately. Stored identities may remain (per retention policy) but cannot be used | The past-due grace period and the mid-call "finish your call" grace are **removed**. Revocation takes effect at the next worker heartbeat (≤10 s). Upload, manage, select and apply all require `PREMIUM_ACTIVE`. Only **delete / view / export** stay available to non-Premium users (data-protection rights) |
| D7 | Free-user UX | AI Identity stays **visible but locked** for free users, with an upgrade prompt: *"AI Identity is a Premium Feature — Transform your appearance in real time during video calls using your saved AI identities." [Upgrade to Premium]* | `UpgradeGate` copy fixed in 06. A `premium_required` error from any AI endpoint opens this sheet |

### Interpretations (resolved in Round 2)

- ~~"Cancelled" vs paid-up time (proposed: keep access until period end)~~ → **D8: access ends immediately, no refund.**
- ~~Stored identities after Premium ends (proposed: 90 days / warning at day 60)~~ → **D9: 30 days / warning at day 20.**
