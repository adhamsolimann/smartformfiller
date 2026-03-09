# Smart Form Filler Extension

Privacy-first Chrome/Brave extension that fills forms with realistic local test data, supports reusable profiles and constraints, and speeds up repetitive QA/PM workflows.

Suggested GitHub repository description:
`Privacy-first Chrome/Brave form filler for QA/PM teams with local data generation, profile presets, visual rule builder, collapsible UI, tab view, undo, configurable 2/3-click shortcuts, and upload-field support.`

## What It Does

- Fills forms locally (no AI provider calls, no external network dependency).
- Infers data by field type and field semantics (`name`, `id`, `label`, `placeholder`).
- Supports global constraints (date mode, text lengths, number ranges).
- Supports per-field overrides with a visual Rule Builder UI (and optional advanced JSON).
- Detects `input[type=file]` and can auto-attach generated mock files.
- Supports configurable mouse shortcut trigger (2-click or 3-click).
- Supports reusable profiles (save and switch settings per project or scenario).
- Includes one-click undo for the most recent fill operation on the current page.
- Handles common split birthday inputs (`day`, `month`, `year`) and gender fields more reliably.
- For dropdown/select fields, picks a random valid option by default.
- Popup UI supports collapsible sections to reduce clutter.
- Includes an `Open in New Tab` option for a wider, full-page settings view.

## Supported Field Types

- `input`: `text`, `email`, `tel`, `url`, `number`, `range`, `date`, `datetime-local`, `month`, `week`, `time`, `checkbox`, `radio`, `color`, `password`, `search`
- `input[type=file]` (mock generated file upload)
- `textarea`
- `select` (random option selection by default)

## Install (Chrome or Brave)

1. Clone or download this repository.
2. Open extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder that contains `manifest.json`.

This extension is plain Manifest V3 JavaScript with no build step, so it can run on any machine with Chrome/Brave-compatible extension support.

## Usage

1. Open a page with a form.
2. Click the extension icon.
3. Pick or create a profile (optional).
4. Configure constraints in popup (optional).
5. Add per-field rules in **Rule Builder** if needed (optional).
6. Click **Fill Current Form**.

To revert: click **Undo Last Fill** in the popup.

### UI Space Options

- The popup uses collapsible sections so you can open only what you need.
- Click **Open in New Tab** in the header to launch a full-width extension view with more space.

### Mouse Shortcut

- Choose `2 clicks` (double-click) or `3 clicks` (triple-click) in popup settings.
- Then click anywhere on the page with the selected count to trigger fill.
- It uses your saved popup settings and shows a small toast with the fill result.

## Constraints

### Global settings

- `Dates`: `any`, `future`, `past`
- `Min days from today` / `Max days from today`
- `Text min/max length`
- `Number mode`: `any`, `positive`, `negative`
- `Number min/max`
- `Mouse shortcut`: choose `2 clicks` or `3 clicks`
- `Uploads`: enable/disable + preferred type (`Auto`, `PDF`, `JPG`, `PNG`, `DOCX`) + min/max generated file size (KB)

### Per-field rules JSON

Rules are evaluated in order. Matching rules override global settings.
You can create/edit these in the Rule Builder UI, then use JSON only for advanced edits.

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
  },
  {
    "match": {
      "types": ["checkbox"],
      "keywords": ["terms", "consent"]
    },
    "constraints": {
      "checkbox": {
        "checked": true
      }
    }
  },
  {
    "match": {
      "types": ["select"],
      "names": ["country"]
    },
    "constraints": {
      "select": {
        "preferNonPlaceholder": true
      }
    }
  }
]
```

## Notes

- Extension does not run on restricted browser pages like `chrome://` or `brave://`.
- Browser security can still block synthetic file assignment on some sites; if so, upload manually for those fields.
- If `accept` on the field conflicts with your preferred upload type, the extension falls back to an allowed type.
