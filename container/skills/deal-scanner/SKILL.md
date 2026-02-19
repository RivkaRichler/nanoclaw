---
name: deal-scanner
description: >
  Scan clothing store sale/clearance pages for deals matching the group owner's
  style profile. Use when asked to find deals, run a deal scan, or when running
  the scheduled daily deal digest. Also handles one-time style learning from
  a list of photo URLs.
allowed-tools: Bash(agent-browser:*)
---

# Deal Scanner

Finds clothing deals across 100+ stores that match the group owner's curated
style profile, filters by 40 %+ discount, and sends a formatted digest.

---

## Quick Start (Scheduled Daily Scan)

```
/deal-scanner scan
```

This runs the full daily scan workflow (steps below).

---

## Daily Scan Workflow

### 1 · Load config

```bash
cat /workspace/global/deal-scanner/style-profile.json
cat /workspace/global/deal-scanner/stores.json
```

Determine today's tier based on the current day of week:
- Mon / Wed / Fri → scan **tier1_daily** + **tier2_alt_days**
- Tue / Thu / Sat / Sun → scan **tier1_daily** + **tier3_weekly**

### 2 · Scan each store

For each store in today's list:

```bash
agent-browser open <sale_url>
agent-browser wait --load networkidle
agent-browser snapshot -c          # compact snapshot to find product cards
```

Then extract items: name, original price, sale price, product URL.

**Compute discount:**
```
discount_pct = round((original - sale) / original * 100)
```

Skip items where `discount_pct < 40`. If original price is not visible, skip.

### 3 · Filter by style profile

For each qualifying item (≥ 40 % off):

1. **Hard length rule — enforce strictly:**
   - If the item is a dress or skirt, look at the product name, description,
     and any visible photo.
   - REJECT if it appears to be mini length (thigh-high).
   - ACCEPT only if it is clearly above-the-knee (ending near the kneecap) or
     below-the-knee (midi / maxi).
   - When in doubt → REJECT.

2. **Style match (from profile):**
   - Compare silhouette, colors, patterns, and aesthetic keywords against the
     profile. Score as: ✅ strong match · ✓ good match · ~ weak match.
   - Only include items scored ✅ or ✓.

3. **Screenshot (optional, for high-confidence picks):**
   ```bash
   agent-browser screenshot /workspace/group/deals/item-<slug>.png
   ```

### 4 · Format the digest

Use *WhatsApp formatting only* — no markdown:

```
🛍 *Daily Deals — <DATE>*

*<STORE NAME>*
• <Item name>
  Was: $<original>  →  Now: $<sale> (-<pct>%)
  🔗 <url>
  _Why it fits: <1-line reason matching style profile>_

[repeat for each deal]

—
<N> deals found across <M> stores
```

Send in batches of ≤ 10 items per message so WhatsApp doesn't truncate.

### 5 · Send

```
mcp__nanoclaw__send_message(text="<formatted digest>")
```

---

## Style Learning Workflow

Run this once (or when the owner asks to re-learn the style) to populate
`style-profile.json` from their past photos.

### Instructions

You will be given a list of product image URLs (items the owner has shared
in the past). For each URL:

1. Open the page:
   ```bash
   agent-browser open <url>
   agent-browser screenshot /tmp/item.png
   ```

2. Use your vision to analyze:
   - Item type (dress, skirt, top, pants, etc.)
   - Length (for dresses/skirts: mini / above-knee / below-knee / maxi)
   - Silhouette (fitted, A-line, wrap, straight, flowy, etc.)
   - Colors and patterns
   - Fabric/texture (if visible or stated)
   - Aesthetic (classic, romantic, bohemian, minimalist, preppy, etc.)

3. After processing all URLs, synthesize patterns and write the profile:

```bash
cat > /workspace/project/groups/global/deal-scanner/style-profile.json << 'EOF'
{
  "_meta": { "version": 1, "last_updated": "<ISO_DATE>", "photo_count_analyzed": <N> },
  "hard_rules": {
    "skirt_dress_length": {
      "allowed": ["above-knee", "below-knee"],
      "forbidden": ["mini", "micro-mini"],
      "enforcement": "STRICT"
    }
  },
  "silhouettes": { ... },
  "color_palette": { ... },
  "fabrics_and_textures": { ... },
  "aesthetic_keywords": [ ... ],
  "brand_affinity": { ... },
  "price_sensitivity": { "minimum_discount_pct": 40 }
}
EOF
```

> Note: Only the *main* group agent can write to `/workspace/project/groups/global/`.
> Other groups write to `/workspace/global/` which is read-only — so trigger
> style learning from the main group.

---

## Setting Up the Daily Scheduled Task

Ask the main group agent to do this once per clothing group:

```
Schedule a daily deal scan at 8 AM for [group name]:
  schedule_type: cron
  schedule_value: 0 8 * * *
  prompt: "Run /deal-scanner — scan clothing stores for today's deals matching the style profile in /workspace/global/deal-scanner/style-profile.json. Send the digest to the group."
  target_group_jid: <JID>
```

---

## Handling Rate Limits / Bot Detection

Some stores block automated browsing. When a store returns a CAPTCHA or
access-denied page:

1. Skip that store for today — log it.
2. Try again next day — most transient blocks resolve.
3. If blocked for 3+ consecutive days, remove the store from the list and
   note it in `/workspace/group/deal-scanner-notes.md`.

---

## Updating the Photo URL List

The owner can add more photo URLs for style learning at any time:

1. They paste URLs into the main group.
2. Agent appends them to `style-profile.json` → `photo_urls` array.
3. Agent re-runs the style learning workflow on the new URLs only,
   then merges results into the existing profile.
