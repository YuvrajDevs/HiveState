# HiveState design system

HiveState is a workbench for people who build and run multi-agent AI workflows. Its job is to make three
things obvious at a glance: what is running, what needs a person, and what it cost. The interface is calm
so that those three things can be loud.

Tokens live in `app/globals.css` (`@theme`). Status wording lives in `lib/status.ts`, workflow identity
colours in `lib/tags.ts`, data shapes in `types/domain.ts`. This document explains how to use them.

---

## Principles

1. **Calm surface, loud state.** Layered charcoal, hairline borders and muted text for structure. Colour is
   spent on state (running, needs review, failed) and on one accent for action.
2. **What needs you comes first.** Runs waiting for review or paused on an error are pinned to the top of the
   dashboard with the action beside them.
3. **Cost is always in view.** Today's spend against the daily budget, and cost per run and per step.
4. **Plain words.** Sentence case everywhere. A run, a step, a workflow: never "cluster", "sequence" or
   decorative status strings. Labels say what a thing is.
5. **One status vocabulary.** Every screen gets its words and tone from `runLabel` / `logLabel`, so a state
   reads the same on the dashboard, the task list, the trace and the canvas.

---

## Colour

| Token | Role |
|---|---|
| `background` · `sidebar` · `surface` · `surface-2` · `canvas` | Charcoal layers, page to card; `canvas` for the workflow editor and code wells |
| `border` · `border-strong` | Hairlines; strong for hover and focus edges |
| `foreground` · `muted` · `subtle` | Text: 15.6:1, 7.0:1 and 5.1:1 on the page |
| `accent` | Lavender: primary action, selection, running state |
| `success` · `warning` · `danger` | State only: completed, needs review or paused, failed |
| `tag-violet` · `tag-blue` · `tag-yellow` · `tag-pink` · `tag-green` | Pastel identity for workflows, always with dark text; `tagColor(id)` keeps a workflow's colour stable |
| `code-system` · `code-input` · `code-output` | The payload inspector: prompt, input and output told apart at a glance |

Rules
- No hex values or Tailwind palette colours (`red-500`) in components; use a token.
- State colours are never decorative; pastels identify, they never signal state.

---

## Typography

Outfit for the interface, JetBrains Mono only for data (ids, tokens, costs, payloads).

| Class | Size | Use |
|---|---|---|
| `text-micro` | 12 / 16 | Labels on dense cards, table headers |
| `text-xs` | 12.5 / 18 | Meta, hints, timestamps |
| `text-body-sm` | 13 / 20 | Dense lists |
| `text-sm` | 14 / 21 | Default reading text |
| `text-lg` – `text-3xl` | 18 – 30 | Card titles to page titles |

Rules
- Sentence case for every title, label and button. No uppercase labels, no letter-spaced eyebrows.
- One page title per page; cards are titled with a noun ("Daily budget", "Steps").

---

## Shape, space and motion

- Radii: `rounded-lg` (12px) controls and inputs, `rounded-xl` (14px) list items, `rounded-2xl` (18px)
  cards and panels, `rounded-full` pills and dots.
- 4px base; cards `p-5`, gaps `gap-4` to `gap-6`.
- Motion explains state: a pulsing dot for live runs, a growing bar for progress, animated edges on the
  canvas while a run executes. Nothing moves for decoration.

---

## Components and patterns

| Pattern | Notes |
|---|---|
| Needs-you banner | Runs paused for review or on an error, each with its action (Review, Open). |
| Status chip | `runLabel(status)` / `logLabel(status)` for text and tone; never a hand-written ternary. |
| Workflow card | Pastel dot, agent count, success rate, last run, Edit and Run. |
| Canvas node | Agent or human-review step; shows model, prompt, and the live state of the current run. |
| Payload inspector | Prompt, input and output in their code colours, with tokens, cost and time per step. |
| Empty state | Says what will appear and how to make it appear. |

---

## Accessibility

- Text contrast meets WCAG AA on every surface (values above).
- Status is never colour alone: every chip and dot carries a word.
- Toolbars scroll sideways on a phone instead of clipping; wide tables scroll inside their card.
