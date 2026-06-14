---
name: SlotNest
description: Keyboard-first command center for Gmail + Google Calendar — clear, fast, quiet.
colors:
  honey: "#d99a3c"
  honey-ink: "#936420"
  honey-strong: "#e6a64d"
  ink: "#2c2c2c"
  muted-ink: "#6b6b6b"
  bg: "#ffffff"
  panel: "#f8f6f2"
  border: "#e3e3e3"
  urgent: "#c54f3d"
  scheduled: "#4c9b6b"
  fyi: "#6285b3"
  bg-dark: "#1c1c1c"
  panel-dark: "#262626"
  ink-dark: "#f2f2f2"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.005em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.honey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.honey-strong}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  command-bar:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0"
  email-row:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: SlotNest

## 1. Overview

**Creative North Star: "The Quiet Desk"**

SlotNest is the clean desk you sit down to at the start of the day — everything in its place, warm light from one side, nothing competing for attention. It is an AI-native, keyboard-first command center for Gmail and Google Calendar built for non-technical people first, so the interface has to feel obvious before it feels clever. The system organizes around one principle: the tool disappears into the task. Honey-amber is the single warm light in the room — it marks the one thing you should act on, and nothing else.

The product is built around **approve, don't read**: the AI prepares the decision — triaged priority, a drafted reply, a proposed invite at a real free slot — and the user confirms with a single keypress. Screens present *actions*, not raw messages. This is the deliberate opposite of Superhuman's "faster inbox / memorize 40 shortcuts" (expert-only); here, the fast path is plain English in the command bar, and keyboard-first never means expert-only. The home surface (`/today`) is this approve-don't-read loop, **not** a metric-card dashboard — those are forbidden (§6).

Density is calm, not cramped. Surfaces are flat by default; depth appears only as a response to state (hover, focus, the selected row). Speed is felt through fewer clicks and visible keyboard accelerators, never through a dense, intimidating "power-tool" wall of controls. Every screen should be understandable on first sight, with one obvious primary action and advanced options tucked away until asked for.

This system explicitly rejects three things. It is **not** legacy webmail (Gmail / Outlook): no toolbar soup, no nested menus, no anxiety-by-density. It is **not** generic AI-SaaS: no purple gradients, no hero-metric dashboards, no cream/parchment backgrounds, no decorative glassmorphism, no gradient text. And it is **not** a terminal power-tool: keyboard-first must never mean expert-only or monospace-everything.

**Key Characteristics:**
- Pure-white surface; warmth carried by the honey accent and type, never by a tinted background.
- One accent (honey-amber) reserved for primary action, current selection, and focus — ≤10% of any screen.
- Flat by default; shadow and elevation are state, not decoration.
- Geist throughout — one family, multiple weights; Geist Mono for shortcuts, timestamps, counts, and addresses.
- Fixed rem type scale (no fluid clamps); tight 1.15–1.2 step ratio.
- AA contrast everywhere, visible focus rings, full keyboard navigation as a first-class concern.

## 2. Colors

A near-neutral system lit by a single warm accent: honey-amber against pure white, with disciplined semantic colors for email triage.

### Primary
- **Honey** (`#d99a3c` / `oklch(0.70 0.13 75)`): The brand's one warm light. Fills primary action buttons (with ink-dark text, never white), marks the current selection rail on the active email/event row, and colors the focus ring. Its rarity is the entire point.
- **Honey Ink** (`#936420` / `oklch(0.52 0.11 70)`): The text-safe amber. Used when the accent must appear *as text or an icon on white* (links, active nav label, an inline "scheduled at" highlight) where the bright honey would fail AA. Hits ≥4.5:1 on white.
- **Honey Strong** (`#e6a64d` / `oklch(0.74 0.13 75)`): Hover/active state of primary surfaces, and the primary fill in dark mode.

### Neutral
- **Ink** (`#2c2c2c` / `oklch(0.22 0 0)`): Primary text and headings. Also the foreground on honey buttons.
- **Muted Ink** (`#6b6b6b` / `oklch(0.45 0 0)`): Secondary text, metadata, timestamps, placeholder text. Deliberately darker than the shadcn default (0.556) so it clears 4.5:1 on white — placeholders included.
- **Background** (`#ffffff` / `oklch(1 0 0)`): The content surface. Literally pure white; no hidden warmth.
- **Panel** (`#f8f6f2` / `oklch(0.975 0.005 75)`): The second neutral layer — sidebar, command-bar chrome, toolbars. A whisper of the brand hue (chroma 0.005) so panels recede from content without reading as gray.
- **Border** (`#e3e3e3` / `oklch(0.90 0 0)`): Hairline dividers, input strokes, row separators. 1px, full borders only.

### Tertiary (semantic — triage)
- **Urgent** (`#c54f3d` / `oklch(0.58 0.17 25)`): The `Urgent` urgency level and destructive actions. Muted, not fire-engine — calm even when flagging.
- **Scheduled** (`#4c9b6b` / `oklch(0.62 0.12 150)`): Confirmation states — an invite sent, a slot booked, an email archived.
- **FYI** (`#6285b3` / `oklch(0.60 0.08 240)`): The `FYI` action label and informational chips. A quiet blue-gray that never competes with honey.

### Named Rules
**The One Light Rule.** Honey appears on ≤10% of any screen. It means exactly one thing: *this is what to act on*. If two honey elements compete on a screen, one is wrong. Triage urgency uses the semantic trio (urgent / scheduled / fyi) — never honey — so the accent stays unambiguous.

**The Warmth-In-The-Light Rule.** Warmth lives in the accent and the type, never in the background. The body surface is pure `#ffffff`. Tinting the background toward cream/sand is forbidden.

## 3. Typography

**Display / Body Font:** Geist (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Label / Mono Font:** Geist Mono (with `ui-monospace, SFMono-Regular, monospace` fallback)

**Character:** One family does all the UI work — headings, labels, body, data — in multiple weights. Geist is a modern grotesk: tight, legible at small sizes, more characterful than Inter without ever shouting. Geist Mono is reserved for content that benefits from fixed advance width: keyboard shortcut chips (`⌘K`), timestamps, message counts, and email addresses. Inter, the previous default, is retired.

### Hierarchy
- **Display** (600, 1.5rem/24px, 1.2, -0.02em): Page titles, the largest thing on a screen. No fluid clamps — fixed rem.
- **Headline** (600, 1.25rem/20px, 1.25, -0.015em): Section headers, dialog titles.
- **Title** (600, 0.9375rem/15px, 1.4, -0.01em): Email subject lines, event titles, button labels, the active row.
- **Body** (400, 0.875rem/14px, 1.55): Default UI text, email previews, descriptions. Prose blocks capped at 65–75ch; dense rows and tables may run wider.
- **Label** (500, 0.75rem/12px, 0.005em): Chips, metadata labels, field captions. Sentence case — not uppercase tracking.
- **Mono** (500, 0.8125rem/13px): Shortcut chips, timestamps, counts, addresses only.

### Named Rules
**The No-Eyebrow Rule.** No tiny uppercase tracked kickers above sections. Labels are sentence case at normal tracking. The 2023 all-caps eyebrow is forbidden.

**The Fixed-Scale Rule.** Type sizes are fixed rem, never `clamp()`. A heading that shrinks inside a sidebar panel looks worse, not better — users view at consistent DPI.

## 4. Elevation

Flat by default. SlotNest conveys depth through tonal layering — the `panel` neutral sitting under pure-white content — far more than through shadow. Shadows are a **state signal only**: they appear when an element lifts off the page in response to the user (a hovered command result, an open dropdown, the command bar itself), and never as ambient decoration at rest. Glassmorphism is forbidden.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)`): Hovered rows and resting popovers/dropdowns. Barely there.
- **Float** (`box-shadow: 0 8px 32px rgba(0,0,0,0.12)`): The command bar and modal dialogs — the one surface allowed to clearly float above everything.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat until the user touches them. If a card has a shadow before you hover it, the shadow is wrong. Depth is feedback, not styling.

## 5. Components

### Buttons
- **Shape:** Gently rounded (8px / `rounded.md`).
- **Primary:** Honey fill (`#d99a3c`) with **ink-dark text** (`#2c2c2c`), 8px×14px padding, Title weight. The ink-on-honey pairing is deliberate — white text on honey fails contrast and reads cheap.
- **Hover / Focus:** Background shifts to Honey Strong (`#e6a64d`); 150ms ease-out. Focus shows a 2px honey ring offset 2px from the button.
- **Ghost:** Transparent fill, ink text, no border at rest; `panel` background tint on hover. The default for secondary and toolbar actions.
- **Destructive:** Urgent (`#c54f3d`) — used as text/icon for delete, fill only on confirm.

### Chips (triage labels)
- **Style:** Soft-filled, not outlined. Background is a 12–16% tint of the semantic hue; text is the full-strength semantic color or ink. 6px radius, Label type, sentence case.
- **State:** Action labels (`Needs reply` / `FYI` / `Ignore`) and urgency (`Urgent` / `Normal` / `Low`) read as quiet chips, never as honey.

### Cards / Containers
- **Corner Style:** 10px (`rounded.lg`) for panels, 8px for inner rows.
- **Background:** Pure white content on `panel` chrome. Never nest a card inside a card.
- **Shadow Strategy:** Flat at rest (see Elevation). `Lift` on hover only.
- **Border:** 1px `border` (`#e3e3e3`), full borders only.
- **Internal Padding:** 16px (`spacing.lg`) for panels; 10–12px for dense rows.

### Inputs / Fields
- **Style:** White fill, 1px `border` stroke, 8px radius, 8px×12px padding. Placeholder uses Muted Ink (AA-safe), never a pale gray.
- **Focus:** Border shifts to honey + a 2px honey ring (no glow). 150ms.
- **Error:** Border and helper text shift to Urgent; the field keeps its shape.
- **Disabled:** 50% opacity, no pointer events.

### Navigation
- **Style:** Left sidebar on `panel`, Title-weight items, ghost rows. Active item gets Honey Ink text plus a 2px honey rail on the leading edge — the only persistent honey on the page. Hover gets a subtle `panel`-darker tint. On mobile it collapses to a bottom bar / sheet; touch targets ≥44px (`pointer-coarse` density already in the row styles).

### Command Bar (signature component)
The single primary surface — a centered ⌘K dialog that `Float`s above the app. White fill, 14px radius, no decorative chrome. A leading search/prompt input in Body type; results are ghost rows with mono shortcut hints right-aligned. It accepts both discrete commands and natural-language sentences (routed to the Agent). The active result carries the honey selection rail. This is where SlotNest's speed lives — keep it instant, keyboard-driven, and visually quiet.

## 6. Do's and Don'ts

### Do:
- **Do** keep the body background pure white (`#ffffff`). Carry all warmth in the honey accent and Geist type.
- **Do** reserve honey for one meaning per screen — primary action, current selection, focus — at ≤10% coverage (The One Light Rule).
- **Do** use ink-dark text on honey buttons, never white.
- **Do** darken muted text to clear 4.5:1 on white, placeholders included (`#6b6b6b`, not the pale shadcn default).
- **Do** keep surfaces flat at rest; add shadow only as hover/lift state.
- **Do** use Geist Mono for shortcut chips, timestamps, counts, and addresses — and nowhere else.
- **Do** show keyboard accelerators visibly; make the fast path the default path, never the required one.
- **Do** keep type at fixed rem with sentence-case labels.

### Don't:
- **Don't** tint the background cream/sand/parchment, or name a token `--paper` / `--cream` / `--linen`. Warmth is in the light, not the room.
- **Don't** ship generic AI-SaaS chrome: no purple gradients, no hero-metric dashboards, no decorative glassmorphism, no gradient text.
- **Don't** recreate Gmail/Outlook clutter: no toolbar soup, no nested menus, no anxiety-by-density.
- **Don't** go terminal power-tool: no monospace-everything, no jargon, no expert-only affordances. Keyboard-first ≠ expert-only.
- **Don't** use honey for triage urgency — that's the semantic trio's job (urgent / scheduled / fyi).
- **Don't** put a `border-left`/`border-right` colored stripe on rows, cards, or chips. Use the honey selection rail only on the single active item, or full borders / tints.
- **Don't** add tiny uppercase tracked eyebrows above sections.
- **Don't** nest a card inside a card.
- **Don't** add ambient shadows or orchestrated page-load animation; product loads into a task.
