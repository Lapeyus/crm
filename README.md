# Hotel Grano de Oro Reputation CRM

Static reputation-management dashboard ready for GitHub Pages.

## Default Dataset

The dashboard loads Hotel Grano de Oro by default from:

```text
./data/hotel_grano_de_oro_reviews_llm.json
```

The JSON contains the full TripAdvisor export plus the current Ollama-enriched sample fields.

## Local Preview

Serve the repository root:

```bash
python3 -m http.server 8081 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8081/
```

## GitHub Pages

In GitHub:

1. Go to `Settings` -> `Pages`.
2. Set source to `Deploy from a branch`.
3. Select the default branch and `/root`.
4. Save.

The site should be available at:

```text
https://lapeyus.github.io/crm/
```
