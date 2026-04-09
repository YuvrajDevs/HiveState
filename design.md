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

## Color System

### Backgrounds
- **Primary**: `#0e0e0e` (Deepest layer, infinite canvas).
- **Secondary**: `#171717` (Sidebars, panels, cards).
- **Surface**: `#1c1c1c` (Hover states, active elements).
- **Border**: `#262626` (Subtle 1px dividers).

### Accents
- **Primary Accent**: Electric Blue (`#3b82f6` or similar high-intensity blue).
- **Secondary Accent**: Slate Grey (`#a1a1aa`).

### Status Colors
- **Success**: `rgb(34, 197, 94)` (Green).
- **Error**: `rgb(239, 68, 68)` (Red).
- **Warning**: `rgb(234, 179, 8)` (Yellow).

### Rules
- Colors MUST indicate state (Success, Error, Pending) or action (Primary Button).
- No random color usage or gradients (unless extremely subtle for depth).

---

## Typography

### Primary Font: **Outfit**
- **Usage**: All UI text, headers, labels, navigation.
- **Style**: Bold and tight for headers; medium for labels.

### Data Font: **JetBrains Mono**
- **Usage**: Logs, traces, JSON payloads, token counts, cost data.
- **Style**: Monospace only. Strict separation from UI text.

---

## Layout System

### Background Canvas
- **Subtle Grid**: Dark gray line pattern (e.g., 20px squares).
- **Vibe**: Blueprint / Engineering canvas.
- **Depth**: Use contrast and 1px borders instead of shadows.

---

## Component Design

### Nodes (React Flow)
- **Shape**: Sharp rectangular (0-4px radius).
- **Header**: Status-coded bar at the top.
- **Edges**: Straight or Step lines.
- **Animation**: Flowing dashed line during execution.

### Tables & Lists
- **Density**: Small text, minimal padding.
- **Separators**: 1px thin borders.
- **Vibe**: Spreadsheet / Spreadsheet-like precision.

### Sidebars & Panels
- **Style**: Subtle glassmorphism (low transparency, high blur).
- **Inputs**: Code-editor style (fixed-width fonts for values).

---

## Micro-interactions
- **Thinking State**: Blinking cursor / subtle scanning line.
- **Activity**: Flowing edge animations.
- **Navigation**: Instant or high-speed transitions (`unstable_instant`).

---

## X-Ray Trace View (CRITICAL)
- **Vertical Timeline**: Step-by-step sequential list.
- **Data Panels**: Show Raw Prompt, Raw Response, Timestamps.
- **No Abstraction**: Never hide technical data from the user.
- **Syntax Highlighting**: VS Code Dark+ style for JSON/Code.
