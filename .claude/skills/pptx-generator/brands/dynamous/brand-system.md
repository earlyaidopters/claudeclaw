# Dynamous — Brand System

> A complete design system for AI education content, community, and products.

---

## Brand Philosophy

### Core Principles

1. **Technical but Approachable**
   Complex AI topics made accessible without dumbing them down. Show the sophistication, explain it clearly.

2. **Clean over Flashy**
   No unnecessary decoration. Every visual element has a purpose. Elegance through restraint.

3. **Dark Mode by Default**
   Modern, developer-focused aesthetic. Easy on the eyes for people who stare at screens all day.

4. **Diagrams Should Argue, Not Display**
   Visual content makes a point. Shapes mirror meaning. If you removed the text, the structure alone should communicate the concept.

---

## Logo

### The Dynamous Mark

A stylized blue flame/droplet shape — fluid, dynamic, and modern. Represents energy, transformation, and forward momentum.

**Logo file**: `.claude/DynamousLogo.png`

**Usage rules:**
- Maintain aspect ratio
- Minimum clear space: 20% of logo width on all sides
- On dark backgrounds: use as-is
- On light backgrounds: use as-is (blue on white works)
- Never distort, rotate, or add effects

**Logo colors:**
- Primary fill: `#3B82F6` (Dynamous Blue)
- Highlight gradient: lighter blue toward top-left
- Outline: `#2563EB` (slightly darker)

---

## Color System

### Primary Accent — Dynamous Blue

The signature brand color. Used for primary actions, links, highlights, and the logo.

| Name | Hex | HSL | Use |
|------|-----|-----|-----|
| Dynamous Blue | `#3B82F6` | 217° 91% 60% | Primary buttons, links, logo |
| Dynamous Dark | `#2563EB` | 217° 91% 53% | Hover states, outlines |
| Dynamous Light | `#60A5FA` | 217° 91% 67% | Secondary accents, highlights |
| Dynamous Cyan | `#0EA5E9` | 199° 89% 48% | Tertiary accents, variations |
| Dynamous Pale | `#DBEAFE` | 214° 95% 93% | Light mode backgrounds, fills |

**Rule:** Dynamous Blue is the hero. Use it for actions and emphasis. Don't dilute it by overusing.

**CRITICAL: NO PURPLE.** Dynamous uses blue variations only. Never use purple (#6D28D9 or similar). For tertiary accents or AI/LLM representations, use Dynamous Cyan (#0EA5E9) or darker blues (#1E40AF) instead.

### Secondary Accents — Functional Colors

Used sparingly for specific semantic purposes.

| Purpose | Fill | Stroke | When to Use |
|---------|------|--------|-------------|
| AI/LLM | `#DBEAFE` | `#0EA5E9` | Representing AI, agents, LLMs in diagrams |
| Success/Start | `#A7F3D0` | `#047857` | Completed states, starting points, announcements |
| Warning/Decision | `#FEF3C7` | `#B45309` | Decision points, caution, ratings |
| Error/Stop | `#FECACA` | `#B91C1C` | Errors, destructive actions, end states |
| Trigger/Input | `#FED7AA` | `#C2410C` | Input points, triggers in workflows |

**Rule:** These are semantic, not decorative. Use them to encode meaning in diagrams and UI states.

### Theme Bases

**Dark Theme (Default)**
```
Background:     #07090F (near-black with blue tint)
Background Alt: #080A13 (slightly warmer)
Surface:        rgba(0, 0, 0, 0.4) (glass cards)
Border:         rgba(255, 255, 255, 0.1)
Text Primary:   rgba(255, 255, 255, 0.98)
Text Secondary: rgba(255, 255, 255, 0.80)
Text Muted:     rgba(255, 255, 255, 0.70)
```

**Light Theme (Diagrams/Excalidraw)**
```
Background:     #FFFFFF
Surface:        #F1F5F9 (slate-100)
Border:         #E5E7EB (gray-200)
Text Primary:   #1E293B (slate-800)
Text Secondary: #374151 (gray-700)
Text Muted:     #64748B (slate-500)
```

### Gradient Backgrounds

**Hero gradient (website):**
```css
background: linear-gradient(to bottom, #07090f, rgba(30, 58, 138, 0.9), #080a13);
background-attachment: fixed;
```

**Blue glow effect:**
```css
box-shadow: 0 0 15px rgba(59, 130, 246, 0.5), 0 0 30px rgba(59, 130, 246, 0.3);
```

---

## Typography

### Font Stack

- **Primary:** Inter — Clean, modern sans-serif for all UI and body text
- **Thumbnails:** Montserrat Bold or Inter Black — High-impact, readable at small sizes
- **Code:** JetBrains Mono or system monospace

### Type Scale

| Token | Size | Use |
|-------|------|-----|
| `xs` | 0.75rem (12px) | Labels, badges, meta |
| `sm` | 0.875rem (14px) | Secondary text, descriptions |
| `base` | 1rem (16px) | Body text, paragraphs |
| `lg` | 1.125rem (18px) | Lead paragraphs, emphasis |
| `xl` | 1.25rem (20px) | Section headers |
| `2xl` | 1.5rem (24px) | Card titles |
| `3xl` | 1.875rem (30px) | Page headers |
| `4xl` | 2.25rem (36px) | Hero subheadings |
| `5xl` | 3rem (48px) | Hero headings (mobile) |
| `6xl` | 3.75rem (60px) | Hero headings (desktop) |

### Typography Rules

| Element | Font | Weight | Size | Line Height |
|---------|------|--------|------|-------------|
| Display/Hero | Inter | 700 (Bold) | 4xl-6xl | 1.1 |
| H1 | Inter | 700 | 3xl | 1.2 |
| H2 | Inter | 600 | 2xl | 1.3 |
| H3 | Inter | 600 | xl | 1.4 |
| Body | Inter | 400 | base | 1.6 |
| Small | Inter | 400 | sm | 1.5 |
| Code | JetBrains Mono | 400 | sm | 1.5 |
| Buttons | Inter | 500 | sm-base | 1 |
| Thumbnail Text | Montserrat | 800 | - | 1.1 |

### Text Color Usage

| Context | Color | Notes |
|---------|-------|-------|
| Headings | white (98%) | Full contrast for emphasis |
| Body content | white/80 | Comfortable reading |
| Descriptions | white/70 | Secondary information |
| Muted/meta | white/60 | Timestamps, labels |
| Links | Dynamous Blue | `#3B82F6` with hover glow |

---

## Spacing System

**Base unit:** 4px

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 4px | Tight spacing, icon gaps |
| `sm` | 8px | Related elements |
| `md` | 12px | Form inputs internal |
| `base` | 16px | Standard component padding |
| `lg` | 24px | Section padding |
| `xl` | 32px | Card padding |
| `2xl` | 48px | Section margins |
| `3xl` | 64px | Major section breaks |

**Rule:** When in doubt, use multiples of 8px.

---

## Buttons

### Button Types

| Type | Background | Text | Use |
|------|------------|------|-----|
| Primary | Dynamous Blue | White | Main actions, CTAs |
| Secondary | white/10 | White | Secondary actions |
| Outline | Transparent | White | Tertiary, paired with primary |
| Ghost | Transparent | White | Navigation, subtle actions |

### Button Specs

- **Font:** Inter, 500 weight
- **Border radius:** 8px (0.5rem)
- **Padding:**
  - sm: 6px 12px
  - md: 8px 16px
  - lg: 12px 24px
- **Transition:** 200ms ease-out
- **Primary shadow:** `0 4px 14px -4px rgba(59, 130, 246, 0.4)`

### Signature Button Effect

Shimmer animation on hover:
```css
.shimmer {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  animation: shimmer 2s linear infinite;
}
```

---

## Motion

### Timing

| Type | Duration | Use |
|------|----------|-----|
| Micro | 150ms | Button states, toggles |
| Fast | 200ms | Dropdowns, small transitions |
| Normal | 300ms | Cards, modals |
| Slow | 600ms | Page transitions, fade-ins |

**Rule:** Nothing should take longer than 600ms. Snappy > smooth.

### Easing

- **Entrances:** `ease-out` or `cubic-bezier(0, 0, 0.2, 1)`
- **Exits:** `ease-in` or `cubic-bezier(0.4, 0, 1, 1)`
- **Never use:** Linear for UI transitions (feels robotic)

### Signature Animations

**Float (decorative elements):**
```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
animation: float 6s ease-in-out infinite;
```

**Fade-in (content entrance):**
```css
@keyframes fade-in {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}
animation: fade-in 0.6s ease-out forwards;
```

**Glow pulse (emphasis):**
```css
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
}
```

### What Moves

- Buttons (hover, active states)
- Cards (hover lift)
- Decorative logos (floating)
- Page sections (scroll reveal)
- Modals (entrance/exit)

### What Doesn't Move

- Body text
- Navigation (stays grounded)
- Form inputs (stable)
- Critical UI elements

---

## Icons

### Specifications

| Property | Value |
|----------|-------|
| Library | Lucide React |
| Style | Outline, 2px stroke |
| Size (inline) | 14-16px |
| Size (UI) | 18-20px |
| Size (emphasis) | 24px |
| Default color | currentColor (inherits text) |
| Interactive | Opacity change on hover |

### Usage Rules

- Icons accompany text, rarely standalone
- Use consistent sizing within a component
- Match icon weight to surrounding text weight
- Don't use icons purely for decoration

---

## Signature Elements

### Glass Card

The defining UI pattern for Dynamous. Frosted glass effect over dark backgrounds.

**Use for:**
- Content cards
- Video containers
- Feature highlights
- Testimonials

**Do NOT use for:**
- Buttons (too subtle)
- Navigation
- Form inputs

**Implementation:**
```css
.glass-card {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
```

### Blue Glow

Signature emphasis effect. Creates a soft halo around important elements.

**Use for:**
- Hero text highlights
- Primary buttons
- Featured content
- The logo in hero sections

**Rule:** Use sparingly. If everything glows, nothing does.

**Implementation:**
```css
.blue-glow {
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.5),
              0 0 30px rgba(59, 130, 246, 0.3);
}

.text-glow {
  text-shadow: 0 0 10px rgba(59, 130, 246, 0.5),
               0 0 20px rgba(59, 130, 246, 0.3);
}
```

### Grid Pattern

Subtle background texture that adds depth without distraction.

**Use only on:** Hero sections, large empty backgrounds

**Implementation:**
```css
.grid-pattern {
  background-image:
    linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

---

## Diagrams (Excalidraw)

### Color Palette for Diagrams

| Semantic Purpose | Fill | Stroke |
|------------------|------|--------|
| Primary/Neutral | `#3B82F6` | `#1E3A5F` |
| Secondary | `#60A5FA` | `#1E3A5F` |
| Tertiary/AI | `#DBEAFE` | `#0EA5E9` |
| Start/Trigger | `#FED7AA` | `#C2410C` |
| End/Success | `#A7F3D0` | `#047857` |
| Warning/Reset | `#FEE2E2` | `#DC2626` |
| Decision | `#FEF3C7` | `#B45309` |

### Diagram Rules

- **Background:** White (`#FFFFFF`) for maximum readability
- **Text color:** `#1E3A5F` (deep blue)
- **Font:** Virgil (Excalidraw default) or Hand-drawn style
- **Stroke width:** 2px
- **Roughness:** 1 (slight hand-drawn feel)
- **Rule:** Always pair darker stroke with lighter fill

### Shape Meaning

| Concept Type | Shape |
|--------------|-------|
| Start, trigger, input | Ellipse |
| End, output, result | Ellipse |
| Decision, condition | Diamond |
| Process, action, step | Rectangle |
| Abstract state, context | Overlapping ellipses (cloud) |

---

## YouTube Thumbnails

### Specifications

- **Dimensions:** 1280 × 720px
- **Text:** 2-5 words maximum
- **Font:** Montserrat Extra Bold (800) or Inter Black
- **Text color:** White with dark outline/shadow for readability
- **Background:** Dark with blue accents, or screenshot-based

### Common Patterns

1. **GitHub repo style** — Screenshot with logo "swoosh"
2. **Excalidraw diagram** — Workflow visualization
3. **You + logos** — Personal image surrounded by tech logos
4. **Bold text + concept** — Large text with supporting visual

### Thumbnail Rules

- Face included when possible (increases CTR)
- High contrast text (readable at small sizes)
- Consistent blue accent somewhere in frame
- No more than 5 words of text
- Test readability at mobile size (small thumbnail preview)

---

## Image Treatment

### Screenshots & UI

- **Border radius:** 12px
- **Border:** 1px solid rgba(255, 255, 255, 0.1)
- **Shadow:** `0 4px 12px -2px rgba(0, 0, 0, 0.3)`
- **Optional:** Blue glow on featured screenshots

### Photos

- **Border radius:** 8px or full (for avatars)
- **Filters:** Slight cool tone to match blue palette
- **Backgrounds:** Dark preferred, blur if busy

---

## CSS Variables Reference

```css
:root {
  /* Colors - Primary */
  --dynamous-blue: #3B82F6;
  --dynamous-dark: #2563EB;
  --dynamous-light: #60A5FA;
  --dynamous-cyan: #0EA5E9;
  --dynamous-pale: #DBEAFE;

  /* Colors - Semantic */
  --success: #047857;
  --success-bg: #A7F3D0;
  --warning: #B45309;
  --warning-bg: #FEF3C7;
  --error: #B91C1C;
  --error-bg: #FECACA;
  --ai-cyan: #0EA5E9;
  --ai-cyan-bg: #DBEAFE;

  /* Colors - Theme (Dark) */
  --background: #07090F;
  --background-alt: #080A13;
  --surface: rgba(0, 0, 0, 0.4);
  --border: rgba(255, 255, 255, 0.1);
  --text-primary: rgba(255, 255, 255, 0.98);
  --text-secondary: rgba(255, 255, 255, 0.8);
  --text-muted: rgba(255, 255, 255, 0.7);

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-base: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-display: 'Montserrat', var(--font-sans);

  /* Motion */
  --duration-micro: 150ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 600ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

---

## Quick Reference

### Dynamous Blue vs Other Blues

| Dynamous Blue | Other Blues |
|---------------|-------------|
| Primary buttons | Never |
| Links | - |
| Logo | - |
| Accent glows | Secondary accents use semantic colors |
| Hero highlights | Diagram fills use palette system |
| Featured elements | - |

### Inter vs Montserrat

| Inter | Montserrat |
|-------|------------|
| All UI text | YouTube thumbnail text |
| Body copy | Bold headlines (optional) |
| Buttons | - |
| Navigation | - |
| Everything else | Only when maximum impact needed |

---

*Last updated: 2026-01-13*
