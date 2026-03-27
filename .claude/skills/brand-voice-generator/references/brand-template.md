# Brand System Template

Use this template to generate the brand-system.md file. Replace all `{placeholder}` values with gathered information.

---

```markdown
# {brand_name} — Brand System

> {brand_tagline}

---

## Brand Philosophy

### Core Principles

1. **{principle_1_name}**
   {principle_1_description}

2. **{principle_2_name}**
   {principle_2_description}

3. **{principle_3_name}**
   {principle_3_description}

{additional_principles}

---

## Logo

### The {brand_name} Mark

{logo_description}

**Logo file**: `.claude/skills/pptx-generator/brands/{brand_folder}/assets/logo.png`

**Usage rules:**
- Maintain aspect ratio
- Minimum clear space: 20% of logo width on all sides
{additional_logo_rules}

---

## Color System

### Primary Accent — {accent_name}

The signature brand color. Used for primary actions, links, highlights.

| Name | Hex | Use |
|------|-----|-----|
| {accent_name} | `#{accent}` | Primary buttons, links, highlights |
| {accent_name} Dark | `#{accent_dark}` | Hover states, outlines |
| {accent_name} Light | `#{accent_secondary}` | Secondary accents |

**Rule:** {accent_usage_rule}

### Theme Base

**{theme_name} Theme (Default)**
```
Background:     #{background}
Background Alt: #{background_alt}
Surface:        #{card_bg}
Text Primary:   #{text}
Text Secondary: #{text_secondary}
```

{additional_color_notes}

---

## Typography

### Font Stack

- **Heading:** {heading_font} — {heading_description}
- **Body:** {body_font} — {body_description}
- **Code:** {code_font} — {code_description}

### Typography Rules

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Display/Hero | {heading_font} | 700 | 36px+ |
| H1 | {heading_font} | 700 | 30px |
| H2 | {heading_font} | 600 | 24px |
| Body | {body_font} | 400 | 16-18px |
| Code | {code_font} | 400 | 14px |

### Text Color Usage

| Context | Color | Notes |
|---------|-------|-------|
| Headings | #{text} | Full contrast |
| Body | #{text_secondary} | Comfortable reading |
| Links | #{accent} | With hover effect |

---

## Spacing System

**Base unit:** 4px

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 4px | Tight spacing, icon gaps |
| `sm` | 8px | Related elements |
| `base` | 16px | Standard padding |
| `lg` | 24px | Section padding |
| `xl` | 32px | Card padding |
| `2xl` | 48px | Section margins |

**Rule:** When in doubt, use multiples of 8px.

---

## Buttons

### Button Types

| Type | Background | Text | Use |
|------|------------|------|-----|
| Primary | #{accent} | White | Main actions, CTAs |
| Secondary | #{card_bg} | #{text} | Secondary actions |
| Ghost | Transparent | #{text} | Tertiary actions |

### Button Specs

- **Font:** {heading_font}, 500 weight
- **Border radius:** 8px
- **Padding:** 8px 16px (standard), 12px 24px (large)

---

## Signature Elements

{signature_elements_description}

{signature_element_1}

{signature_element_2}

{signature_element_3}

---

## Diagrams

### Color Palette for Diagrams

| Semantic Purpose | Fill | Stroke |
|------------------|------|--------|
| Primary/Neutral | `#{accent}` | `#{accent_dark}` |
| Secondary | `#{accent_secondary}` | `#{accent_dark}` |
| Start/Trigger | `#FED7AA` | `#C2410C` |
| End/Success | `#A7F3D0` | `#047857` |
| Warning/Decision | `#FEF3C7` | `#B45309` |
| Error/Stop | `#FECACA` | `#B91C1C` |

### Diagram Rules

- **Background:** {diagram_bg} for maximum readability
- **Text color:** {diagram_text}
- **Stroke width:** 2px
- **Rule:** Always pair darker stroke with lighter fill

---

## Quick Reference

### When to Use Primary Accent

| Use {accent_name} | Don't Use |
|-------------------|-----------|
{accent_usage_table}

### Font Usage

| {heading_font} | {body_font} |
|----------------|-------------|
{font_usage_table}

---

*Last updated: {date}*
```

---

## Filling the Template

### brand_tagline
One-line brand description.
Example: "A complete design system for AI education content, community, and products."

### principle_1/2/3_name and description
Core design principles.
Examples:
- "Technical but Approachable" - "Complex topics made accessible without dumbing them down."
- "Clean over Flashy" - "No unnecessary decoration. Every visual element has a purpose."
- "Dark Mode by Default" - "Modern, developer-focused aesthetic."

### logo_description
Brief description of the logo.
Example: "A stylized blue flame/droplet shape — fluid, dynamic, and modern."

If no logo, write: "No logo configured. Add a logo to `assets/logo.png` when available."

### accent_name
A name for the primary accent color.
Example: "Dynamous Blue", "Brand Orange", "Primary"

### accent/accent_dark/accent_secondary
Hex values without # prefix.

### accent_usage_rule
How to use the accent color.
Example: "Dynamous Blue is the hero. Use for actions and emphasis. Don't dilute by overusing."

### theme_name
"Dark" or "Light" depending on the background color.

### heading_description/body_description/code_description
Brief description of each font's role.
Example: "Clean, modern sans-serif for all UI and body text"

### signature_elements_description
Introduction to signature visual elements.
Example: "These patterns define the Dynamous visual identity."

### signature_element_1/2/3
Descriptions of unique visual patterns.
Examples:
- Glass card effect with backdrop blur
- Gradient backgrounds
- Glow effects around primary elements

If no signature elements defined, suggest based on colors:
- For dark themes: glass effects, subtle glows
- For light themes: clean shadows, crisp borders

### diagram_bg
Background color for diagrams.
Dark brands usually use white (#FFFFFF) for diagram backgrounds.
Light brands can match the brand background.

### diagram_text
Text color for diagrams.
Usually a dark color for readability.

### accent_usage_table
Table rows showing when to use/not use accent.

### font_usage_table
Table rows showing when to use each font.

### date
Current date in YYYY-MM-DD format.
