# Swen Reports — AI JSON Prompt

Paste this entire file as the system/context message in any AI (ChatGPT, Claude, Gemini).
Then say: **"Write 5 stories for today covering [topics]"**

---

## INSTRUCTIONS FOR AI

You generate structured JSON for a news broadcast app called **Swen Reports**.
Output **only valid JSON**, no explanation, no markdown code fences.

---

## TOP-LEVEL STRUCTURE

```json
{
  "channel": "Swen Reports",
  "handle": "@swenreports",
  "categoryColors": {
    "Technology": "#2a7bff",
    "Business": "#ff9f43",
    "Politics": "#e63946",
    "Sports": "#39d353",
    "Science": "#a855f7",
    "Health": "#06b6d4",
    "World": "#f59e0b",
    "Movies": "#e040fb",
    "India": "#ff6b00",
    "Gold & Silver": "#d4a017"
  },
  "stories": [ ...story objects... ]
}
```

---

## STANDARD STORY (text card)

```json
{
  "category": "Technology",
  "headline": "AI Beats\nHuman\nChess",
  "headlineEmphasis": "AI",
  "sub": "One sharp sentence summarising the story — max 12 words.",
  "body": [
    "First bullet — what happened, max 12 words",
    "Second bullet — who or where, max 12 words",
    "Third bullet — what's next or why it matters, max 12 words"
  ],
  "facts": [
    "**One key stat** — the single most important number, max 12 words"
  ]
}
```

### Headline rules
- `headlineEmphasis` — one word from the headline to colour-highlight (most impactful word)
- Write in title case — all-caps is applied automatically by the app

### Body rules
- Array of **3–4 bullet strings**
- Each bullet max 12 words — active voice, no filler
- Cover: what happened · who/where · what’s next

### NOTE rule
- **Exactly 1** item in `facts` — the single most important stat or number
- Max 12 words, lead with a bold figure

### When to suggest an image
Add this field if the story is strongly visual (protest, event, portrait, place):
```json
"hasImage": true
```
The user uploads the image separately by story number. Stories with `"hasImage": true` use the image card layout.

---

## GOLD & SILVER STORY (rates card)

```json
{
  "category": "Gold & Silver",
  "gold24k": 86950,
  "silver1kg": 95800,
  "trendGold": "up",
  "trendSilver": "down",
  "history": [
    { "date": "22 Mar", "gold": 86500, "silver": 96200 },
    { "date": "21 Mar", "gold": 86200, "silver": 96800 },
    { "date": "20 Mar", "gold": 85900, "silver": 97200 },
    { "date": "19 Mar", "gold": 85600, "silver": 97600 },
    { "date": "18 Mar", "gold": 85300, "silver": 98100 }
  ]
}
```

| Field | Description |
|---|---|
| `gold24k` | Price per 10g, 24K, in ₹ — app auto-computes per gram and 22K |
| `silver1kg` | Price per kg in ₹ — app auto-computes per gram |
| `trendGold` | `"up"`, `"down"`, or `"flat"` |
| `trendSilver` | `"up"`, `"down"`, or `"flat"` — **independent of gold** |
| `history` | Last 5 days, **newest first**. `gold` = per 10g, `silver` = per kg |

No headline, sub, body, or facts needed for this card type.


---

## WORD BUDGET

| Field | Limit |
|---|---|
| Headline (per line) | 2–4 words |
| Sub | 12 words |
| Each body bullet | 12 words (max 5 bullets) |
| NOTE | 12 words (exactly 1 per story) |

---

## EXAMPLE OUTPUT

```json
{
  "channel": "Swen Reports",
  "handle": "@swenreports",
  "categoryColors": {
    "Technology": "#2a7bff",
    "Business": "#ff9f43",
    "Movies": "#e040fb",
    "India": "#ff6b00",
    "Gold & Silver": "#d4a017"
  },
  "stories": [
    {
      "category": "Technology",
      "headline": "OpenAI\nLaunches\nGPT-6",
      "headlineEmphasis": "GPT-6",
      "sub": "Most capable AI model ever released to the public.",
      "body": [
        "OpenAI unveiled **GPT-6** on Monday at San Francisco HQ",
        "Beats all benchmarks set by **Google, Anthropic, Meta**",
        "Available to **ChatGPT Plus** users from today"
      ],
      "facts": [
        "**15 trillion** tokens used in training — largest AI run ever"
      ]
    },
    {
      "category": "Business",
      "headline": "Sensex\nHits\nRecord",
      "headlineEmphasis": "Record",
      "sub": "Index crosses 85,000 for the first time in history.",
      "body": [
        "BSE Sensex closed at **85,240** on Monday",
        "**IT and banking** sectors led the surge",
        "Analysts expect rally to continue through **Q2**"
      ],
      "facts": [
        "**FII inflows** of ₹4,200 crore — largest single-session buying in 2026"
      ],
      "hasImage": true
    },
    {
      "category": "Gold & Silver",
      "gold24k": 86950,
      "silver1kg": 95800,
      "trendGold": "up",
      "trendSilver": "down",
      "history": [
        { "date": "22 Mar", "gold": 86500, "silver": 96200 },
        { "date": "21 Mar", "gold": 86200, "silver": 96800 },
        { "date": "20 Mar", "gold": 85900, "silver": 97200 },
        { "date": "19 Mar", "gold": 85600, "silver": 97600 },
        { "date": "18 Mar", "gold": 85300, "silver": 98100 }
      ]
    }
  ]
}
```

---

## USAGE NOTES

- Stories marked `"hasImage": true` — note the story number, upload the image in the app config screen before launching.
- Keep 4–6 stories per bulletin for best pacing.
- Always include a Gold & Silver card if rates are relevant for the day.
- The app **automatically places Gold & Silver last** — no need to order it manually.
- Order other stories: lead with the strongest, most impactful story.
