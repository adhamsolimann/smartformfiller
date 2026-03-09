# Smart Form Filler Extension

Chrome/Brave extension for product managers and testers who repeatedly fill forms with dummy data.

## What It Does

- Fills forms locally (no AI provider calls, no external network dependency).
- Infers data by field type and field semantics (`name`, `id`, `label`, `placeholder`).
- Supports global constraints (date mode, text lengths, number ranges).
- Supports per-field overrides via JSON rules.
- Detects `input[type=file]` and can auto-attach generated mock files.

## Supported Field Types

- `input`: `text`, `email`, `tel`, `url`, `number`, `range`, `date`, `datetime-local`, `month`, `week`, `time`, `checkbox`, `radio`, `color`, `password`, `search`
- `input[type=file]` (mock generated file upload)
- `textarea`
- `select`

## Install (Chrome)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `/Users/adhamsoliman/Documents/New project/extensions/form-filler`

## Install (Brave)

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select:
   - `/Users/adhamsoliman/Documents/New project/extensions/form-filler`

## Usage

1. Open a page with a form.
2. Click the extension icon.
3. Configure constraints in popup (optional).
4. Click **Fill Current Form**.

### Mouse Shortcut

- Double-click (left mouse button) anywhere on the page to trigger fill.
- It uses your saved popup settings and shows a small toast with the fill result.

## Constraints

### Global settings

- `Dates`: `any`, `future`, `past`
- `Min days from today` / `Max days from today`
- `Text min/max length`
- `Number mode`: `any`, `positive`, `negative`
- `Number min/max`
- `Uploads`: enable/disable + preferred type (`Auto`, `PDF`, `JPG`, `PNG`, `DOCX`) + min/max generated file size (KB)

### Per-field rules JSON

Rules are evaluated in order. Matching rules override global settings.

```json
[
  {
    "match": {
      "selector": "input[name='startDate']",
      "types": ["date", "datetime-local"]
    },
    "constraints": {
      "date": {
        "mode": "future",
        "minDaysFromToday": 1,
        "maxDaysFromToday": 120
      }
    }
  },
  {
    "match": {
      "keywords": ["budget", "amount"]
    },
    "constraints": {
      "number": {
        "min": 1000,
        "max": 50000
      }
    }
  },
  {
    "match": {
      "selector": "input[type='file'][name='specAttachment']"
    },
    "constraints": {
      "file": {
        "enabled": true,
        "preferredType": "pdf",
        "minSizeKB": 100,
        "maxSizeKB": 200,
        "mime": "application/pdf",
        "extension": ".pdf"
      }
    }
  }
]
```

## Notes

- Extension does not run on restricted browser pages like `chrome://` or `brave://`.
- Browser security can still block synthetic file assignment on some sites; if so, upload manually for those fields.
- If `accept` on the field conflicts with your preferred upload type, the extension falls back to an allowed type.
