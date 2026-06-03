# Hotel Grano de Oro Reputation Intelligence Guide

This dashboard turns guest reviews into an operating system for hospitality teams. It is built around one default property, Hotel Grano de Oro, and loads the enriched review dataset from `./data/hotel_grano_de_oro_reviews_llm.json`.

## What the data is

The primary dataset in this demo comes from a TripAdvisor review export for Hotel Grano de Oro. The file contains 1,891 reviews in the current export, with 510 reviews enriched by the local Ollama pipeline at the time of the latest sync. The dashboard keeps the original review text, star rating, date, author, URL and business metadata, then adds structured AI fields for operational analysis.

The enrichment layer is local and private:

- `qwen3.5:9b` runs in Ollama on your machine.
- Reviews are processed one by one, cached locally, and deduplicated by review identity and text.
- The output is a JSON file that can be loaded by the dashboard or exported to other systems.

## What the dashboard shows

### Overview

The top KPI row is the management summary. It answers:

- What is the average rating?
- How much review volume is in the filtered dataset?
- How many reviews are promotable positive feedback?
- How many need service recovery?
- How much of the dataset has already been enriched by LLM?
- How many sources and guest segments are being tracked?

Interpretation:

- A high average rating with low LLM coverage is a partial picture.
- A lower average rating with high recovery volume signals immediate operational risk.
- Response rate tells you whether the hotel is closing the loop with guests or leaving reputation unattended.

### Rating Trend

The monthly trend plot shows how reputation changes over time.

What it answers:

- Is volume rising or falling?
- Is rating improving, stable or deteriorating?
- Are there specific months where service issues spike?

How to read it:

- Taller bars mean more reviews in that month.
- The number above each bar is the average rating for that month.
- If volume spikes while rating drops, there is likely an operational event, staffing issue, renovation problem or guest expectation mismatch.

### Rating Distribution

This panel shows the star distribution.

Why it matters:

- It reveals whether the average rating is broad-based or distorted by a few extremes.
- It helps explain whether the hotel is living in the 4-star band, 5-star band, or dealing with a large tail of poor reviews.

### Operations: Topics

This section groups reviews by operational topic such as service, rooms, food, cleanliness, location, value, amenities, booking, staff, safety and noise.

What it answers:

- What are guests talking about most?
- Which departments are driving most of the feedback?
- Are issues operational, commercial or brand-related?

Why it is useful:

- Service and staff themes map to front office and guest relations.
- Rooms, noise and maintenance map to housekeeping, engineering and rooms division.
- Food maps to restaurant and breakfast operations.
- Value and booking map to revenue, sales and distribution.

### Guest Mix

This panel segments feedback by trip type or traveler profile.

Why it matters:

- Couples and families often complain about different things.
- Business travelers care more about speed, quiet, reliability and process.
- Repeat guests are stronger signals than one-off stays.

Operational use:

- Differentiate complaints that affect one guest segment from those that affect the whole property.
- Tailor recovery scripts, upsell offers and marketing messages by segment.

### Executive Brief

This is the leadership summary.

It is designed to answer:

- What should management pay attention to first?
- Are we seeing a trend or a one-off?
- How many issues are urgent?
- How many cases need compensation?
- What is the dominant risk to reputation and revenue?

The brief combines:

- LLM coverage
- High urgency reviews
- Compensation signals
- Revenue risk
- Brand gap signals
- Positive staff recognition

### Revenue Impact

This panel estimates whether a review can affect future revenue.

How to interpret it:

- High impact reviews typically mention pricing disputes, trust issues, safety problems, cleanliness failures or service breakdowns.
- Medium impact usually means operational frustration that can still depress conversion if repeated.
- Low impact is usually praise or a minor issue.

Why it matters:

- Revenue teams care not only about rating, but about whether a review damages rate integrity and booking confidence.
- A review about an overcharge can hurt conversion more than a generic complaint.

### Root Cause Map

This is one of the most important operational views.

It converts free text into likely root-cause classes:

- Service failure
- Room quality
- Noise
- Cleanliness
- Food quality
- Billing and pricing
- Booking expectation mismatch
- Maintenance
- Safety and security
- Location and access
- Amenities gap
- Staff recognition
- Brand promise mismatch

How to use it:

- Use the root-cause distribution as an agenda for daily or weekly ops review.
- Look for clusters rather than isolated comments.
- If the same root cause repeats across many reviews, the issue is systemic, not anecdotal.

### Pattern Examples

This panel gives concrete examples behind the root cause map.

Use it to:

- Verify that the model is classifying correctly.
- Show stakeholders the actual guest language behind the trend.
- Decide whether the issue needs a tactical fix, a policy change or a capital project.

### AI Insights

This section shows the LLM-enriched reviews.

Each insight includes:

- sentiment
- urgency
- summary
- action recommendation

Why it matters:

- It transforms reviews from raw text into work items.
- It helps operations teams go from reading to acting.

### Sentiment IA

This is semantic sentiment, not just star rating.

Why it is better than a star count:

- A 5-star review can still contain a hidden complaint.
- A 3-star review can be mostly praise with one critical issue.
- The model can detect mixed sentiment and urgency more reliably than a simple rating threshold.

### Routing by Department

This section assigns a likely owner:

- Front Desk
- Housekeeping
- Food & Beverage
- Rooms
- Maintenance
- Management
- Revenue
- Guest Relations
- Security
- Spa & Wellness

Why it matters:

- Reputation work fails when everything goes to one inbox.
- Ownership makes the feedback actionable.
- Department routing is what turns sentiment analysis into an operational workflow.

### CRM Workbench

This is the action queue.

Each item can include:

- urgency
- SLA
- recommended owner
- compensation requirement
- next step
- response draft

How to use it:

- High urgency means immediate attention.
- Medium urgency means same-day or next-day follow-up.
- Low urgency means queue for normal service review or future opportunity.

### Revenue Protection

This panel highlights reviews likely to affect conversion, pricing confidence or repeat booking.

Typical examples:

- billing disputes
- overcharges
- false promises
- poor room quality
- safety concerns
- repeated noise issues

### Benchmark

If you load multiple datasets or properties, this section compares them.

It is designed for:

- portfolio managers
- regional managers
- hotel groups
- franchise operations

Metrics shown:

- volume
- average rating
- recovery rate
- IA-positive ratio

### Competitive Intel

This signals whether the review language suggests:

- advantage
- parity
- disadvantage
- competitor mentions

Use it to detect:

- where a hotel beats expectations
- where it lags competitors
- whether the market is framing the property as better or worse than alternatives

### Compliance and Safety

This panel is for reviews that can become legal, safety or reputation issues.

Examples:

- security concerns
- health or hygiene concerns
- fraud or billing disputes
- privacy issues
- discrimination

Why it matters:

- These items should not be buried inside ordinary customer service workflows.
- They need escalation paths and traceability.

### Brand Voice and Marketing

This section does two jobs:

1. Generates a draft public response in a consistent brand voice.
2. Highlights positive reviews that can be amplified in marketing.

It also identifies:

- brand promise gaps
- staff recognition opportunities
- language that can be reused as social proof

## How this compares to other services

This dashboard borrows the operating model used by category leaders, but keeps the data flow local and flexible.

| Vendor | What they emphasize | How this dashboard maps to it |
|---|---|---|
| TrustYou | AI-powered hospitality reputation management, sentiment analysis, competitor benchmarking, response AI and guest feedback centralization | The dashboard adds root-cause clustering, revenue risk, staff recognition, and a local LLM pipeline while preserving the same hospitality workflow |
| Shiji ReviewPro | Reputation management, semantic analysis, benchmark reporting, review aggregation, brand voice and guest-experience benchmarking | This dashboard mirrors semantic analysis and benchmarking, then extends them with CRM routing and editable local outputs |
| Birdeye | Review monitoring across many sources, AI summaries, AI responses, on-brand replies, review insights and response automation | The dashboard matches review summaries and response drafting, with added hotel-specific operational routing and compliance triage |
| ReviewTrackers | Review analytics, NLP sentiment and trend detection, competitor insights, compliance signals, experience analysis | The dashboard aligns with review analytics and trend detection, and focuses the output on hotel departments and service recovery |

Official sources:

- TrustYou: [Products - Reputation Management](https://www.trustyou.com/products/reputation-management)
- TrustYou: [AI-Powered Customer Experience Platform](https://www.trustyou.com/products/customer_experience_platform/)
- TrustYou: [Request a CXP Demo](https://resources.trustyou.com/request-a-cxp-demo)
- Shiji ReviewPro: [Reputation management](https://www.shijigroup.com/reviewpro-reputation)
- Shiji ReviewPro: [Semantic analysis / product site](https://www.shijigroup.com/reviewpro-reputation/features)
- Shiji Guest Experience Benchmark: [Q1 2023 benchmark](https://insights.shijigroup.com/guest-experience-benchmark-q1-2023-2/)
- Birdeye: [Review management](https://birdeye.com/review-management/)
- Birdeye: [Reviews AI](https://birdeye.com/reviews/)
- ReviewTrackers: [Customer Experience Analytics Software](https://www.reviewtrackers.com/social-media-marketing/)
- ReviewTrackers: [Pricing and Packages](https://www.reviewtrackers.com/plans/)

## Why this product is different

Most reputation tools stop at aggregation, sentiment and response management.

This dashboard goes further:

- It explains the root cause.
- It tells you who should own the issue.
- It estimates SLA and compensation needs.
- It flags revenue risk and compliance risk.
- It surfaces marketing opportunities from positive reviews.
- It keeps the whole pipeline local and exportable.

That makes it suitable for:

- independent hotels
- hotel groups
- reputation agencies
- CRM teams
- operations leaders
- revenue managers

## Recommended operating workflow

1. Load or ingest review exports.
2. Enrich them with Ollama.
3. Review the executive brief first.
4. Check root causes and action queue.
5. Route issues to departments.
6. Use compliance and revenue panels for escalation.
7. Export the filtered dataset for reporting or CRM follow-up.

