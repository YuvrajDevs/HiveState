# HiveState Design System: Technical Brutalism

## Goal
Define a complete global design system for HiveState that feels like a professional engineering tool (Stripe/Vercel/Linear style), prioritizing clarity, function, and high information density.

---

## Design Philosophy
- **Developer-first interface**: Built for power users and builders.
- **Clarity over aesthetics**: Function dictates form.
- **Functional, not decorative**: No "fluff" or arbitrary design elements.
- **High information density**: Maximize data visibility on every screen.
- **Purposeful elements**: Every pixel should serve a goal.

---

## Global Constraints

### DO:
- **Sharp Edges**: 0–4px border radius max.
- **High Contrast**: Pure dark UI with stark white/gray text.
- **Grid Alignment**: Strict adherence to a 4px/8px grid system.
- **Readability**: Prioritize monospace for data and clean sans-serif for UI.
- **Structured Layouts**: Dense, nested, and clearly divided regions.

### DO NOT:
- No soft UI (no large rounded corners or "bubbles").
- No decorative colors (use color only for state/action).
- No excessive whitespace (keep it tight and efficient).
- No playful animations (use functional transitions only).
- No consumer-style patterns (no "cozy" layouts).

---

## Color System (mid-tone slate, updated)
Layers are clearly different steps so panels, wells and controls separate without heavy borders:
- **Page** `#1d2639` · **Canvas** `#1b2535` · **Sidebar / top bar** `#232e45`
- **Cards** `#2a3650` · **Hovered** `#34425f` · **Wells, inputs, code** `#1a2335`
- **Border** `#41506f` · **Text** `#f1f5fd` · **Muted** `#aebbd6`
- **Accent** `#7db1ff`; state colours: ok `#3dd9a0`, warn `#ffc457`, bad `#ff7a90`, violet `#b394ff`, cyan `#4fd8f0`.

Cards are colour-coded with `tone-blue | violet | cyan | green | amber | rose` (a 3px top stripe and a tinted gradient), so a status or a kind of component is recognisable at a glance. Text colours were checked with axe-core against WCAG AA.

