# Hang Đôi Academy — Design Token System v1

Status: **canonical design source draft**  
Scope: all Hang Đôi Academy web surfaces inside `hangdoivn/hangdoi_academy`.

This system is derived from the current Academy homepage and its refined green / yellow / white visual language. It consolidates the previously separate `--ink/--green/... ` and `--p2-*` token sets into one stable namespace: **`--aca-*`**.

## 1. Brand direction

Academy should feel:

**thực dụng · trẻ · sáng rõ · có nghề · có hệ thống**

It should not look like:

- generic EdTech blue;
- neon gaming UI;
- corporate HR;
- luxury black-gold;
- a Production sub-brand using Production's visual system unchanged.

The visual hierarchy is:

**Green = Academy / action / capability**  
**Yellow = highlight / learning signal / emphasis**  
**White + soft neutral = clarity / breathing room**  
**Dark forest = depth / premium / inverse sections**

Yellow is an accent, not the page background default.

## 2. Token architecture

Use three levels.

| Layer | Purpose | Example |
| --- | --- | --- |
| Primitive | Raw values | `--aca-green-700` |
| Semantic | Meaning | `--aca-color-brand` |
| Component | Stable UI defaults | `--aca-button-height-md` |

New UI code should consume **semantic or component tokens**. Primitive tokens are mainly for token composition.

Do not create new page-local variables such as `--course-green` or `--page-dark` unless a genuinely new semantic need exists.

## 3. Core palette

| Token | Value | Use |
| --- | --- | --- |
| Green 950 | `#0F422D` | inverse surfaces, footer, premium section |
| Green 900 | `#153D2E` | headings / strong Academy ink |
| Green 800 | `#17382B` | primary text |
| Green 700 | `#176B43` | primary brand / CTA |
| Green 600 | `#239653` | active / emphasis / focus |
| Green 400 | `#8BC34A` | secondary green only |
| Green 100 | `#EDF7EF` | subtle branded background |
| Yellow 500 | `#F2D43D` | primary Academy accent |
| Yellow 300 | `#FFE783` | light accent |
| Yellow 100 | `#FFF8D6` | highlight background |
| White | `#FFFFFF` | default page / card |
| Neutral 50 | `#F7F8F3` | alternate section |
| Muted | `#52665D` | secondary text |
| Border | `#D8E1DC` | structural border |
| Danger | `#E86F55` | destructive/error only |

### Logo exception

The local official Academy SVG currently has:

- primary: `#00031A`;
- accent: `#FCB415`.

These are **logo asset tokens**, not the main Academy UI palette. Do not shift the entire UI to navy/orange just to match the SVG defaults.

The SVG already exposes `--logo-primary` and `--logo-accent`; the canonical aliases are defined in `academy-tokens.css`.

## 4. Surface recipes

### Default light section

- background: `--aca-color-bg-page`
- heading: `--aca-color-text-heading`
- body: `--aca-color-text-secondary`
- border: `--aca-color-border`

### Alternate light section

- background: `--aca-color-bg-subtle`
- card: white
- brand marker: `--aca-color-brand`

### Dark / premium section

- background: `--aca-color-bg-inverse`
- heading/body primary: white
- secondary copy: white at 70–82% opacity
- primary accent: yellow
- border: white at 12–14%

### Highlight section

Use Yellow 100 for a small section/card, not Yellow 500 across large content areas.

## 5. Typography

Canonical family: **Inter**.

The current homepage already uses Inter and its geometry works with the Academy's large editorial headings and dense information cards.

| Role | Size | Weight | Line-height | Tracking |
| --- | --- | ---: | ---: | ---: |
| Display 1 | 56 → 108 | 900 | .88 | -.065em |
| Display 2 | 38 → 72 | 900 | .98 | -.055em |
| Title 1 | 32 → 54 | 900 | 1.0 | -.05em |
| Title 2 | 26 → 32 | 800 | 1.05 | -.04em |
| Title 3 | 23 | 800 | 1.08 | -.03em |
| Body Large | 18 | 400 | 1.55 | 0 |
| Body | 15 | 400 | 1.55 | 0 |
| Small | 14 | 400 | 1.55 | 0 |
| Label | 12 | 800 | 1.2 | +.12em |
| Caption | 11 | 600 | 1.35 | 0 |
| Micro | 10 | 800 | 1.3 | +.08em |

### Rules

- Large headings may use negative tracking.
- Body copy never uses negative tracking.
- Uppercase is reserved for eyebrow, metadata, tags, level and status.
- Keep paragraph measure around **520–820px**, depending on role.
- Do not use font size below 10px in production UI.

## 6. Spacing

Base unit: **4px**.

Primary scale:

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 56 / 64 / 80 / 96 / 104 / 120`

Use:

- 10–18px for local card/grid rhythm;
- 24–32px for card padding;
- 40–56px for section internal separation;
- 62–104px for section vertical rhythm.

Default page section spacing:

`clamp(62px, 7.2vw, 104px)`

## 7. Layout

| Token | Value |
| --- | ---: |
| Main max-width | 1240px |
| Readable wide copy | 820px |
| Normal copy | 520px |
| Standard grid gap | 18px |
| Header desktop | 86px |
| Header mobile | 68px |

Canonical responsive references:

| Breakpoint | px |
| --- | ---: |
| XS | 560 |
| SM | 760 |
| MD | 900 |
| LG | 980 |
| XL | 1200 |

Recommended grid:

- Desktop: 12 columns.
- Tablet: 6 columns.
- Mobile: 4 columns / often single-column composition.

Do not merely shrink desktop layouts on mobile. Recompose priority and reading order.

## 8. Radius

Use radius as hierarchy, not decoration.

| Role | Radius |
| --- | ---: |
| small control | 10–14 |
| normal card | 18–24 |
| featured card | 28 |
| media / story | 30–34 |
| hero media | 40 |
| pill | 999 |

Avoid mixing 12, 13, 15, 17, 19, 21px on the same surface.

## 9. Elevation

Academy is primarily **border-led**, not shadow-led.

Default card:

- 1px structural border;
- no shadow or `shadow-sm`.

Use shadow only when there is actual elevation:

- interactive hover;
- floating information;
- hero media;
- modal;
- sticky layer.

Do not stack border + strong shadow on every card.

## 10. Buttons

### Primary

- background: Green 700;
- text: white;
- height: 52px;
- horizontal padding: 22px;
- pill radius;
- weight: 800.

### Dark

- background: Green 950;
- text: white.

### Accent

- background: Yellow 500;
- text: Green 800.

### Ghost

- transparent/white;
- 1px border;
- text Green 800.

Interaction:

- hover: maximum 2px vertical lift;
- duration: 250ms;
- avoid scale animations;
- minimum pointer target: 44px.

## 11. Cards

Default Academy card:

- white;
- radius 24px;
- 1px border;
- padding 28px;
- no decorative gradient.

Featured cards may use:

- dark forest;
- brand green;
- yellow;
- photography.

Do not use more than one strong colored card per small visual cluster unless the layout intentionally forms a pattern.

## 12. Images

Academy imagery should prioritize:

1. real learning;
2. real Hang Đôi production;
3. learner output;
4. equipment/workflow;
5. commercial project evidence.

Avoid stock / AI images when a real Academy or Production asset exists.

Recommended aspect ratios:

- standard card: 4:5;
- wide editorial: 16:9;
- square result/product: 1:1.

Hero media may use a 40px radius. Standard media should generally use 24–30px.

## 13. Forms

- control height: 52px;
- radius: 14px;
- 1px neutral border;
- white background;
- visible label above field;
- placeholder is not a label;
- focus uses green ring;
- minimum touch target: 44px.

Validation:

- error uses Danger;
- do not use red for ordinary helper text;
- explain the corrective action, not only the error state.

## 14. Motion

Motion supports comprehension, not decoration.

| Token | Duration |
| --- | ---: |
| Fast | 150ms |
| Base | 250ms |
| Slow | 350ms |
| Media | 550ms |

Use cases:

- button/tab state: 150–250ms;
- accordion/menu: 250–350ms;
- media zoom: 550ms maximum.

Honor `prefers-reduced-motion`.

Avoid:

- continuous floating;
- excessive parallax;
- bouncing CTA;
- long entrance animation that delays content.

## 15. Accessibility

Minimum baseline:

- interactive hit target ≥ 44px;
- keyboard focus visible;
- no information conveyed by green/yellow alone;
- body text should meet WCAG AA contrast;
- dark sections use white/light text;
- reduced-motion support;
- headings remain hierarchical in DOM, regardless of visual size.

Canonical focus:

`0 0 0 3px rgba(35,150,83,.28)`

## 16. Component recipes

### Eyebrow

- Label token;
- uppercase;
- Green 700;
- optional 32–42px yellow marker.

### Section heading

- Display 2;
- max-width 900px;
- text heading color.

### Course card

- radius 28;
- white;
- media 16:9-ish / editorial cover;
- body padding 26–28;
- metadata separated by structural line.

### Journey / advantage card

- radius 24–28;
- 24–28px padding;
- one dominant message;
- strong color only when the card is intentionally featured.

### FAQ

- border-led;
- no full filled card necessary;
- 18–22px vertical rhythm;
- answer secondary text.

### Lead / CTA block

- brand or dark surface;
- display-size heading;
- one primary CTA;
- secondary CTA only when it serves a distinct action.

## 17. Legacy migration

The current codebase contains both old base tokens and Phase 2 aliases.

New canonical mapping:

| Legacy | Canonical |
| --- | --- |
| `--ink` | `--aca-color-text-heading` |
| `--ink-2` | `--aca-color-text-primary` |
| `--paper` | `--aca-color-bg-page` |
| `--paper-2` | `--aca-color-bg-soft` |
| `--green` | `--aca-color-brand-emphasis` |
| `--yellow` | `--aca-color-accent` |
| `--muted` | `--aca-color-text-secondary` |
| `--line` | `--aca-color-border-subtle` |
| `--radius` | `--aca-card-radius` |
| `--shadow` | `--aca-shadow-lg` |
| `--max` | `--aca-layout-max` |
| `--p2-green` | `--aca-color-brand` |
| `--p2-green-2` | `--aca-color-brand-emphasis` |
| `--p2-dark` | `--aca-color-bg-inverse` |
| `--p2-yellow` | `--aca-color-accent` |
| `--p2-ink` | `--aca-color-text-primary` |
| `--p2-muted` | `--aca-color-text-secondary` |
| `--p2-bg` | `--aca-color-bg-subtle` |
| `--p2-line` | `--aca-color-border` |

Legacy aliases remain in `site/academy-tokens.css` so migration can happen page-by-page.

## 18. Deprecated visual values

Do not use as new UI tokens:

- old lime `#B8F342` as the Academy primary;
- old warm paper `#F4F2EA` as the main page background;
- page-specific `--p2-*` names;
- arbitrary local radii;
- arbitrary green variants.

These may still appear in legacy source until migration is complete.

## 19. Source of truth

Machine-readable mirror:

`config/academy-design-tokens.json`

CSS implementation:

`site/academy-tokens.css`

Design / usage contract:

`docs/design-system/academy-tokens.md`

The canonical URL/domain contract remains separate and is governed by `AGENTS.md` and `docs/deployment-safety.md`.
