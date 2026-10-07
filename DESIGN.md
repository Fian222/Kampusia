# Kampusia UI design

The dashboard uses an academic workspace visual system: warm neutral working
surfaces, a deep green navigation rail, and restrained green actions. The
interface should make existing academic information easy to scan.

## Palette

Use semantic tokens in apps/web/src/app.css:

| Role | Token | Value |
| --- | --- | --- |
| Workspace canvas | --color-canvas | #f5f5ef |
| Navigation and primary text | --color-ink | #183d39 |
| Secondary text | --color-muted | #626e68 |
| Panel boundaries | --color-line | #dfe4da |
| Primary actions | --color-brand-700 | #245d48 |
| Subtle emphasis | --color-brand-50 | #eef4e9 |
| Selected navigation and semester action | --color-highlight | #d5e9ad |

Status badges retain their existing semantic success, warning, danger, neutral,
and information colors. Color accompanies text rather than replacing it.

## Typography and layout

Public Sans is locally hosted under apps/web/static/fonts with its SIL Open
Font License. Use the variable font for labels, headings, and values, with
system fallbacks and font-display swap. Tabular numerals align academic data.

Dashboard headings use a fixed responsive scale, 26px on compact screens and
30px on larger screens. Semester titles are 24–28px; section titles are 18px;
body and controls use 13–16px. Group metadata closely, and leave 28–36px
between major sections.

The fixed desktop sidebar is 264px wide. Below 1024px, navigation uses a native
modal drawer. Desktop and mobile navigation share one Svelte snippet. The
header contains current location and the existing account/logout menu.

## Dashboard composition

Semester context leads the manager and student dashboards. Totals sit in a
single bordered metric strip: two columns on compact layouts and four at
1280px and above. The lecturer dashboard retains its newest classes and
grading statuses. Shortcuts use joined action rows, with one column on mobile
and two on larger screens; a final unpaired shortcut spans the full row.

Panels use 12–16px radii and thin boundaries. Reserve stronger shadow depth for
overlays. Use existing SVG icons consistently. Avoid decorative charts,
fabricated trends, page-load choreography, and extra academic claims.

## Interaction and accessibility

Navigation and account controls have at least 44px height. The mobile drawer
uses native focus containment, Escape dismissal, background inertness, and
focus return. Close it on selection and when crossing the desktop breakpoint.
Keep aria-current on active links and the skip-to-content link.

Sidebar scrolling stays native with overflow-y auto. Use a thin scrollbar,
transparent track, and muted green thumb that becomes slightly clearer on hover
or keyboard focus within navigation. Use standard properties for Firefox and a
6px rounded thumb for Chromium; preserve native rendering in forced-color mode.

Use visible keyboard focus, text with adequate contrast, reduced-motion
alternatives, wrapping semester/adviser text, and existing empty-state copy.
Preserve all route destinations, data sources, calculations, and permissions.

Use the shared surface, line and warm neutral tokens across forms and tables. Keep
administrative rows compact while giving buttons and form controls 44px targets.
Mobile form text is 16px; wide academic tables retain horizontal scrolling.

Reference fields search the existing paginated APIs. Their dropdowns use the native
popover top layer above scrollable dialogs, with bounded keyboard navigation,
focus return and contextual retry. Reference filters share one secondary search and
pagination panel; selected IDs remain ordinary URL filter parameters.

Failed confirmation submissions stay open with their context and feedback. Keep
pending feedback close to the affected list or form, and provide workspace recovery
for both route errors and hook-level failures. Dashboard metrics must identify any
limited class scope or incomplete academic result.
