---
name: liseberg-design
description: Design system skill for liseberg. Activate when building UI components, pages, or any visual elements. Provides exact color tokens, typography scale, spacing grid, component patterns, and craft rules. Read references/DESIGN.md before writing any CSS or JSX. Includes ultra-mode visual journey: read references/ANIMATIONS.md, references/LAYOUT.md, references/COMPONENTS.md, and references/INTERACTIONS.md for full motion and layout details.
---

# liseberg Design System

You are building UI for **liseberg**. Light-themed, neutral palette, sans-serif typography (LL Brown Black), compact density on a 4px grid, expressive motion.

## Visual Reference

**IMPORTANT**: Study ALL screenshots below before writing any UI. Match colors, typography, spacing, layout, and motion exactly as shown.

### Homepage

![liseberg Homepage](screenshots/homepage.png)

### Scroll Journey (Cinematic Visual States)

> These screenshots capture the website at different scroll depths. The design changes dramatically as you scroll — each frame shows a different cinematic state. Replicate these exact visual transitions.

#### 0% — Hero / Above the fold

![Scroll 0%](screens/scroll/scroll-000.png)

#### 17% — Mid-page at 17% scroll

![Scroll 17%](screens/scroll/scroll-017.png)

#### 33% — Mid-page at 33% scroll

![Scroll 33%](screens/scroll/scroll-033.png)

#### 50% — Mid-page at 50% scroll

![Scroll 50%](screens/scroll/scroll-050.png)

#### 67% — Mid-page at 67% scroll

![Scroll 67%](screens/scroll/scroll-067.png)

#### 83% — Mid-page at 83% scroll

![Scroll 83%](screens/scroll/scroll-083.png)

#### 100% — Footer / End of page

![Scroll 100%](screens/scroll/scroll-100.png)

> Read `references/DESIGN.md` for full token details. Read `references/ANIMATIONS.md` for motion specs. Read `references/LAYOUT.md` for layout structure. Read `references/COMPONENTS.md` for component patterns.

## Ultra Reference Files

This package includes extended documentation. **Read these files before implementing:**

| File | Contents |
|------|----------|
| `references/DESIGN.md` | Full design system tokens, colors, typography, spacing |
| `references/VISUAL_GUIDE.md` | **START HERE** — Master visual guide with all screenshots embedded |
| `references/ANIMATIONS.md` | CSS keyframes, scroll triggers, motion library stack, video specs |
| `references/LAYOUT.md` | Flex/grid containers, page structure, spacing relationships |
| `references/COMPONENTS.md` | DOM component patterns, HTML structure, class fingerprints |
| `references/INTERACTIONS.md` | Hover/focus states with before/after style diffs |
| `screens/scroll/` | 7 scroll journey screenshots showing cinematic states |

## Design Philosophy

- **Layered depth** — use shadow tokens to create a sense of physical layering. Each elevation level has a specific shadow.
- **Gradient accents** — gradients are used thoughtfully for emphasis, not decoration.
- **Type pairing** — LL Brown Black for body/UI text, LL Brown for headings/display. Never introduce a third typeface.
- **compact density** — 4px base grid. Every dimension is a multiple of 4.
- **neutral palette** — the color temperature runs neutral, matching the sans-serif typography.
- **Expressive motion** — animations are an integral part of the experience. Use spring physics and layout animations.

## Color System

### Core Palette

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Background | `--background` | `#ffffff` | Page/app background |
| Surface | `--surface` | `#f8f1ff` | Cards, panels, modals |
| Text Primary | `--text-primary` | `#0c4433` | Headings, body text |
| Text Muted | `--text-muted` | `#464442` | Captions, placeholders |
| Border | `--border` | `#313a27` | Dividers, card borders |

### Status Colors

| Status | Hex | Use |
|--------|-----|-----|
| Success | `#ecfff3` | Confirmations, positive trends |
| Warning | `#efebd8` | Caution states, pending items |
| Danger | `#ffecec` | Errors, destructive actions |

### Extended Palette

- `#05253f`
- `#d7283d` — Warm accent — hover glow or decorative highlight
- `#4f002f`
- `#e1f5f5` — Light surface or highlight color
- `#00752f`
- `#000000` — Deep background layer or shadow color
- `#000b5e`
- `#544f4b`

## Typography

### Font Stack

- **LL Brown Black** — Heading 1, Heading 2, Heading 3
- **LL Brown** — Body, Caption
- **Mabry Mono** — Code

### Font Sources

```css
@font-face {
  font-family: "LL Brown";
  src: url("fonts/LLBrown-Regular.woff") format("woff");
  font-weight: 400;
}
@font-face {
  font-family: "LL Brown Black";
  src: url("fonts/LLBrownBlack-700.woff") format("woff");
  font-weight: 700;
}
@font-face {
  font-family: "Mabry Mono";
  src: url("fonts/MabryMono-Regular.woff") format("woff");
  font-weight: 400;
}
@font-face {
  font-family: "Value serif";
  src: url("fonts/Valueserif-700.otf") format("opentype");
  font-weight: 700;
}
```

### Type Scale

| Role | Family | Size | Weight |
|------|--------|------|--------|
| Heading 1 | LL Brown Black | 5rem | 700 |
| Heading 2 | LL Brown Black | 80px | 700 |
| Heading 3 | LL Brown Black | 72px | 700 |
| Body | LL Brown | 16px | 400 |
| Caption | LL Brown | 14px | 400 |
| Code | Mabry Mono | 14px | 400 |

### Typography Rules

- Body/UI: **LL Brown Black**, Headings: **LL Brown** — these are the only display fonts
- Max 3-4 font sizes per screen
- Headings: weight 600-700, body: weight 400
- Use color and opacity for text hierarchy, not additional font sizes
- Line height: 1.5 for body, 1.2 for headings

## Spacing & Layout

### Base Grid: 4px

Every dimension (margin, padding, gap, width, height) must be a multiple of **4px**.

### Spacing Scale

`2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24` px

### Spacing as Meaning

| Spacing | Use |
|---------|-----|
| 4-8px | Tight: related items (icon + label, avatar + name) |
| 12-16px | Medium: between groups within a section |
| 24-32px | Wide: between distinct sections |
| 48px+ | Vast: major page section breaks |

### Border Radius

Scale: `.25em, 2px, 3px, 3em, 4px, 5px, 6px, 8px, 10px, 13px, 14px, 16px, 23px, 25px, 32px, 40px, 50px, 100%, 100px`
Default: `13px`

### Container

Max-width: `1024px`, centered with auto margins.

### Breakpoints

| Name | Value |
|------|-------|
| xs | 360px |
| xs | 374px |
| xs | 375px |
| xs | 400px |
| xs | 480px |
| sm | 600px |
| md | 670px |
| md | 708px |
| md | 719px |
| md | 720px |
| lg | 839px |
| lg | 840px |
| lg | 972px |
| lg | 1023px |
| lg | 1024px |
| xl | 1086px |
| xl | 1280px |
| 2xl | 1439px |
| 2xl | 1440px |
| 2xl | 1920px |
| 2xl | 2400px |
| 2xl | 2810px |

Mobile-first: design for small screens, layer on responsive overrides.

## Component Patterns

### Card

```css
.card {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 16px;
  box-shadow: 0 0 5px 2px rgba(0,0,0,0.1);
}
```

```html
<div class="card">
  <h3>Card Title</h3>
  <p>Card content goes here.</p>
</div>
```

### Button

```css
/* Primary */
.btn-primary {
  background: #cccccc;
  color: #0c4433;
  border-radius: 13px;
  padding: 8px 16px;
  font-weight: 500;
  transition: opacity 150ms ease;
}
.btn-primary:hover { opacity: 0.9; }

/* Ghost */
.btn-ghost {
  background: transparent;
  border: 1px solid #313a27;
  color: #0c4433;
  border-radius: 13px;
  padding: 8px 16px;
}
```

```html
<button class="btn-primary">Get Started</button>
<button class="btn-ghost">Learn More</button>
```

### Input

```css
.input {
  background: #ffffff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px 12px;
  color: #0c4433;
  font-size: 14px;
}
.input:focus { border-color: var(--accent); outline: none; }
```

```html
<input class="input" type="text" placeholder="Search..." />
```

### Badge / Chip

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  background: #f8f1ff;
  color: #464442;
}
```

```html
<span class="badge">New</span>
<span class="badge">Beta</span>
```

### Modal / Dialog

```css
.modal-backdrop { background: rgba(0, 0, 0, 0.6); }
.modal {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 100px;
  padding: 24px;
  max-width: 480px;
  width: 90vw;
  box-shadow: 0 5px 10px rgba(0,0,0,0.2);
}
```

```html
<div class="modal-backdrop">
  <div class="modal">
    <h2>Dialog Title</h2>
    <p>Dialog content.</p>
    <button class="btn-primary">Confirm</button>
    <button class="btn-ghost">Cancel</button>
  </div>
</div>
```

### Table

```css
.table { width: 100%; border-collapse: collapse; }
.table th {
  text-align: left;
  padding: 8px 12px;
  font-weight: 500;
  font-size: 12px;
  color: #464442;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #313a27;
}
.table td {
  padding: 12px;
  border-bottom: 1px solid #313a27;
}
```

```html
<table class="table">
  <thead><tr><th>Name</th><th>Status</th><th>Date</th></tr></thead>
  <tbody>
    <tr><td>Item One</td><td>Active</td><td>Jan 1</td></tr>
    <tr><td>Item Two</td><td>Pending</td><td>Jan 2</td></tr>
  </tbody>
</table>
```

### Navigation

```css
.nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #313a27;
}
.nav-link {
  color: #464442;
  padding: 8px 12px;
  border-radius: 13px;
  transition: color 150ms;
}
.nav-link:hover { color: #0c4433; }
```

```html
<nav class="nav">
  <a href="/" class="nav-link active">Home</a>
  <a href="/about" class="nav-link">About</a>
  <a href="/pricing" class="nav-link">Pricing</a>
  <button class="btn-primary" style="margin-left: auto">Get Started</button>
</nav>
```

### Extracted Components

These components were found in the codebase:

**Button** (`html`)

**Card** (`html`)
- Variants: `-only-linked`, `-fluid-width`, `container`, `container__heading`, `container__intro`

**Badge** (`html`)

**List** (`html`)

## Page Structure

The following page sections were detected:

- **Navigation** — Top navigation bar (113 items)
- **Hero** — Hero/banner section with headline and CTAs
- **Features** — Feature/benefit cards grid (50 items)
- **Faq** — FAQ/accordion section
- **Footer** — Page footer with links and info (95 items)

When building pages, follow this section order and structure.

## Animation & Motion

This project uses **expressive motion**. Animations are part of the design language.

### CSS Animations

- `fadeIn`
- `ripple`
- `show-nested-multiple`
- `fadeInNotification`
- `opacityGridAnimation`

### Motion Tokens

- **Duration scale:** `0ms`, `1.5s`, `150ms`, `175ms`, `200ms`, `250ms`, `300ms`, `340ms`, `400ms`, `500ms`, `600ms`, `700ms`, `1500ms`
- **Easing functions:** `cubic-bezier(0.34,1,0.84,1)`, `ease`, `linear`, `ease-out`, `ease-in-out`, `cubic-bezier(0,0,0.5,1)`, `cubic-bezier(0.165,0.84,0.44,1)`, `ease-in`, `cubic-bezier(0.4,0,0.2,1)`
- **Animated properties:** `opacity`

### Motion Guidelines

- **Duration:** Use values from the duration scale above. Short (0ms) for micro-interactions, long (1500ms) for page transitions
- **Easing:** Use `cubic-bezier(0.34,1,0.84,1)` as the default easing curve
- **Direction:** Elements enter from bottom/right, exit to top/left
- **Reduced motion:** Always respect `prefers-reduced-motion` — disable animations when set

## Depth & Elevation

### Shadow Tokens

- Subtle: `0 2px 2px 0 rgba(33,33,33,0.16)`
- Subtle: `0 2px 2px 0 rgba(0,0,0,0.16)`
- Subtle: `0 0 2px rgba(0,0,0,0.3)`
- Subtle: `0px 2px 2px rgba(0,0,0,0.16)`
- Subtle: `0 2px 2px rgba(0,0,0,0.15)`
- Subtle: `0 2px 2px 0#abbbcc`

### Z-Index Scale

`0, 1, 2, 3, 4, 5, 10, 11, 20, 100, 101, 111, 150, 999, 1000, 9999`

Use these exact values — never invent z-index values.

## Anti-Patterns (Never Do)

- **No blur effects** — no backdrop-blur, no filter: blur()
- **No zebra striping** — tables and lists use borders for separation
- **No invented colors** — every hex value must come from the palette above
- **No arbitrary spacing** — every dimension is a multiple of 4px
- **No extra fonts** — only LL Brown Black and LL Brown and Mabry Mono are allowed
- **No arbitrary border-radius** — use the scale: .25em, 2px, 3px, 3em, 4px, 5px, 6px, 8px, 10px, 13px
- **No opacity for disabled states** — use muted colors instead

## Workflow

1. **Read** `references/DESIGN.md` before writing any UI code
2. **Pick colors** from the Color System section — never invent new ones
3. **Set typography** — LL Brown Black, LL Brown, Mabry Mono only, using the type scale
4. **Build layout** on the 4px grid — check every margin, padding, gap
5. **Match components** to patterns above before creating new ones
6. **Apply elevation** — use shadow tokens
7. **Validate** — every value traces back to a design token. No magic numbers.

## Brand Spec

- **Favicon:** `/apple-touch-icon.png`
- **Site URL:** `https://www.liseberg.se`
- **Brand typeface:** LL Brown Black

## Quick Reference

```
Background:     #ffffff
Surface:        #f8f1ff
Text:           #0c4433 / #464442
Accent:         (not extracted)
Border:         #313a27
Font:           LL Brown Black
Spacing:        4px grid
Radius:         13px
Components:     10 detected
```

## When to Trigger

Activate this skill when:
- Creating new components, pages, or visual elements for liseberg
- Writing CSS, Tailwind classes, styled-components, or inline styles
- Building page layouts, templates, or responsive designs
- Reviewing UI code for design consistency
- The user mentions "liseberg" design, style, UI, or theme
- Generating mockups, wireframes, or visual prototypes

---

# Full Reference Files

> Every output file is embedded below. Claude has full design system context from /skills alone.

## Design System Tokens (DESIGN.md)

# liseberg DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: None detected
> Colors: 20 · Fonts: 3 · Components: 10
> Icon library: not detected · State: not detected
> Primary theme: light · Dark mode toggle: no · Motion: expressive

## Visual Reference

**Match this design exactly** — study colors, fonts, spacing, and component shapes before writing any UI code.

![liseberg Homepage](../screenshots/homepage.png)

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a neutral, approachable feel. The light background emphasizes content clarity. Typography pairs **LL Brown** for display/headings with **LL Brown Black** for body text, creating clear visual hierarchy through type contrast. Spacing follows a **4px base grid** (compact density), with scale: 2, 4, 6, 8, 10, 12, 14, 16px. Motion is expressive — spring physics, layout animations, and staggered reveals are part of the visual language.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| background | `#ffffff` | background | Page background, darkest surface |
| surface | `#f8f1ff` | surface | Card and panel backgrounds |
| text-primary | `#0c4433` | text-primary | Headings and body text |
| text-muted | `#464442` | text-muted | Captions, placeholders, secondary info |
| border | `#313a27` | border | Dividers, card borders, outlines |
| danger | `#ffecec` | danger | Error states, destructive actions |
| success | `#ecfff3` | success | Success states, positive indicators |
| warning | `#efebd8` | warning | Warning states, caution indicators |
| info | `#05253f` | info | Informational highlights |
| unknown | `#d7283d` | unknown | Palette color |
| unknown | `#4f002f` | unknown | Palette color |
| unknown | `#e1f5f5` | unknown | Palette color |
| unknown | `#00752f` | unknown | Palette color |
| unknown | `#000000` | unknown | Palette color |
| unknown | `#000b5e` | unknown | Palette color |
| unknown | `#544f4b` | unknown | Palette color |
| unknown | `#fffdea` | unknown | Palette color |
| unknown | `#280c61` | unknown | Palette color |
| unknown | `#e0d1f0` | unknown | Palette color |
| unknown | `#fd9c54` | unknown | Palette color |


---

## 3. Typography Rules

**Font Stack:**
- **LL Brown Black** — Heading 1, Heading 2, Heading 3
- **LL Brown** — Body, Caption
- **Mabry Mono** — Code

**Font Sources:**

```css
@font-face {
  font-family: "LL Brown";
  src: url("fonts/LLBrown-Regular.woff") format("woff");
  font-weight: 400;
}
@font-face {
  font-family: "LL Brown Black";
  src: url("fonts/LLBrownBlack-700.woff") format("woff");
  font-weight: 700;
}
@font-face {
  font-family: "Mabry Mono";
  src: url("fonts/MabryMono-Regular.woff") format("woff");
  font-weight: 400;
}
@font-face {
  font-family: "Value serif";
  src: url("fonts/Valueserif-700.otf") format("opentype");
  font-weight: 700;
}
```

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | LL Brown Black | 5rem | 700 |
| Heading 2 | LL Brown Black | 80px | 700 |
| Heading 3 | LL Brown Black | 72px | 700 |
| Body | LL Brown | 16px | 400 |
| Caption | LL Brown | 14px | 400 |
| Code | Mabry Mono | 14px | 400 |

**Typographic Rules:**
- Limit to 3 font families max per screen
- Use **LL Brown Black** for body/UI text, **LL Brown** for display/headings
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Layout (1)

**Footer** — `html`

### Navigation (1)

**Navigation** — `html`

### Data Display (3)

**Card** — `html`
- Variants: `-only-linked`, `-fluid-width`, `container`, `container__heading`, `container__intro`

**Badge** — `html`

**List** — `html`

### Data Input (2)

**Button** — `html`
- Animation: 

**Input** — `html`
- State: :focus, :placeholder

### Overlay (1)

**Modal** — `html`

### Media (2)

**Image** — `html`

**Icon** — `html`



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24
- **Border radius:** .25em, 2px, 3px, 3em, 4px, 5px, 6px, 8px, 10px, 13px, 14px, 16px, 23px, 25px, 32px, 40px, 50px, 100%, 100px
- **Max content width:** 1024px

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

### Flat — subtle depth hints

- `0 2px 2px 0 rgba(33,33,33,0.16)`
- `0 2px 2px 0 rgba(0,0,0,0.16)`
- `0 0 2px rgba(0,0,0,0.3)`

### Raised — cards, buttons, interactive elements

- `0 0 5px 2px rgba(0,0,0,0.1)`
- `0px 4px 4px 0#043044`
- `0px 1px 4px -1px rgba(0,0,0,0.3)`

### Floating — dropdowns, popovers, modals

- `0 5px 10px rgba(0,0,0,0.2)`
- `0 8px 16px 0 rgba(3,53,76,0.16)`
- `0px 16px 16px 0px rgba(0,0,0,0.16)`

### Overlay — full-screen overlays, top-level dialogs

- `0px 0px 32px 0px black`

### Z-Index Scale

`0, 1, 2, 3, 4, 5, 10, 11, 20, 100, 101, 111, 150, 999, 1000, 9999`



---

## 7. Animation & Motion

This project uses **expressive motion**. Animations are an integral part of the experience.

### CSS Animations

- `@keyframes fadeIn`
- `@keyframes ripple`
- `@keyframes show-nested-multiple`
- `@keyframes fadeInNotification`
- `@keyframes opacityGridAnimation`
- `@keyframes pnlm-mv`
- `@keyframes toTop`
- `@keyframes fromTop`

### Animated Components

- **Button**: 

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#ffffff` as the primary page background
- Pair **LL Brown Black** (body) with **LL Brown** (display) — these are the only allowed fonts
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: .25em, 2px, 3px, 3em, 4px
- Reuse existing components from Section 4 before creating new ones

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't introduce additional font families beyond LL Brown Black and LL Brown and Mabry Mono
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first
- Don't use backdrop-blur or blur effects

### Anti-Patterns (detected from codebase)

- No blur or backdrop-blur effects
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| xs | 360px | css |
| xs | 374px | css |
| xs | 375px | css |
| xs | 400px | css |
| xs | 480px | css |
| sm | 600px | css |
| md | 670px | css |
| md | 708px | css |
| md | 719px | css |
| md | 720px | css |
| lg | 839px | css |
| lg | 840px | css |
| lg | 972px | css |
| lg | 1023px | css |
| lg | 1024px | css |
| xl | 1086px | css |
| xl | 1280px | css |
| 2xl | 1439px | css |
| 2xl | 1440px | css |
| 2xl | 1920px | css |
| 2xl | 2400px | css |
| 2xl | 2810px | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #f8f1ff
Border: 1px solid #313a27
Radius: 13px
Padding: 16px
Font: LL Brown Black
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg var(--accent), text white
Ghost: bg transparent, border #313a27
Padding: 8px 16px
Radius: 13px
Hover: opacity 0.9 or lighter shade
Focus: ring with var(--accent)
```

### Build a Page Layout

```
Background: #ffffff
Max-width: 1024px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #f8f1ff
Label: #464442 (muted, 12px, uppercase)
Value: #0c4433 (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #ffffff
Input border: 1px solid #313a27
Focus: border-color var(--accent)
Label: #464442 12px
Spacing: 16px between fields
Radius: 13px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: LL Brown Black, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```

## Visual Guide — Screenshots (VISUAL_GUIDE.md)

# liseberg — Visual Guide

> Master visual reference. Study every screenshot carefully before implementing any UI.
> Match colors, layout, typography, spacing, and motion states exactly.

## Scroll Journey

The page has cinematic scroll animations. Each screenshot below shows the exact visual state at that scroll depth.
**Replicate these transitions precisely** — the design changes dramatically as you scroll.

### Hero — Above the fold

*Scroll position: 0px of 7132px total*

![Hero — Above the fold](../screens/scroll/scroll-000.png)

### 17% scroll depth

*Scroll position: 1059px of 7132px total*

![17% scroll depth](../screens/scroll/scroll-017.png)

### 33% scroll depth

*Scroll position: 2057px of 7132px total*

![33% scroll depth](../screens/scroll/scroll-033.png)

### 50% scroll depth

*Scroll position: 3116px of 7132px total*

![50% scroll depth](../screens/scroll/scroll-050.png)

### 67% scroll depth

*Scroll position: 4175px of 7132px total*

![67% scroll depth](../screens/scroll/scroll-067.png)

### 83% scroll depth

*Scroll position: 5173px of 7132px total*

![83% scroll depth](../screens/scroll/scroll-083.png)

### Footer — End of page

*Scroll position: 6232px of 7132px total*

![Footer — End of page](../screens/scroll/scroll-100.png)

## Full Page Screenshots

### Liseberg - en värld av upplevelser

*URL: `https://www.liseberg.se`*

![Liseberg - en värld av upplevelser](../screens/pages/home.png)

### Öppettider och program | Liseberg

*URL: `https://www.liseberg.se/kalender/`*

![Öppettider och program | Liseberg](../screens/pages/kalender.png)

### Logga in - Liseberg Konto

*URL: `https://www.liseberg.se/ExternalAccount/Login?returnUrl=https%3A%2F%2Fmitt.liseberg.se%2F`*

![Logga in - Liseberg Konto](../screens/pages/ExternalAccount-Login.png)

### Parkbiljetter & priser | Liseberg

*URL: `https://www.liseberg.se/parken/biljetter-priser/`*

![Parkbiljetter & priser | Liseberg](../screens/pages/parken-biljetter-priser.png)

### Lisebergsparken | Liseberg

*URL: `https://www.liseberg.se/till-lisebergsparken/`*

![Lisebergsparken | Liseberg](../screens/pages/till-lisebergsparken.png)

## Section Screenshots

Clipped sections showing individual components in context.

### Section 2 — `main > div`

*1440×720px*

![Section 2](../screens/sections/home-section-2.png)

### Section 3 — `main > div`

*1440×242px*

![Section 3](../screens/sections/home-section-3.png)

### Section 4 — `main > div`

*1440×454px*

![Section 4](../screens/sections/home-section-4.png)

### Section 2 — `main > div`

*1440×1011px*

![Section 2](../screens/sections/kalender-section-2.png)

### Section 2 — `main > div`

*1440×1200px*

![Section 2](../screens/sections/parken-biljetter-priser-section-2.png)

### Section 4 — `[class*="section"]`

*1440×1200px*

![Section 4](../screens/sections/parken-biljetter-priser-section-4.png)

### Section 2 — `main > div`

*1440×863px*

![Section 2](../screens/sections/till-lisebergsparken-section-2.png)

## Animations & Motion (ANIMATIONS.md)

# Animation Reference

> Cinematic motion design extracted from live DOM. Follow these specs exactly to recreate the experience.

## Motion Technology Stack

Pure CSS animations — no external animation libraries detected.

## Scroll Journey

The page is **7,132px** tall. Each frame below shows what the user sees at that scroll depth.

> **Use these screenshots to understand WHAT animates, WHEN it animates, and HOW it moves.**

### 0% — Top / Hero
Scroll position: 0px

![Scroll 0%](../screens/scroll/scroll-000.png)

### 17% — Opening Section
Scroll position: 1,059px

![Scroll 17%](../screens/scroll/scroll-017.png)

### 33% — First Feature Section
Scroll position: 2,057px

![Scroll 33%](../screens/scroll/scroll-033.png)

### 50% — Mid-Page
Scroll position: 3,116px

![Scroll 50%](../screens/scroll/scroll-050.png)

### 67% — Lower Content
Scroll position: 4,175px

![Scroll 67%](../screens/scroll/scroll-067.png)

### 83% — Near Footer
Scroll position: 5,173px

![Scroll 83%](../screens/scroll/scroll-083.png)

### 100% — Bottom / Footer
Scroll position: 6,232px

![Scroll 100%](../screens/scroll/scroll-100.png)

## CSS Keyframes (45 extracted)

### `@keyframes countDownFadeIn`

Duration: `0.7s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.count-down-fade-in`, `.count-down__animated-card--show`

```css
@keyframes countDownFadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes cb-score-rating-d271f0eb`

Duration: `0.4s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-score-rating[data-v-d271f0eb] span::before`, `.cb-score-rating[data-v-d271f0eb] span::after`

```css
@keyframes cb-score-rating-d271f0eb {
  0%, 50% {
    width: 0px;
    opacity: 0;
  }
}
```

> Opacity fade · Dimension expand/collapse

### `@keyframes cb-dialog-fade-in-d4b4adbd`

Duration: `0.3s` · Easing: `ease-in` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.cb-dialog[open][data-v-d4b4adbd]::backdrop`, `[data-v-d4b4adbd] .cb-dialog__close`

```css
@keyframes cb-dialog-fade-in-d4b4adbd {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes cb-dialog-fade-in-9c53922f`

Duration: `0.3s` · Easing: `ease-in` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.cb-dialog[open][data-v-9c53922f]::backdrop`, `[data-v-9c53922f] .cb-dialog__close`

```css
@keyframes cb-dialog-fade-in-9c53922f {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes cb-score-rating-d271f0eb`

Duration: `0.4s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-score-rating[data-v-d271f0eb] span::before`, `.cb-score-rating[data-v-d271f0eb] span::after`

```css
@keyframes cb-score-rating-d271f0eb {
  0%, 50% {
    width: 0px;
    opacity: 0;
  }
}
```

> Opacity fade · Dimension expand/collapse

### `@keyframes imboxFadeUp`

Duration: `0.25s` · Easing: `cubic-bezier(0.4, 0, 0.2, 1)` · Iteration: `1`

Used by: `#oFRAME_FRAMECOMMS_75663_00205 .imbox-frame.imbox-show:not(.imbox-notification)`, `#oFRAME_FRAMECOMMS_75663_00205 .imbox-frame.imbox-show-proactive:not(.imbox-noti`

```css
@keyframes imboxFadeUp {
  0% {
    opacity: 0;
    transform: translateY(50px);
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
  }
}
```

> Fade + motion enter animation

### `@keyframes imboxFadeUp`

Duration: `0.25s` · Easing: `cubic-bezier(0.4, 0, 0.2, 1)` · Iteration: `1`

Used by: `#oFRAME_FRAMECOMMS_75663_00205 .imbox-frame.imbox-show:not(.imbox-notification)`, `#oFRAME_FRAMECOMMS_75663_00205 .imbox-frame.imbox-show-proactive:not(.imbox-noti`

```css
@keyframes imboxFadeUp {
  0% {
    opacity: 0;
    transform: translateY(50px);
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
  }
}
```

> Fade + motion enter animation

### `@keyframes imboxFadeDown`

Duration: `0.15s` · Easing: `cubic-bezier(0.4, 0, 0.2, 1)` · Iteration: `1` · Fill: `both`

Used by: `#oFRAME_FRAMECOMMS_75663_00205 .imbox-frame.imbox-leave:not(.imbox-notification)`, `#oFRAME_FRAMECOMMS_75663_00205 .imbox-frame.imbox-notification.imbox-leave`

```css
@keyframes imboxFadeDown {
  0% {
    opacity: 1;
    transform: translateY(0px);
  }
  100% {
    opacity: 0;
    transform: translateY(20px);
  }
}
```

> Fade + motion enter animation

### `@keyframes fadeIn`

Duration: `0.5s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.fade-in`

```css
@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(5px);
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
  }
}
```

> Fade + motion enter animation

### `@keyframes ripple`

Duration: `0.35s` · Easing: `linear` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.button__ripple--animate`

```css
@keyframes ripple {
  100% {
    opacity: 0;
    transform: scale(2.5);
  }
}
```

> Fade + motion enter animation

### `@keyframes show-nested-multiple`

Duration: `200ms` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.accommodation-booking__multiple .accommodation-booking__multiple`

```css
@keyframes show-nested-multiple {
  0% {
    opacity: 0;
    transform: translateY(-1em);
  }
}
```

> Fade + motion enter animation

### `@keyframes fadeInNotification`

Duration: `0.8s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.card-grid__notification`

```css
@keyframes fadeInNotification {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes opacityGridAnimation`

Duration: `0.5s` · Easing: `ease` · Delay: `0.3s` · Iteration: `1` · Fill: `forwards`

Used by: `.card-grid__list-item .card__figure`

```css
@keyframes opacityGridAnimation {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes pnlm-mv`

Duration: `1.5s` · Easing: `linear` · Iteration: `infinite`

Used by: `.pnlm-loading`

```css
@keyframes pnlm-mv {
  0% {
    left: 0px;
    top: 0px;
  }
  25% {
    left: 10px;
    top: 0px;
  }
  50% {
    left: 10px;
    top: 10px;
  }
  75% {
    left: 0px;
    top: 10px;
  }
  100% {
    left: 0px;
    top: 0px;
  }
}
```

### `@keyframes toTop`

Duration: `0.5s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.header-nav-secondary--to-top`

```css
@keyframes toTop {
  0% {
    transform: translateY(0px);
  }
  99% {
    transform: translateY(-100%);
    position: fixed;
  }
  100% {
    transform: translateY(0px);
    position: absolute;
  }
}
```

> Transform/motion animation

### `@keyframes fromTop`

Duration: `0.5s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.header-nav-secondary--from-top`

```css
@keyframes fromTop {
  0% {
    position: absolute;
  }
  1% {
    transform: translateY(-100%);
    position: fixed;
  }
  100% {
    transform: translateY(0px);
  }
}
```

> Transform/motion animation

### `@keyframes fold`

Duration: `0.6s` · Easing: `cubic-bezier(0.455, 0.03, 0.515, 0.955)` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.count-down__animated-card--fold`

```css
@keyframes fold {
  0% {
    transform: rotateX(0deg);
  }
  100% {
    transform: rotateX(-180deg);
  }
}
```

> Transform/motion animation

### `@keyframes unfold`

Duration: `0.6s` · Easing: `cubic-bezier(0.455, 0.03, 0.515, 0.955)` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.count-down__animated-card--unfold`

```css
@keyframes unfold {
  0% {
    transform: rotateX(180deg);
  }
  100% {
    transform: rotateX(0deg);
  }
}
```

> Transform/motion animation

### `@keyframes animateSearchResult`

Duration: `0.4s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.search-result__list-item`

```css
@keyframes animateSearchResult {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes cb-dialog-shake-d4b4adbd`

Duration: `0.82s` · Easing: `cubic-bezier(0.36, 0.07, 0.19, 0.97)` · Delay: `0s` · Iteration: `1` · Fill: `both`

Used by: `.cb-dialog .cb-dialog--shake[data-v-d4b4adbd]`

```css
@keyframes cb-dialog-shake-d4b4adbd {
  10%, 90% {
    transform: translate3d(-1px, 0px, 0px);
  }
  20%, 80% {
    transform: translate3d(2px, 0px, 0px);
  }
  30%, 50%, 70% {
    transform: translate3d(-4px, 0px, 0px);
  }
  40%, 60% {
    transform: translate3d(4px, 0px, 0px);
  }
}
```

> Transform/motion animation

### `@keyframes cb-dialog__close-text-in-d4b4adbd`

Duration: `0.4s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `[data-v-d4b4adbd] .cb-dialog__close:hover .cb--text`

```css
@keyframes cb-dialog__close-text-in-d4b4adbd {
  0% {
    width: 0px;
    padding-right: 0px;
    color: transparent;
  }
  100% {
    width: 100%;
    padding-right: 15px;
    color: rgb(255, 255, 255);
  }
}
```

> Dimension expand/collapse · Text color shift

### `@keyframes cb-dialog__close-text-out-d4b4adbd`

Duration: `0.4s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `[data-v-d4b4adbd] .cb-dialog__close .cb--text`

```css
@keyframes cb-dialog__close-text-out-d4b4adbd {
  0% {
    width: 100%;
    padding-right: 15px;
    color: rgb(255, 255, 255);
  }
  100% {
    width: 0px;
    padding-right: 0px;
    color: transparent;
  }
}
```

> Dimension expand/collapse · Text color shift

### `@keyframes cb-dialog-enter-d4b4adbd`

Duration: `0.3s` · Easing: `cubic-bezier(0.075, 0.82, 0.165, 1)` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-dialog[open][data-v-d4b4adbd]`

```css
@keyframes cb-dialog-enter-d4b4adbd {
  0% {
    transform: translate3d(0px, 200px, 0px);
    opacity: 0;
  }
  100% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-leave-d4b4adbd`

Duration: `0.3s` · Easing: `cubic-bezier(0.55, 0.055, 0.675, 0.19)` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-dialog.cb-dialog--leave[data-v-d4b4adbd]`

```css
@keyframes cb-dialog-leave-d4b4adbd {
  0% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
  100% {
    transform: translate3d(0px, 200px, 0px);
    opacity: 0;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-out-d4b4adbd`

Duration: `0.3s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-dialog.cb-dialog--leave[data-v-d4b4adbd]::backdrop`

```css
@keyframes cb-dialog-fade-out-d4b4adbd {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

> Opacity fade

### `@keyframes cb-dialog-shake-9c53922f`

Duration: `0.82s` · Easing: `cubic-bezier(0.36, 0.07, 0.19, 0.97)` · Delay: `0s` · Iteration: `1` · Fill: `both`

Used by: `.cb-dialog .cb-dialog--shake[data-v-9c53922f]`

```css
@keyframes cb-dialog-shake-9c53922f {
  10%, 90% {
    transform: translate3d(-1px, 0px, 0px);
  }
  20%, 80% {
    transform: translate3d(2px, 0px, 0px);
  }
  30%, 50%, 70% {
    transform: translate3d(-4px, 0px, 0px);
  }
  40%, 60% {
    transform: translate3d(4px, 0px, 0px);
  }
}
```

> Transform/motion animation

### `@keyframes cb-dialog__close-text-in-9c53922f`

Duration: `0.4s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `[data-v-9c53922f] .cb-dialog__close:hover .cb--text`

```css
@keyframes cb-dialog__close-text-in-9c53922f {
  0% {
    width: 0px;
    padding-right: 0px;
    color: transparent;
  }
  100% {
    width: 100%;
    padding-right: 15px;
    color: rgb(255, 255, 255);
  }
}
```

> Dimension expand/collapse · Text color shift

### `@keyframes cb-dialog__close-text-out-9c53922f`

Duration: `0.4s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `[data-v-9c53922f] .cb-dialog__close .cb--text`

```css
@keyframes cb-dialog__close-text-out-9c53922f {
  0% {
    width: 100%;
    padding-right: 15px;
    color: rgb(255, 255, 255);
  }
  100% {
    width: 0px;
    padding-right: 0px;
    color: transparent;
  }
}
```

> Dimension expand/collapse · Text color shift

### `@keyframes cb-dialog-enter-9c53922f`

Duration: `0.3s` · Easing: `cubic-bezier(0.075, 0.82, 0.165, 1)` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-dialog[open][data-v-9c53922f]`

```css
@keyframes cb-dialog-enter-9c53922f {
  0% {
    transform: translate3d(0px, 200px, 0px);
    opacity: 0;
  }
  100% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-leave-9c53922f`

Duration: `0.3s` · Easing: `cubic-bezier(0.55, 0.055, 0.675, 0.19)` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-dialog.cb-dialog--leave[data-v-9c53922f]`

```css
@keyframes cb-dialog-leave-9c53922f {
  0% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
  100% {
    transform: translate3d(0px, 200px, 0px);
    opacity: 0;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-out-9c53922f`

Duration: `0.3s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.cb-dialog.cb-dialog--leave[data-v-9c53922f]::backdrop`

```css
@keyframes cb-dialog-fade-out-9c53922f {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

> Opacity fade

### `@keyframes fade-06a2ca85`

Easing: `ease` · Fill: `forwards`

Used by: `.vgo-slideshow__slide.active[data-v-06a2ca85]`

```css
@keyframes fade-06a2ca85 {
  0% {
    opacity: 0.1;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes zoom-out-06a2ca85`

Easing: `ease-in-out` · Fill: `forwards`

Used by: `.vgo-slideshow__slide.active .vgo-slideshow__cell[data-v-06a2ca85]`

```css
@keyframes zoom-out-06a2ca85 {
  0% {
    transform: scale3d(1.25, 1.25, 1.25);
  }
  100% {
    transform: scale3d(1, 1, 1);
  }
}
```

> Transform/motion animation

### `@keyframes marker`

Duration: `1s` · Easing: `ease` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `#CookieConsent .cookie-popup .actions > div #cc-b-custom.accentuated`

```css
@keyframes marker {
  100% {
    box-shadow: rgba(255, 255, 255, 0) 0px 0px 0px 0.224em;
  }
  35%, 45% {
    box-shadow: 0 0 0 0.224em var(--color_primary);
  }
  100% {
    box-shadow: rgba(255, 255, 255, 0) 0px 0px 0px 0.224em;
  }
}
```

> Dimension expand/collapse · Shadow pulse/glow effect

### `@keyframes test`

```css
@keyframes test {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(0deg);
  }
}
```

> Transform/motion animation

### `@keyframes cb-dialog-fade-out-left-d4b4adbd`

```css
@keyframes cb-dialog-fade-out-left-d4b4adbd {
  0% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
  100% {
    transform: translate3d(-50px, 0px, 0px);
    opacity: 0;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-out-right-d4b4adbd`

```css
@keyframes cb-dialog-fade-out-right-d4b4adbd {
  0% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
  100% {
    transform: translate3d(50px, 0px, 0px);
    opacity: 0;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-in-right-d4b4adbd`

```css
@keyframes cb-dialog-fade-in-right-d4b4adbd {
  0% {
    transform: translate3d(50px, 0px, 0px);
    opacity: 0;
  }
  100% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-in-left-d4b4adbd`

```css
@keyframes cb-dialog-fade-in-left-d4b4adbd {
  0% {
    transform: translate3d(-50px, 0px, 0px);
    opacity: 0;
  }
  100% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-summary-height-d4b4adbd`

```css
@keyframes cb-dialog-summary-height-d4b4adbd {
  0% {
    height: 0px;
    opacity: 0;
  }
  100% {
    height: calc(-140px + 100vh);
    opacity: 1;
  }
}
```

> Opacity fade · Dimension expand/collapse

### `@keyframes cb-dialog-fade-out-left-9c53922f`

```css
@keyframes cb-dialog-fade-out-left-9c53922f {
  0% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
  100% {
    transform: translate3d(-50px, 0px, 0px);
    opacity: 0;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-out-right-9c53922f`

```css
@keyframes cb-dialog-fade-out-right-9c53922f {
  0% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
  100% {
    transform: translate3d(50px, 0px, 0px);
    opacity: 0;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-in-right-9c53922f`

```css
@keyframes cb-dialog-fade-in-right-9c53922f {
  0% {
    transform: translate3d(50px, 0px, 0px);
    opacity: 0;
  }
  100% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-fade-in-left-9c53922f`

```css
@keyframes cb-dialog-fade-in-left-9c53922f {
  0% {
    transform: translate3d(-50px, 0px, 0px);
    opacity: 0;
  }
  100% {
    transform: translate3d(0px, 0px, 0px);
    opacity: 1;
  }
}
```

> Fade + motion enter animation

### `@keyframes cb-dialog-summary-height-9c53922f`

```css
@keyframes cb-dialog-summary-height-9c53922f {
  0% {
    height: 0px;
    opacity: 0;
  }
  100% {
    height: calc(-140px + 100vh);
    opacity: 1;
  }
}
```

> Opacity fade · Dimension expand/collapse

## Global Transition Declarations

These `transition` values were extracted from CSS rules across the site:

```css
transition: revert;
transition: initial;
transition: opacity 0.2s;
transition: transform 0.2s cubic-bezier(0.34, 1, 0.84, 1);
transition: opacity 200ms, visibility 200ms, transform 200ms;
transition: color 200ms linear;
transition: background 0.15s ease-out, color 0.2s ease-out;
transition: opacity 600ms;
transition: background 200ms;
transition: opacity 500ms, visibility 500ms;
transition: opacity 400ms ease-out;
transition: opacity 0.3s;
```

## How to Recreate This Motion Design

### Step 2 — Scroll-Reveal Pattern

Elements that animate into view follow this pattern:

```css
/* Initial hidden state */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Step 3 — Key Motion Principles

- **Duration scale:** `0.2s` · `200ms` — use these values, never invent new durations
- **Always add** `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`

### Step 4 — Scroll Journey Reference

Match what happens at each scroll position:

- **0%** (`0px`) → `screens/scroll/scroll-000.png`
- **17%** (`1059px`) → `screens/scroll/scroll-017.png`
- **33%** (`2057px`) → `screens/scroll/scroll-033.png`
- **50%** (`3116px`) → `screens/scroll/scroll-050.png`
- **67%** (`4175px`) → `screens/scroll/scroll-067.png`
- **83%** (`5173px`) → `screens/scroll/scroll-083.png`
- **100%** (`6232px`) → `screens/scroll/scroll-100.png`

## Layout & Grid (LAYOUT.md)

# Layout Reference

> Auto-extracted from live DOM. Use this to understand how the site is structured spatially.

## Spacing System

**Base grid:** 4px

**Scale:** `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30` px

| Spacing | Semantic Use |
|---------|-------------|
| 4px | Tight — within a component |
| 8px | Medium — between sibling items |
| 16px | Wide — between sections |
| 32px | Vast — major section breaks |

## Flex Layouts

| Element | Direction | Justify | Align | Gap | Children |
|---------|-----------|---------|-------|-----|----------|
| `div.package-card-container` | column | center | center | — | 4 |
| `div.hero__inner.hero__inner--fixed-height` | row | center | end | — | 3 |
| `a.button.package-card-container__more-offers-btn` | row | center | center | 8px | 1 |
| `div.footer-container__grid.footer-container__grid--links` | row | — | — | — | 4 |
| `div.container.footer-container__container` | row | center | — | — | 1 |
| `ul.card-carousel__items` | row | — | — | — | 14 |
| `div.grid-container.grid-container--gutter` | row | — | — | — | 4 |

## Grid Layouts

| Element | Template Columns | Gap | Children |
|---------|-----------------|-----|----------|
| `div.package-card-container__card-grid.package-card-container` | `590px 590px` | 24px | 2 |

## Structural Containers

### `<header>` (`header#header.header`)

```
display:          block
children:         1
```

### `<main>` 

```
display:          block
children:         11
```

### `<footer>` (`footer.footer-container`)

```
display:          block
children:         3
```

## Layout Rules

- **Container max-width:** `1920px` — always center with `margin: auto`
- Primary layout system: **Flexbox**
- Secondary layout system: **CSS Grid** (used for card grids and multi-column layouts)
- Every spacing value must be a multiple of **4px**
- Never use arbitrary margin/padding values outside the spacing scale

## Component Patterns (COMPONENTS.md)

# Component Reference

> Repeated DOM patterns detected by structural analysis. Each component appeared 3+ times.

## Detected Components

| Component | Category | Instances | Key Classes |
|-----------|----------|-----------|-------------|
| **Card  Figure** | card | 18× | `.card__figure` |
| **Latest News Carousel  Item** | card | 7× | `.latest-news-carousel__item` |
| **Latest News Card  Media** | card | 7× | `.latest-news-card__media` |
| **Latest News Card  Image** | card | 7× | `.latest-news-card__image` |
| **Latest News Card  Content** | card | 7× | `.latest-news-card__content` |
| **Container** | unknown | 6× | `.container` |
| **Container  Centered** | unknown | 4× | `.container--centered`, `.container--padding`, `.container--thin` |
| **Grid Container  Item** | card | 4× | `.grid-container__item`, `.grid-container__item--quarter` |
| **Card  Box** | card | 4× | `.card__box`, `.card__box--with-arrow` |
| **Card  Link Label** | card | 4× | `.card__link-label` |
| **Button** | button | 3× | `.button` |
| **Header  Menu  Link** | unknown | 3× | `.header__menu__link` |
| **Button** | button | 3× | `.button`, `.button--light`, `.button--solid` |
| **Highlighted Carousel  List Item** | card | 3× | `.highlighted-carousel__list-item` |
| **Promo  Figure** | unknown | 3× | `.promo__figure` |
| **Promo  Inner** | unknown | 3× | `.promo__inner` |
| **Promo  Link** | unknown | 3× | `.promo__link` |
| **Promo  Box** | unknown | 3× | `.promo__box` |
| **Promo  Heading** | unknown | 3× | `.promo__heading` |
| **Card** | card | 3× | `.card`, `.card--fluid-width`, `.card--only-linked` |

## Cards

### Card  Figure

**Instances found:** 18

**CSS classes:** `.card__figure`

**HTML structure:**

```html
<figure class="card__figure"> <img src="/optimized/default-card/ba17c989/globalassets/evenemang/temahelger/gin-glod/2026/ginglod_event_webb_innehall_2026.jpg" alt="Gin &amp; Glöd 29–30 maj"> </figure>
```

**Base styles (from design tokens):**

```css
.card__figure {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Latest News Carousel  Item

**Instances found:** 7

**CSS classes:** `.latest-news-carousel__item`

**HTML structure:**

```html
<div class="latest-news-carousel__item"> <a href="/parken/evenemang/live-pa-liseberg/lilla-live/" class="latest-news-card theme-solid-color-ljuslila"> <figure class="latest-news-card__media"> <img src="/3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg" class="latest-news-card__image" alt="nyhet lilla live familjekonsert dolly style scarlet" srcset="/3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg?preset=small 400w, /3ff32534/globalassets/evenemang/stora-scenen/dolly-
```

**Base styles (from design tokens):**

```css
.latest-news-carousel__item {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Latest News Card  Media

**Instances found:** 7

**CSS classes:** `.latest-news-card__media`

**HTML structure:**

```html
<figure class="latest-news-card__media"> <img src="/3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg" class="latest-news-card__image" alt="nyhet lilla live familjekonsert dolly style scarlet" srcset="/3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg?preset=small 400w, /3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg?preset=large 1080w, /3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lil
```

**Base styles (from design tokens):**

```css
.latest-news-card__media {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Latest News Card  Image

**Instances found:** 7

**CSS classes:** `.latest-news-card__image`

**HTML structure:**

```html
<img src="/3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg" class="latest-news-card__image" alt="nyhet lilla live familjekonsert dolly style scarlet" srcset="/3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg?preset=small 400w, /3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.jpg?preset=large 1080w, /3ff32534/globalassets/evenemang/stora-scenen/dolly-style-scarlet/lilla-live_artistslapp_01_senaste-nytt_2026.
```

**Base styles (from design tokens):**

```css
.latest-news-card__image {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Latest News Card  Content

**Instances found:** 7

**CSS classes:** `.latest-news-card__content`

**HTML structure:**

```html
<div class="latest-news-card__content"> <ul class="tags latest-news-card__tags"> <li class="tags__item">Nyhet</li> <li class="tags__item">Lilla Live</li> </ul> <h3 class="latest-news-card__title">Lilla Live! Sommarens nya familjefest</h3> <p class="latest-news-card__body">I sommar får söndagarna nytt liv med mus…</p> </div>
```

**Base styles (from design tokens):**

```css
.latest-news-card__content {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Grid Container  Item

**Instances found:** 4

**CSS classes:** `.grid-container__item` `.grid-container__item--quarter`

**HTML structure:**

```html
<div class="grid-container__item grid-container__item--quarter"> <a href="/parken/evenemang/alla/gin-glod/" class="card card--only-linked card--fluid-width theme-gronska-himmel-prickar"> <figure class="card__figure"> <img src="/optimized/default-card/ba17c989/globalassets/evenemang/temahelger/gin-glod/2026/ginglod_event_webb_innehall_2026.jpg" alt="Gin &amp; Glöd 29–30 maj"> </figure> <div class="card__box card__box--with-arrow"> <span class="card__link-label">Gin &amp; Glöd 29–30 maj</span> <span class="card__link card__link--arrow"> <svg width="33" height="33" viewBox="0 0 33 33" fill="none"
```

**Base styles (from design tokens):**

```css
.grid-container__item {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Card  Box

**Instances found:** 4

**CSS classes:** `.card__box` `.card__box--with-arrow`

**HTML structure:**

```html
<div class="card__box card__box--with-arrow"> <span class="card__link-label">Gin &amp; Glöd 29–30 maj</span> <span class="card__link card__link--arrow"> <svg width="33" height="33" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M3.33314 15.3155H26.6043L18.902 7.46773L20.0609 6.28662L29.9987 16.4133L28.8398 17.5944L28.7565 17.51L20.2265 26.2866L19.0676 25.1055L27.0176 17.0044H3.33203L3.33314 15.3155Z" fill="#0C4433"></path> </svg> </span> </div>
```

**Base styles (from design tokens):**

```css
.card__box {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Card  Link Label

**Instances found:** 4

**CSS classes:** `.card__link-label`

**HTML structure:**

```html
<span class="card__link-label">Gin &amp; Glöd 29–30 maj</span>
```

**Base styles (from design tokens):**

```css
.card__link-label {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Highlighted Carousel  List Item

**Instances found:** 3

**CSS classes:** `.highlighted-carousel__list-item`

**HTML structure:**

```html
<li class="highlighted-carousel__list-item"> <div class="promo theme-gronska-sockervadd-rander promo--small promo--boxed" id="hero-grid-99814-highlighted_carousel-promo-99816"> <style> #hero-grid-99814-highlighted_carousel-p…</style> <figure class="promo__figure" id="hero-grid-99814-highlighted_carousel-promo-99816-promo-figure"> </figure> <div class="promo__inner"> <a href="/parken/" class="promo__link"> <div class="promo__box"> <div> <h3 class="promo__heading">Lisebergsparken</h3> </div> <div class="promo__link-label"> <div class="promo__link-label-text"></div> <div class="promo__link-label-
```

**Base styles (from design tokens):**

```css
.highlighted-carousel__list-item {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

### Card

**Instances found:** 3

**CSS classes:** `.card` `.card--fluid-width` `.card--only-linked`

**HTML structure:**

```html
<a href="/moten-event/grupp-skolresor/" class="card card--only-linked card--fluid-width"> <figure class="card__figure"> <img src="/optimized/default-card/8600e974/globalassets/evenemang/i-parken/premiar-2024/puff_web-_premiar_620x770.jpg" alt="Dags att boka skolresa?"> </figure> <div class="card__box card__box--with-arrow"> <span class="card__link-label">Dags att boka skolresa?</span> <span class="card__link card__link--arrow"> <svg width="33" height="33" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M3.33314 15.3155H26.6043L18.902 7.46773L20.0609 6.28662L29.9987
```

**Base styles (from design tokens):**

```css
.card {
  background: #f8f1ff;
  border: 1px solid #313a27;
  border-radius: 13px;
  padding: 8px;
}```

## Buttons

### Button

**Instances found:** 3

**CSS classes:** `.button`

**HTML structure:**

```html
<a href="/parken/biljetter-priser/" class="button"><span class="button__ripple"></span>Biljetter</a>
```

**Base styles (from design tokens):**

```css
.button {
  color: #0c4433;
  border-radius: 13px;
  padding: 4px 8px;
  cursor: pointer;
}```

### Button

**Instances found:** 3

**CSS classes:** `.button` `.button--light` `.button--solid` `.skip-to-content`

**HTML structure:**

```html
<a href="#a7fed3f3-9f15-4577-b7a0-d3db6694633f" class="skip-to-content button button--solid button--light"><span class="button__ripple"></span>Hoppa över lista</a>
```

**Base styles (from design tokens):**

```css
.button {
  color: #0c4433;
  border-radius: 13px;
  padding: 4px 8px;
  cursor: pointer;
}```

## Other Components

### Container

**Instances found:** 6

**CSS classes:** `.container`

**HTML structure:**

```html
<div class="container" id="segment-99814"> <div class="highlighted-carousel highlighted-carousel--newsite-style" id="carousel-99814"> <a href="#a7fed3f3-9f15-4577-b7a0-d3db6694633f" class="skip-to-content button button--solid button--light"><span class="button__ripple"></span>Hoppa över lista</a> <div class="highlighted-carousel__container js-highlighted-carousel"> <ul class="highlighted-carousel__list" style="transform: translate3d(0px, 0px, 0px);"><li class="highlighted-carousel__list-item"> <div class="promo theme-gronska-sockervadd-rander promo--small promo--boxed" id="hero-grid-99814-high
```

**Base styles (from design tokens):**

```css
.container {
  background: #f8f1ff;
  padding: 4px;
}```

### Container  Centered

**Instances found:** 4

**CSS classes:** `.container--centered` `.container--padding` `.container--thin`

**HTML structure:**

```html
<div class="container--thin container--centered container--padding"> <div class="rte-content"> <h2 class="heading1 heading2" style="margin-top: 0px; text-align: center;">Upptäck en värld av upplevelser</h2> <p class="preamble" style="text-align: center;">Hos oss på Liseberg har människor mötts,…</p> </div> </div>
```

**Base styles (from design tokens):**

```css
.container--centered {
  background: #f8f1ff;
  padding: 4px;
}```

### Header  Menu  Link

**Instances found:** 3

**CSS classes:** `.header__menu__link`

**HTML structure:**

```html
<a href="/till-lisebergsparken/" class="header__menu__link">Parken</a>
```

**Base styles (from design tokens):**

```css
.header__menu__link {
  background: #f8f1ff;
  padding: 4px;
}```

### Promo  Figure

**Instances found:** 3

**CSS classes:** `.promo__figure`

**HTML structure:**

```html
<figure class="promo__figure" id="hero-grid-99814-highlighted_carousel-promo-99816-promo-figure"> </figure>
```

**Base styles (from design tokens):**

```css
.promo__figure {
  background: #f8f1ff;
  padding: 4px;
}```

### Promo  Inner

**Instances found:** 3

**CSS classes:** `.promo__inner`

**HTML structure:**

```html
<div class="promo__inner"> <a href="/parken/" class="promo__link"> <div class="promo__box"> <div> <h3 class="promo__heading">Lisebergsparken</h3> </div> <div class="promo__link-label"> <div class="promo__link-label-text"></div> <div class="promo__link-label-icon"></div> </div> </div> </a> </div>
```

**Base styles (from design tokens):**

```css
.promo__inner {
  background: #f8f1ff;
  padding: 4px;
}```

### Promo  Link

**Instances found:** 3

**CSS classes:** `.promo__link`

**HTML structure:**

```html
<a href="/parken/" class="promo__link"> <div class="promo__box"> <div> <h3 class="promo__heading">Lisebergsparken</h3> </div> <div class="promo__link-label"> <div class="promo__link-label-text"></div> <div class="promo__link-label-icon"></div> </div> </div> </a>
```

**Base styles (from design tokens):**

```css
.promo__link {
  background: #f8f1ff;
  padding: 4px;
}```

### Promo  Box

**Instances found:** 3

**CSS classes:** `.promo__box`

**HTML structure:**

```html
<div class="promo__box"> <div> <h3 class="promo__heading">Lisebergsparken</h3> </div> <div class="promo__link-label"> <div class="promo__link-label-text"></div> <div class="promo__link-label-icon"></div> </div> </div>
```

**Base styles (from design tokens):**

```css
.promo__box {
  background: #f8f1ff;
  padding: 4px;
}```

### Promo  Heading

**Instances found:** 3

**CSS classes:** `.promo__heading`

**HTML structure:**

```html
<h3 class="promo__heading">Lisebergsparken</h3>
```

**Base styles (from design tokens):**

```css
.promo__heading {
  background: #f8f1ff;
  padding: 4px;
}```

## Component Rules

- Match class names exactly from the patterns above
- Each component instance must be visually identical to others of its type
- Do not add extra wrappers or change the DOM structure
- Use `#313a27` for all dividers within components

## Interactions & States (INTERACTIONS.md)

# Interaction Reference

> Micro-interactions extracted from live DOM. Recreate these exactly for authentic feel.

## Coverage

| Component Type | Count | States Captured |
|----------------|-------|----------------|
| Button | 3 | default, hover, focus |
| Link | 3 | default, focus |
| Input | 2 | default, hover, focus |

## Transition System

These transition declarations were extracted from interactive elements:

```css
transition: all;
```

Apply these to all interactive elements. Never invent new durations or easings.

## Button Interactions

### Button 1 — `Sök`

**States:**

- Default: `../screens/states/button-1-default.png`
- Hover: `../screens/states/button-1-hover.png`
- Focus: `../screens/states/button-1-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

### Button 2 — `MENY`

**States:**

- Default: `../screens/states/button-2-default.png`
- Hover: `../screens/states/button-2-hover.png`
- Focus: `../screens/states/button-2-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

### Button 3 — `button`

**States:**

- Default: `../screens/states/button-3-default.png`
- Hover: `../screens/states/button-3-hover.png`
- Focus: `../screens/states/button-3-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

## Link Interactions

### Link 1 — `a`

**States:**

- Default: `../screens/states/link-1-default.png`
- Focus: `../screens/states/link-1-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

### Link 2 — `Kalender`

**States:**

- Default: `../screens/states/link-2-default.png`
- Focus: `../screens/states/link-2-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

### Link 3 — `Varukorg`

**States:**

- Default: `../screens/states/link-3-default.png`
- Focus: `../screens/states/link-3-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

## Input Interactions

### Input 1 — `checkbox`

**States:**

- Default: `../screens/states/input-1-default.png`
- Hover: `../screens/states/input-1-hover.png`
- Focus: `../screens/states/input-1-focus.png`

**On focus:**

```css
/* box-shadow: none → */ box-shadow: rgba(0, 0, 0, 0.5) 0px 0px 0px 4.2px;
/* outline: rgb(0, 0, 0) none 3px → */ outline: rgb(255, 255, 255) solid 2px;
/* outline-color: rgb(0, 0, 0) → */ outline-color: rgb(255, 255, 255);
/* transition: all → */ transition: 0.1s linear;
```

**Transition:** `all`

### Input 2 — `checkbox`

**States:**

- Default: `../screens/states/input-2-default.png`
- Hover: `../screens/states/input-2-hover.png`
- Focus: `../screens/states/input-2-focus.png`

**On focus:**

```css
/* box-shadow: none → */ box-shadow: rgba(0, 0, 0, 0.5) 0px 0px 0px 4.2px;
/* outline: rgb(0, 0, 0) none 3px → */ outline: rgb(255, 255, 255) solid 2px;
/* outline-color: rgb(0, 0, 0) → */ outline-color: rgb(255, 255, 255);
/* transition: all → */ transition: 0.1s linear;
```

**Transition:** `all`

## Interaction Rules

- Focus states use **outline** (not box-shadow) — always match the extracted focus ring
- Always respect `prefers-reduced-motion` — set all transitions to `0s` when enabled

## Design Tokens — JSON Files

### tokens/colors.json
```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "core": {
    "text-primary": {
      "value": "#0c4433",
      "role": "text-primary"
    },
    "background": {
      "value": "#ffffff",
      "role": "background"
    },
    "border": {
      "value": "#313a27",
      "role": "border"
    },
    "surface": {
      "value": "#f8f1ff",
      "role": "surface"
    },
    "text-muted": {
      "value": "#464442",
      "role": "text-muted"
    }
  },
  "status": {
    "danger": {
      "value": "#ffecec",
      "role": "danger"
    },
    "success": {
      "value": "#ecfff3",
      "role": "success"
    },
    "warning": {
      "value": "#efebd8",
      "role": "warning"
    }
  },
  "extended": {
    "color-05253f": {
      "value": "#05253f",
      "role": "info"
    },
    "color-d7283d": {
      "value": "#d7283d",
      "role": "unknown"
    },
    "color-4f002f": {
      "value": "#4f002f",
      "role": "unknown"
    },
    "color-e1f5f5": {
      "value": "#e1f5f5",
      "role": "unknown"
    },
    "color-00752f": {
      "value": "#00752f",
      "role": "unknown"
    },
    "color-000000": {
      "value": "#000000",
      "role": "unknown"
    },
    "color-000b5e": {
      "value": "#000b5e",
      "role": "unknown"
    },
    "color-544f4b": {
      "value": "#544f4b",
      "role": "unknown"
    },
    "color-fffdea": {
      "value": "#fffdea",
      "role": "unknown"
    },
    "color-280c61": {
      "value": "#280c61",
      "role": "unknown"
    },
    "color-e0d1f0": {
      "value": "#e0d1f0",
      "role": "unknown"
    },
    "color-fd9c54": {
      "value": "#fd9c54",
      "role": "unknown"
    }
  },
  "meta": {
    "theme": "light",
    "extracted": "2026-05-27"
  }
}
```

### tokens/spacing.json
```json
{
  "base": {
    "value": "4px",
    "description": "Grid unit — all spacing must be multiples of this"
  },
  "unit": "px",
  "scale": {
    "xs": {
      "value": "2px",
      "px": 2
    },
    "sm": {
      "value": "4px",
      "px": 4
    },
    "md": {
      "value": "6px",
      "px": 6
    },
    "lg": {
      "value": "8px",
      "px": 8
    },
    "xl": {
      "value": "10px",
      "px": 10
    },
    "2xl": {
      "value": "12px",
      "px": 12
    },
    "3xl": {
      "value": "14px",
      "px": 14
    },
    "4xl": {
      "value": "16px",
      "px": 16
    },
    "5xl": {
      "value": "18px",
      "px": 18
    },
    "6xl": {
      "value": "20px",
      "px": 20
    }
  },
  "multipliers": {
    "1x": {
      "value": "4px",
      "raw": 4
    },
    "2x": {
      "value": "8px",
      "raw": 8
    },
    "3x": {
      "value": "12px",
      "raw": 12
    },
    "4x": {
      "value": "16px",
      "raw": 16
    },
    "5x": {
      "value": "20px",
      "raw": 20
    },
    "6x": {
      "value": "24px",
      "raw": 24
    },
    "7x": {
      "value": "28px",
      "raw": 28
    },
    "8x": {
      "value": "32px",
      "raw": 32
    },
    "9x": {
      "value": "36px",
      "raw": 36
    },
    "10x": {
      "value": "40px",
      "raw": 40
    },
    "11x": {
      "value": "44px",
      "raw": 44
    },
    "12x": {
      "value": "48px",
      "raw": 48
    },
    "13x": {
      "value": "52px",
      "raw": 52
    },
    "14x": {
      "value": "56px",
      "raw": 56
    },
    "15x": {
      "value": "60px",
      "raw": 60
    },
    "16x": {
      "value": "64px",
      "raw": 64
    }
  },
  "meta": {
    "totalValues": 15,
    "min": 2,
    "max": 30
  }
}
```

### tokens/typography.json
```json
{
  "families": [
    "LL Brown Black",
    "LL Brown",
    "Mabry Mono"
  ],
  "scale": {
    "heading-1": {
      "fontFamily": "LL Brown Black",
      "fontSize": "5rem",
      "fontWeight": "700",
      "lineHeight": null,
      "source": "css"
    },
    "heading-2": {
      "fontFamily": "LL Brown Black",
      "fontSize": "80px",
      "fontWeight": "700",
      "lineHeight": null,
      "source": "css"
    },
    "heading-3": {
      "fontFamily": "LL Brown Black",
      "fontSize": "72px",
      "fontWeight": "700",
      "lineHeight": null,
      "source": "css"
    },
    "body": {
      "fontFamily": "LL Brown",
      "fontSize": "16px",
      "fontWeight": "400",
      "lineHeight": null,
      "source": "css"
    },
    "caption": {
      "fontFamily": "LL Brown",
      "fontSize": "14px",
      "fontWeight": "400",
      "lineHeight": null,
      "source": "css"
    },
    "code": {
      "fontFamily": "Mabry Mono",
      "fontSize": "14px",
      "fontWeight": "400",
      "lineHeight": null,
      "source": "css"
    }
  },
  "fontFaces": [
    {
      "family": "LL Brown",
      "src": "https://www.liseberg.se/uiassets/MTEuMTIuMC40/91b0f50c316a9b56f3d8dde221cf2428.woff",
      "format": "woff",
      "weight": "400"
    },
    {
      "family": "LL Brown",
      "src": "https://www.liseberg.se/uiassets/MTEuMTIuMC40/1f24f36528f09613fa2a452bc9de5db3.woff",
      "format": "woff",
      "weight": "600"
    },
    {
      "family": "LL Brown Black",
      "src": "https://www.liseberg.se/uiassets/MTEuMTIuMC40/c2fbe0ae3c132d3ad8e5eb8361c1e0e0.woff",
      "format": "woff",
      "weight": "700"
    },
    {
      "family": "Mabry Mono",
      "src": "https://www.liseberg.se/uiassets/MTEuMTIuMC40/890221cb313e4e769405844bf9baa7ee.woff",
      "format": "woff",
      "weight": "400"
    },
    {
      "family": "Value serif",
      "src": "https://www.liseberg.se/uiassets/MTEuMTIuMC40/6f166605d9e8259980080b4aeb1c43de.otf",
      "format": "opentype",
      "weight": "700"
    }
  ],
  "rules": {
    "maxSizesPerScreen": 4,
    "headingWeightRange": "600-700",
    "bodyWeight": 400,
    "lineHeightBody": 1.5,
    "lineHeightHeading": 1.2
  }
}
```

## Bundled Fonts (fonts/)

The following font files are bundled in the `fonts/` directory:

- `fonts/LLBrown-600.woff`
- `fonts/LLBrown-Regular.woff`
- `fonts/LLBrownBlack-700.woff`
- `fonts/MabryMono-Regular.woff`
- `fonts/Valueserif-700.otf`

Use these local font files in `@font-face` declarations instead of fetching from Google Fonts.

## Screenshots Inventory (screens/)

> Study all screenshots carefully before implementing any UI. Match every visual detail exactly.

### Scroll Journey (screens/scroll/)

*Cinematic scroll states — page visual at each scroll depth*

![scroll-000.png](screens/scroll/scroll-000.png)

![scroll-017.png](screens/scroll/scroll-017.png)

![scroll-033.png](screens/scroll/scroll-033.png)

![scroll-050.png](screens/scroll/scroll-050.png)

![scroll-067.png](screens/scroll/scroll-067.png)

![scroll-083.png](screens/scroll/scroll-083.png)

![scroll-100.png](screens/scroll/scroll-100.png)

### Full Page Screenshots (screens/pages/)

*Full-page screenshots of each crawled URL*

![ExternalAccount-Login.png](screens/pages/ExternalAccount-Login.png)

![home.png](screens/pages/home.png)

![kalender.png](screens/pages/kalender.png)

![parken-biljetter-priser.png](screens/pages/parken-biljetter-priser.png)

![till-lisebergsparken.png](screens/pages/till-lisebergsparken.png)

### Section Clips (screens/sections/)

*Clipped individual sections and components*

![home-section-2.png](screens/sections/home-section-2.png)

![home-section-3.png](screens/sections/home-section-3.png)

![home-section-4.png](screens/sections/home-section-4.png)

![kalender-section-2.png](screens/sections/kalender-section-2.png)

![parken-biljetter-priser-section-2.png](screens/sections/parken-biljetter-priser-section-2.png)

![parken-biljetter-priser-section-4.png](screens/sections/parken-biljetter-priser-section-4.png)

![till-lisebergsparken-section-2.png](screens/sections/till-lisebergsparken-section-2.png)

### Interaction States (screens/states/)

*Hover, focus, and active state captures*

![button-1-default.png](screens/states/button-1-default.png)

![button-1-focus.png](screens/states/button-1-focus.png)

![button-1-hover.png](screens/states/button-1-hover.png)

![button-2-default.png](screens/states/button-2-default.png)

![button-2-focus.png](screens/states/button-2-focus.png)

![button-2-hover.png](screens/states/button-2-hover.png)

![button-3-default.png](screens/states/button-3-default.png)

![button-3-focus.png](screens/states/button-3-focus.png)

![button-3-hover.png](screens/states/button-3-hover.png)

![input-1-default.png](screens/states/input-1-default.png)

![input-1-focus.png](screens/states/input-1-focus.png)

![input-1-hover.png](screens/states/input-1-hover.png)

![input-2-default.png](screens/states/input-2-default.png)

![input-2-focus.png](screens/states/input-2-focus.png)

![input-2-hover.png](screens/states/input-2-hover.png)

![link-1-default.png](screens/states/link-1-default.png)

![link-1-focus.png](screens/states/link-1-focus.png)

![link-2-default.png](screens/states/link-2-default.png)

![link-2-focus.png](screens/states/link-2-focus.png)

![link-3-default.png](screens/states/link-3-default.png)

![link-3-focus.png](screens/states/link-3-focus.png)

### Screenshot Index (screens/INDEX.md)

# Screenshot Index

## Scroll Journey

> Shows the cinematic state at each point of the page

| Scroll | Y Position | File |
|--------|-----------|------|
| 0% | 0px | `screens/scroll/scroll-000.png` |
| 17% | 1059px | `screens/scroll/scroll-017.png` |
| 33% | 2057px | `screens/scroll/scroll-033.png` |
| 50% | 3116px | `screens/scroll/scroll-050.png` |
| 67% | 4175px | `screens/scroll/scroll-067.png` |
| 83% | 5173px | `screens/scroll/scroll-083.png` |
| 100% | 6232px | `screens/scroll/scroll-100.png` |

## Pages

| Page | URL | File |
|------|-----|------|
| Liseberg - en värld av upplevelser | `https://www.liseberg.se` | `screens/pages/home.png` |
| Öppettider och program | Liseberg | `https://www.liseberg.se/kalender/` | `screens/pages/kalender.png` |
| Logga in - Liseberg Konto | `https://www.liseberg.se/ExternalAccount/Login?returnUrl=https%3A%2F%2Fmitt.liseberg.se%2F` | `screens/pages/ExternalAccount-Login.png` |
| Parkbiljetter & priser | Liseberg | `https://www.liseberg.se/parken/biljetter-priser/` | `screens/pages/parken-biljetter-priser.png` |
| Lisebergsparken | Liseberg | `https://www.liseberg.se/till-lisebergsparken/` | `screens/pages/till-lisebergsparken.png` |

## Sections

| Page | Section | File |
|------|---------|------|
| home | #2 (main > div) | `screens/sections/home-section-2.png` |
| home | #3 (main > div) | `screens/sections/home-section-3.png` |
| home | #4 (main > div) | `screens/sections/home-section-4.png` |
| kalender | #2 (main > div) | `screens/sections/kalender-section-2.png` |
| parken-biljetter-priser | #2 (main > div) | `screens/sections/parken-biljetter-priser-section-2.png` |
| parken-biljetter-priser | #4 ([class*="section"]) | `screens/sections/parken-biljetter-priser-section-4.png` |
| till-lisebergsparken | #2 (main > div) | `screens/sections/till-lisebergsparken-section-2.png` |

## Homepage Screenshots (screenshots/)

![homepage.png](screenshots/homepage.png)

