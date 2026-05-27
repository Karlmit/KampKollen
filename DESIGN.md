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
  src: url("https://www.liseberg.se/uiassets/MTEuMTIuMC40/91b0f50c316a9b56f3d8dde221cf2428.woff") format("woff");
  font-weight: 400;
}
@font-face {
  font-family: "LL Brown Black";
  src: url("https://www.liseberg.se/uiassets/MTEuMTIuMC40/c2fbe0ae3c132d3ad8e5eb8361c1e0e0.woff") format("woff");
  font-weight: 700;
}
@font-face {
  font-family: "Mabry Mono";
  src: url("https://www.liseberg.se/uiassets/MTEuMTIuMC40/890221cb313e4e769405844bf9baa7ee.woff") format("woff");
  font-weight: 400;
}
@font-face {
  font-family: "Value serif";
  src: url("https://www.liseberg.se/uiassets/MTEuMTIuMC40/6f166605d9e8259980080b4aeb1c43de.otf") format("opentype");
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
