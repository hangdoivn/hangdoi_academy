# Hang Đôi Academy Design System

Canonical design-system files:

- `academy-tokens.md` — concept, theme, color, typography, layout and usage contract.
- `academy-reference-analysis.md` — how the approved visual references map into Academy principles.
- `academy-component-recipes.md` — practical page/component/layout recipes.
- `../../site/academy-tokens.css` — CSS source of truth.
- `../../config/academy-design-tokens.json` — machine-readable token mirror.

## Current concept

**Creative Learning Studio × Editorial Poster × Production Culture**

## Non-negotiable visual rule

**Yellow is approximately 5–10% of a composition and should not dominate a viewport.**

Green is the brand anchor. Warm paper is the primary canvas. Orange/coral and cobalt are secondary signal colors.

## Implementation rule

New Academy UI should consume `--aca-*` tokens.

Do not introduce a new page-local palette, radius scale or spacing system unless the canonical token source is updated first.

## Deployment boundary

Design system work does not change the Academy deployment contract.

Follow:

- `AGENTS.md`
- `docs/deployment-safety.md`
