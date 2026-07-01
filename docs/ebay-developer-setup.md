# eBay Developer Setup — start this now (it's the long pole)

We won't call eBay's API until Phase 5, but **getting approved takes time**, so
begin the application today. This guide gets you from zero to production API keys.

> Verify exact screens/terms as you go — eBay changes its developer portal
> periodically. The flow below is the stable shape of it.

---

## What we need from eBay, and why

| Capability | eBay API | When | Free? |
|---|---|---|---|
| Read active listing prices (free comps) | **Browse API** | Phase 3 | Yes (rate-limited) |
| Create/manage listings automatically | **Sell: Inventory + Offer API** | Phase 5 | Yes |
| Track listing performance (views/watchers/sold) | **Sell: Analytics / Marketing** | Phase 5 | Yes |
| Real *sold* comp prices | **Marketplace Insights API** | Upgrade | Gated — separate approval |

The first three come with a normal production keyset. **Marketplace Insights**
(actual sold/completed prices) requires a separate access request and business
justification — that's the one to apply for early.

---

## Step 1 — Create an eBay developer account

1. Go to <https://developer.ebay.com>.
2. Sign in with your existing eBay account (the one tied to your store).
3. Register/join the eBay Developers Program and accept the API License Agreement.

## Step 2 — Create an application keyset

1. In the developer portal, open **My Account → Application Keysets**.
2. You'll see two environments:
   - **Sandbox** — fake data for testing. We'll build against this first.
   - **Production** — your real store. Used when we go live.
3. Create/note both keysets. Each gives you:
   - **App ID (Client ID)**
   - **Cert ID (Client Secret)**
   - **Dev ID**

## Step 3 — Set up OAuth (user consent)

Listing on *your* store requires user-authorized OAuth (not just app tokens).

1. In the keyset, configure a **Redirect URI** (eBay calls it an "RuName").
   - For local dev this can point to a placeholder we control; we'll finalize the
     real redirect when the app is hosted.
2. We'll need these scopes later (note them, don't worry about wiring yet):
   - `https://api.ebay.com/oauth/api_scope/sell.inventory`
   - `https://api.ebay.com/oauth/api_scope/sell.marketing`
   - `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`
   - `https://api.ebay.com/oauth/api_scope/buy.browse` (or Buy API access)

## Step 4 — Request Marketplace Insights access (the gated one)

1. Look for **Buy APIs → Marketplace Insights** in the portal, or the "Request
   access" / application form for restricted Buy APIs.
2. Submit the business-use justification. Plain and true works:
   *"I run an eBay store selling my personal comic book collection. I'm building
   an internal tool to price items accurately using recent sold-listing data
   before I list them."*
3. Approval is not instant — this is why we start now and build Phase 3 on the
   free Browse API in the meantime.

## Step 5 — Confirm store/account basics

- Make sure your selling account is in good standing and enrolled in eBay
  **managed payments** (required to sell and to use the Sell APIs).
- Note your **eBay marketplace** (e.g. `EBAY_US`) — the APIs are marketplace-scoped.

## Step 6 — Hand the credentials to the app (later)

When keys are issued, they go in `backend/.env` (never commit them):

```
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_REDIRECT_URI=...        # the RuName
EBAY_ENV=sandbox            # switch to "production" when ready
```

`.env` is already gitignored.

---

## Checklist

- [ ] Developer account created + API License accepted
- [ ] Sandbox keyset created
- [ ] Production keyset created
- [ ] Redirect URI / RuName configured
- [ ] Marketplace Insights access **requested** (gated — do this first)
- [ ] Selling account on managed payments, in good standing

Once Marketplace Insights is approved and Phase 4 is done, Phase 5 wiring is
straightforward.
