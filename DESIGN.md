---
version: "1.0"
name: maarmapa
description: "Urban artist. Dark editorial aesthetic meets Wu-Tang mysticism. Cinematic, high-contrast, intentional."
colors:
  primary: "#080808"
  secondary: "#F5F5F0"
  accent: "#B8422E"
  accent_gold: "#D4AF37"
  accent_teal: "#2E8B8B"
  accent_red: "#C41E3A"
  neutral_dark: "#1A1C1E"
  neutral_light: "#E8E8E8"
typography:
  h1:
    fontFamily: "Bebas Neue"
    fontSize: "3rem"
    fontWeight: "700"
    lineHeight: "1"
    letterSpacing: "0.05em"
  h2:
    fontFamily: "Bebas Neue"
    fontSize: "2.5rem"
    fontWeight: "700"
  body_lg:
    fontFamily: "Public Sans"
    fontSize: "1.125rem"
    fontWeight: "400"
    lineHeight: "1.6"
  body_md:
    fontFamily: "Public Sans"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  label_caps:
    fontFamily: "Space Grotesk"
    fontSize: "0.75rem"
    fontWeight: "600"
    letterSpacing: "0.1em"
    textTransform: "uppercase"
  serif_quote:
    fontFamily: "Crimson Text"
    fontSize: "1.5rem"
    fontWeight: "400"
    fontStyle: "italic"
    lineHeight: "1.8"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
visual_styles:
  dark_editorial:
    description: "Deep ink, matte blacks, high-contrast. Broadsheet aesthetic. Film grain, vignette."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    accentColor: "{colors.accent}"
  cinematic:
    description: "Wu-Tang dark anime. Katsuhiro Otomo. Cel-shading, bold ink outlines, occult energy."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent_gold}"
    accentColor: "{colors.accent_teal}"
  brutalist:
    description: "2x2 grid, bold geometry, industrial. High contrast. No curves."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    accentColor: "{colors.accent}"
components:
  slide_01:
    description: "Hero slide. Title + Ghost image. Dark atmospheric."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    typography: "{typography.h1}"
    rounded: "{rounded.none}"
    padding: "{spacing.lg}"
    effect: "film_grain_12pct vignette"
  slide_02:
    description: "Insight slide. Key concept on white background."
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    typography: "{typography.h2}"
    rounded: "{rounded.none}"
    padding: "{spacing.lg}"
    effect: "high_contrast"
  slide_03:
    description: "Data slide. Architecture + stat. Dark with accent line."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    accentColor: "{colors.accent}"
    typography: "{typography.h1}"
    effect: "film_grain_10pct accent_line"
  slide_04:
    description: "Quote slide. Serif italic quote on dark. Contemplative."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    typography: "{typography.serif_quote}"
    rounded: "{rounded.none}"
    effect: "subtle_quote_mark"
  slide_05:
    description: "Brutalist grid. 4 key concepts. Bold white on dark."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    layout: "2x2_grid"
    rounded: "{rounded.none}"
    effect: "brutalist"
  slide_06:
    description: "Provocation slide. Question on white. Engaging."
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    typography: "{typography.h2}"
    rounded: "{rounded.none}"
  slide_07:
    description: "Conclusion slide. @maarmapa.eth + hashtags. Finale."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    accentColor: "{colors.accent_gold}"
    effect: "urban_pattern_5pct cinematic_fade"
---

# maarmapa — Design System

## Overview

**Urban artist. Dark editorial aesthetic meets Wu-Tang mysticism.**

maarmapa creates content at the intersection of:
- **Art & Culture** — Street expression, urban identity, visual rebellion
- **Technology & Blockchain** — Web3, NFTs, decentralized culture
- **Marketing & Branding** — Authentic storytelling, growth hacking
- **Architecture & Cities** — Urban planning, spatial narratives

The design system reflects this duality: **high-contrast editorial polish** with **dark, occult energy**.

## Colors

The palette is rooted in **deep blacks and warm creams**, with strategic accent colors.

- **Primary (#080808):** Deep ink. Headlines, core text, dominant backgrounds.
- **Secondary (#F5F5F0):** Warm limestone. Neutral surfaces, high-contrast text.
- **Accent (#B8422E):** "Boston Clay" — the sole warm accent for CTAs and emphasis.
- **Accent Gold (#D4AF37):** Heritage, luxury, Wu-Tang mysticism.
- **Accent Teal (#2E8B8B):** Electric energy, technology, depth.
- **Accent Red (#C41E3A):** Urgency, passion, street energy.

**Usage:**
- Dark backgrounds with light text for editorial gravitas
- White backgrounds with dark text for contrast and clarity
- Accent colors sparingly for emphasis and emotional direction

## Typography

**Font Pairing:**
- **Bebas Neue** — Headlines, power, uppercase drama
- **Public Sans** — Body copy, clarity, modern editorial
- **Space Grotesk** — Labels, caps, technical precision
- **Crimson Text** — Quotes, italic serif, contemplative moments

**Hierarchy:**
1. **H1 (3rem)** — Massive headline. Bebas Neue. Page statements.
2. **H2 (2.5rem)** — Section titles. Bold presence.
3. **Body Large (1.125rem)** — Featured text, captions.
4. **Body Medium (1rem)** — Primary copy. Long-form reading.
5. **Labels (0.75rem)** — Metadata, numbers, technical info.
6. **Quotes (1.5rem)** — Serif italic. Contemplative voice.

## Visual Styles

### Dark Editorial
*The foundation. High-contrast, intentional, like a premium broadsheet.*

- Deep black backgrounds (#080808)
- Cream text (#F5F5F0)
- Film grain 10-12% opacity
- Vignette edges
- Vertical accent lines
- No soft edges

### Cinematic
*Wu-Tang dark anime meets Akira. Occult energy, mysticism, power.*

- Same palette but with gold accents (#D4AF37)
- Cel-shading aesthetic implied
- Bold ink outlines suggested
- Teal energy (#2E8B8B) for electric moments
- Neon rim lights
- Smoke and vignette

### Brutalist
*Industrial geometry. 2x2 grids. No curves. Pure power.*

- Dark background, bold white shapes
- Geometric precision
- Grid systems
- High contrast
- No rounded corners
- Sequential motion rhythm

## Slide Progression

The 7-slide carousel follows a **narrative arc**:

1. **Hero** — Title + atmosphere. Set the tone.
2. **Insight** — Key concept. Break the surface.
3. **Data** — Facts + accent. Ground the idea.
4. **Quote** — Contemplation. Depth and nuance.
5. **Grid** — 4 concepts. Breadth and power.
6. **Question** — Provocation. Engagement hook.
7. **Conclusion** — Branding + close. Leave them thinking.

**Each slide uses a different proportion of dark/light to maintain rhythm.**

## Video Motion

Runway videos use **cinematic pacing and intentional motion**:

- Slide 1: Fade in dark atmosphere. Text slides left.
- Slide 2: Scale, blur, sharp impact. Clean editorial.
- Slide 3: Vertical lines animate. Numbers float upward.
- Slide 4: Fade upward like smoke. Contemplative drift.
- Slide 5: Grid cells flash. Sequential brutalist rhythm.
- Slide 6: Letters scatter outward explosion. Kinetic typography.
- Slide 7: Deep fade to black. Pulsing finale. Film noir ending.

**Duration:** 4 seconds per video for Instagram Reels pacing.

## Brand Voice

- **Authentic** — No corporate fluff. Real insights, real stakes.
- **Urban** — Street culture, rebellion, authenticity.
- **Intellectual** — References art, philosophy, culture.
- **Visual-first** — Image before text. Show, then tell.
- **Cinematic** — Film language. Moments, not slides.

## Usage Guidelines

**DO:**
- Use deep blacks and creams as primary palette
- Pair Bebas Neue headlines with Public Sans body
- Include 10-12% film grain on dark backgrounds
- Create high-contrast layouts (dark text on light, light on dark)
- Use accent colors strategically (not everywhere)
- Think in 4-second video moments

**DON'T:**
- Use soft edges, rounded corners on dark slides
- Mix too many accent colors (pick one per piece)
- Forget the vignette on atmospheric shots
- Use light grays or medium tones (go dark or light, not in-between)
- Ignore safe zones (120px margins for Instagram)
- Create cluttered layouts

---

**Version:** 1.0  
**Last Updated:** May 3, 2026  
**Maintained by:** maarmapa design system
