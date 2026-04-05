# GWN Addon Format — v1.0 Template

## What is a .gwn file?

A `.gwn` file is a JSON package that adds a new page/feature to the Global Earthquake Viewer app.
When installed (via the **Addons** panel), the app creates a new tab button for it automatically.
The addon's content replaces the map area while it is open.

---

## File Structure

```json
{
  "gwn": "1.0",
  "id": "my-addon-id",
  "name": "My Addon Name",
  "icon": "🛰",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "One-line description shown in the addon manager.",
  "permissions": ["network"],
  "html": "...full self-contained HTML string..."
}
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `gwn` | string | Must be `"1.0"` |
| `id` | string | Unique identifier — alphanumeric, hyphens, underscores only (e.g. `my-addon`) |
| `name` | string | Display name shown in tab and manager |
| `html` | string | Complete self-contained HTML page (see below) |

### Optional fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `icon` | string | `"🔧"` | Emoji shown in the tab button and card |
| `version` | string | `"1.0.0"` | Semver version string |
| `author` | string | `""` | Author or team name |
| `description` | string | `""` | Short description (1–2 lines) |
| `permissions` | array | `[]` | Declared capabilities (informational, e.g. `"network"`) |

---

## The HTML page

The `html` property must be a complete, self-contained HTML document including:
- `<style>` blocks for all CSS
- `<script>` blocks for all JavaScript
- No external script dependencies that require `<script src>` with CORS

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>My Addon</title>
  <style>
    /* all CSS here */
    body { font-family: sans-serif; padding: 20px; }
  </style>
</head>
<body>
  <h1>My Addon</h1>
  <div id="content">Loading...</div>

  <script>
    // All JS here — no imports, no require()
    // This script runs in Electron's renderer context (no CORS restrictions)
    async function load() {
      const res = await fetch('https://example.com/api/data');
      const data = await res.json();
      document.getElementById('content').textContent = JSON.stringify(data, null, 2);
    }
    load();
  </script>
</body>
</html>
```

### Network access

Because the addon runs inside Electron (desktop app), fetch() calls to any HTTPS URL work
without CORS restrictions. You do NOT need a proxy or server — call APIs directly.

### No simulated/fake data

Never show placeholder or randomly generated numbers as "data". 
If a fetch fails, show "Unavailable" or the error message instead.

---

## Packaging your addon

1. Write & test your HTML file standalone in a browser first.
2. Create a `.json` file with the manifest fields above.
3. Set the `html` field to the full HTML string (JSON-encoded — use `JSON.stringify(htmlText)`).
4. Save as `my-addon.gwn`.

### Quick pack script (Node.js)

```js
const fs = require('fs');
const html = fs.readFileSync('my-addon.html', 'utf8');
const manifest = {
  gwn: '1.0',
  id: 'my-addon',
  name: 'My Addon',
  icon: '🛰',
  version: '1.0.0',
  author: 'Me',
  description: 'Does something useful.',
  permissions: ['network'],
  html
};
fs.writeFileSync('my-addon.gwn', JSON.stringify(manifest, null, 2), 'utf8');
console.log('Packed!');
```

---

## Limits

- Maximum **5 addons** installed at the same time.
- `id` must be unique — installing a duplicate id will show an error.
- Each addon has its own isolated iframe context (no access to the main app's JS).

---

## Installed addons example

```
Version2/
  addons/
    earth-danger.gwn    ← First addon (Earth Danger Index)
    ADDON_TEMPLATE.md   ← This file
    pack-gwn.js         ← Packer script example
```
