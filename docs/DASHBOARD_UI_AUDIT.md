# Dashboard UI audit and redesign

Scope: the shared authenticated shell and Admin, Akademik, Dosen, and Mahasiswa
dashboards. Evidence: source inspection of the incumbent components, calculated
color contrast, frontend checks, and server-rendered pages. No browser surface
was available, so this is not a screenshot or physical-device accessibility
audit. The Impeccable engine was unavailable; its references were read directly.

## Findings in the previous UI

Provisional source-audit assessment of the previous UI: **12/20**. These scores
describe implementation evidence; they do not certify runtime accessibility.

| Dimension | Score | Evidence |
| --- | --- | --- |
| Accessibility | 2/4 | Existing semantics and focus styling; low-contrast labels and offscreen focusable navigation. |
| Performance | 4/4 | Lean shared components, bounded server data, and no heavy media or chart dependencies. |
| Responsive design | 2/4 | Existing breakpoints; small navigation targets and cramped class rows. |
| Theming | 2/4 | Brand tokens existed alongside repeated literal surface colors. |
| Implementation integrity | 2/4 | Typed, real academic content; inconsistent typography and repetitive card hierarchy. |

| Priority | Finding and impact | Location | Implemented response |
| --- | --- | --- | --- |
| P1 | Small sidebar labels used slate-400 on white, approximately 2.56:1 contrast, below WCAG AA for ordinary text. Section names were difficult to read. | App layout | Larger labels and high-contrast text on the navigation rail. |
| P1 | Mobile navigation was moved offscreen using a transform while its links remained focusable. It lacked focus containment while open. | App layout | Hidden desktop aside and a native mobile dialog with focus containment and background inertness. |
| P2 | Menu controls were 36–40px; sidebar link heights were approximately 40px. Compact targets made touch navigation harder. | App layout | Navigation, dismissal, and account controls use a 44px minimum height. |
| P2 | Inter was declared but never loaded, leaving typography dependent on installed fonts. | app.css | Locally hosted Public Sans variable font, fallback stack, and license. |
| P2 | Canvas colors were repeated as literals and shadow/border treatments competed across panels. | app.css, dashboard, shell | Shared semantic surface tokens and restrained border-based panels. |
| P2 | Similar icon cards and repeated uppercase labels gave context, totals, and actions nearly equal emphasis. | Dashboard and StatCard | A prominent semester panel, grouped totals, direct section headings, and joined shortcut rows. |
| P2 | Lecturer rows kept course identity, status, and arrow on one line on narrow screens. | Dashboard | Rows wrap, with status on a separate line below 400px. |
| P3 | The account dropdown remained open after outside interaction or Escape. | App layout | Outside-pointer and Escape dismissal retain the original logout form. |

The previous UI already had typed role-specific data, semantic status labels,
reusable icons/components, responsive metric grids, native account controls,
and reduced-motion styling. These strengths are preserved. No heavy animation,
imagery, chart package, or frontend runtime dependency was added.

## System decisions

See [DESIGN.md](../DESIGN.md) for palette, typography, composition, and
interaction rules. All existing navigation groups, shortcuts, metrics,
semester states, class/grading statuses, adviser details, account identity,
and logout behavior remain. Backend loaders, APIs, business rules, database
schemas, migrations, and academic records were not changed.

Calculated contrast for the new color pairs:

| Text / background | Contrast |
| --- | --- |
| Secondary text / canvas | 4.86:1 |
| Secondary text / white panel | 5.32:1 |
| Navigation section label / sidebar | 5.94:1 |
| Navigation text / sidebar | 7.87:1 |
| Selected navigation text / highlight | 9.11:1 |
| White / primary action green | 7.68:1 |

These cover the changed shell and dashboard token pairs, not every color in the
whole application.

## Verification

- Frontend tests: 57 passed; 7 opt-in integration tests skipped.
- Svelte/TypeScript check: zero errors and warnings.
- Production frontend build: passed.
- Live local HTTP checks for Admin, Akademik, and Dosen: dashboard content, all
  four metrics, shortcuts, account identity, related workspace, role restriction,
  and logout/session revocation passed.
- Student dashboard: compiled server-render checks passed for empty and
  populated semester/KRS/adviser/results states. Its existing demo account
  rejects the configured seed password, preventing authenticated HTTP coverage.
  No account or password was modified.
- Self-hosted font: served successfully by the local frontend.
- Source/diff review: no backend modifications.

Desktop/mobile screenshot inspection, hydrated drawer/account behavior,
keyboard navigation, zoom, and physical touch interaction still require browser
verification. No full WCAG conformance or visual-regression claim is made.
