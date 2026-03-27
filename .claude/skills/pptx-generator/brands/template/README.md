# Brand Template

Use this template to add a new brand to the PPTX generator skill.

## Setup Instructions

1. **Copy this folder** to a new folder with your brand name:
   ```
   cp -r template/ your-brand-name/
   ```

2. **Edit `brand.json`** with your brand's values:
   - All color values should be hex codes WITHOUT the `#` prefix (e.g., `"1e1e2e"`)
   - Font names should match fonts installed on the system
   - Asset paths are relative to the brand folder

3. **Edit `brand-system.md`** with your brand guidelines:
   - This file provides context to the AI when generating content
   - Include color rationale, typography rules, and visual principles

4. **Edit `tone-of-voice.md`** with writing guidelines:
   - This file guides the AI in writing slide content
   - Include voice attributes, example phrases, and dos/don'ts

5. **Add assets** to the `assets/` folder:
   - `logo.png` - Primary logo
   - `logo-dark.png` - Logo variant for dark backgrounds (optional)
   - `icon.png` - Square icon (optional)

6. **Edit `config.json`** with output and generation settings:
   - Output directory (where PPTX files are saved)
   - Batch generation settings
   - File naming conventions

## config.json Reference

```json
{
  "output": {
    "directory": "output/{brand}",  // Where to save files ({brand} = brand name)
    "naming": "{name}-{date}",      // File naming pattern
    "keep_parts": false             // Keep part files after combining?
  },
  "generation": {
    "slides_per_batch": 5,          // Slides per batch (max 5)
    "auto_combine": true,           // Auto-combine batches into final?
    "open_after_generate": false    // Open file after generation?
  },
  "defaults": {
    "slide_width_inches": 13.333,   // 16:9 aspect ratio
    "slide_height_inches": 7.5
  }
}
```

**Placeholders for `directory` and `naming`:**
- `{brand}` - Brand folder name
- `{name}` - Presentation name (from user request)
- `{date}` - Current date (YYYY-MM-DD)
- `{timestamp}` - Unix timestamp

## brand.json Reference

```json
{
  "name": "Brand Name",
  "description": "One-line brand description",

  "colors": {
    "background": "1e1e2e",      // Main slide background
    "background_alt": "181825",  // Darker variant for contrast
    "text": "cdd6f4",            // Primary text color
    "text_secondary": "bac2de",  // Muted/secondary text
    "accent": "fab387",          // Primary accent (CTAs, highlights)
    "accent_secondary": "89b4fa", // Secondary accent (variety)
    "accent_tertiary": "a6e3a1", // Third accent (optional)
    "code_bg": "11111b",         // Code block background
    "card_bg": "313244",         // Card/surface background
    "card_bg_alt": "45475a"      // Alternate card background
  },

  "fonts": {
    "heading": "JetBrains Mono", // Headlines, titles, buttons
    "body": "Inter",             // Body text, descriptions
    "code": "JetBrains Mono"     // Code blocks, terminal
  },

  "assets": {
    "logo": "assets/logo.png",   // Path to primary logo
    "logo_dark": null,           // Path to dark variant (or null)
    "icon": null                 // Path to icon (or null)
  }
}
```

## Notes

- Color hex codes should NOT include the `#` prefix
- The AI reads both `brand.json` (for exact values) and the markdown files (for context)
- Keep markdown files updated if you change values in `brand.json`
