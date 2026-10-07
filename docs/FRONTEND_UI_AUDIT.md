# Frontend interaction audit

Baseline: `885d9c345da81463ea1a94875ce60023e717ffdc`. Request: improve the existing
Kampusia frontend as a functional academic workspace. Source audit precedes edits.

## Coverage and interaction trace

| Surface | Actual implementation and destination |
| --- | --- |
| Shell/sidebar/mobile drawer | `(app)/+layout.svelte`; shared role navigation, native modal drawer, active nested routes, POST `/logout`; authentication in hooks and layout. |
| Dashboards/statistics/shortcuts | `Dashboard.svelte` → `server/dashboard.ts` → role dashboard, semester, profile counts, KRS, scoped lecturer classes/grading, student results and attendance APIs. Counts are real; lecturer grading is sampled from only three classes. |
| Master data | `MasterDataPage`, `CatalogPage`, `ProfilePage`, semester/room/class routes → corresponding server loaders and save actions → Eden GET/POST/PATCH endpoints. Inactivation retains history. |
| Filters/search/pagination | `seamless-filter` → URL-backed GET navigation; `query.ts` clears list page; bounded server queries (20 rows). Reference lists are also paginated but several native filter selects expose only their current reference page. |
| Forms/dialogs/dropdowns | Shared `Modal` and `ReferenceCombobox`, plus repeated raw confirmation dialogs. Create/edit use query parameters; failed submissions preserve values. Some confirmations close unconditionally after failed writes. |
| Class tabs/teaching/schedule | URL-backed class workspace tabs; detail actions call class lecturer and weekly schedule APIs. A class has one documented regular schedule; lecturer assignments support multiple teachers. Meetings/attendance and grading use named actions. |
| Student KRS / adviser review | KRS loaders/actions and `KrsAction`, summary/classes/course-list components → self-service/adviser/admin KRS endpoints. Submission/review/cancellation have confirmation and server authorization. |
| Meetings / attendance | `MeetingManager`, `AttendanceRoster` → meeting/attendance service; Akademik owns meeting facts, lecturers record attendance; completed corrections remain administrative. Missing attendance is not ALPHA. |
| Grades / KHS / IPS / IPK | `GradingManager`, `AcademicResults` → grading and finalized-result APIs. Backend permissions and exact calculations govern editing/finalization. Duplicate add-component buttons and successful grading feedback without action context need correction. |
| Login / password / error feedback | Login and compulsory password-change forms use server actions; network failures return domain messages. No custom route error page or recoverable logout feedback exists at baseline. |
| Badges / notifications / empty / pending states | Badges contain meaningful text; lists have real empty states and navigation bars, dialogs have loading skeletons. There is no notification feed or decorative bell. Attendance history and results lack pending feedback. |

No screenshot fixtures or browser surfaces are available in this session. Source,
compiled rendering, behavior tests, and local HTTP checks are the available evidence;
hydrated browser/touch verification must be reported separately.

## Findings

### Keep

- Role-scoped navigation, shared native mobile drawer, active links and skip link.
- Typed Eden-backed records, server validation, bounded lists, and academic history.
- Contextual class actions, URL-backed tabs, KRS confirmation, and read-only oversight.
- Existing neutral/green design, locally hosted Public Sans, and textual status badges.

### Improve

- Explain that both lecturer grading metrics concern the displayed three classes.
- Align pending feedback, table/control styling, touch targets and form typography.
- Distinguish an empty filtered list from having no assignments or KRS at all.
- Give reference-filter search/pagination one reusable, discoverable pattern.

### Fix (priority order)

1. Reference keyboard loop can never terminate when all options are disabled and
   the active index is -1; Enter can submit the surrounding form before results exist.
2. Absolutely positioned reference dropdowns are clipped by scrollable modal bodies;
   Escape also reaches the parent modal, and focus is not returned after selection.
3. Master/catalog/profile/curriculum confirmations dismiss on failed writes, hiding
   useful context and forcing users to restart the action.
4. Reference choices beyond page one are unreachable on several primary data filters.
5. Out-of-range pagination produces inverted ranges and misleading empty lists.
6. Successful grading messages lose their mode, so the grading component hides them;
   attendance failures do not render submitted row values after a normal POST.
7. Failed navigation/logout lacks contextual retry feedback; default route errors
   provide no academic-workspace recovery.

### Remove

- Duplicate add-component action in the grading empty table.
- Duplicate KRS reference-search/pagination sections after consolidation.
- Raw UUIDs from selected-curriculum filter labels and technical calculation jargon
  from student-facing explanatory text.

### Missing functionality

- No notification backend/feed: do not add a bell or fake messages.
- No dedicated student profile or weekly-schedule endpoint/page. Existing KRS already
  exposes selected-class schedule data. A standalone self-service profile/schedule
  workflow needs a separately defined read contract and access scope.
- No full lecturer grading-summary endpoint. Aggregate metrics across all classes
  would need a bounded server summary; do not fetch every class/roster in the browser.

### Needs business clarification

- Repeated-course replacement in IPK is not institutionally defined. Preserve the
  documented count-all-finalized-attempts model and its visible explanation.
- Attendance metadata/corrections and in-use curriculum/course retention have explicit
  rules in `docs/DATABASE.md`; preserve them even if an alternative flow looks simpler.
- No institutional notification, student-profile editing or official KHS issuance
  policy is defined. This task does not invent those capabilities.

## Implementation order

1. Shell: accurate academic navigation labels, account dismissal, logout feedback,
   route recovery and navigation status.
2. Dashboard: honest grading scope and direct pending-KRS destination.
3. Data pages: reusable reference lookup, filtered empty states and pagination recovery.
4. Forms: bounded reference navigation, top-layer dropdown/focus behavior, confirmation
   failure retention, grading success and attendance input feedback.
5. Shared design: semantic tokens, readable controls, mobile targets and pending states.
6. Final standards/spec review, type checks, tests, builds and local HTTP verification.

## Implemented improvements

- Shell and dashboards: consistent Manajemen KRS naming, pending-review shortcut,
  account-menu dismissal on navigation, cross-page progress, honest lecturer metric
  scope, and incomplete-result labeling for students.
- Data pages: shared reference-filter search/pagination, stale-page recovery, useful
  filtered empty states, and progress feedback on results and attendance history.
- Forms: bounded reference keyboard navigation, Enter protection, native top-layer
  dropdown positioning with a fixed-position fallback, focus return, Escape isolation,
  lookup retry, and a separate accessible clear control.
- Confirmations: shared dialog behavior retains failed submissions and shows retry
  feedback. Successful grading feedback retains its action mode; attendance failures
  preserve row input. Completion controls explain outstanding attendance.
- Design: shared warm neutral tokens, readable borders/text, consistent 44px controls,
  mobile form typography, restrained login composition, and reduced-motion support.
- Recovery: route errors explain invalid queries and offer workspace/retry actions;
  the static fallback also covers hook-level permission and authentication failures.

Backend endpoints, schemas, migrations, academic rules and authorization are unchanged.
In particular, full classes remain selectable in draft KRS: capacity is authoritative
at approval under the existing documented policy. No notification, profile or
aggregate-statistics capability was fabricated.

## Verification and remaining limits

- `bun run check`: all workspaces pass; Svelte reports zero errors and warnings.
- Frontend `bun run --bun build`: production client and SSR build pass.
- `bun test apps/web/src/lib`: 64 pass, 7 opt-in integration tests skip, zero failures.
- Full `bun test`: 295 pass, 28 skip, 3 failures. All three failures reproduce from
  the unchanged baseline in `apps/api/src/modules/krs/krs.test.ts`: fixtures end their
  KRS window on 2026-10-01, but these service instances use the real clock. They are
  unrelated to frontend changes and remain visible rather than weakening validation.
- Actual source reproduction of the all-disabled reference keyboard loop: fails
  before the change, returns after the change. New behavior tests cover bounded
  reference navigation, failed confirmations, and out-of-range pagination.
- Local HTTP checks pass for ADMIN, AKADEMIK and DOSEN: dashboards and navigation,
  ten administrative lists, create/edit URLs, search, five reference lookups, invalid
  input retention, filtered empty states, stale/invalid query recovery, permission
  recovery, 404 recovery, logout and session revocation. Academic records were not
  changed. The existing demo MAHASISWA credential was rejected; credentials were
  not reset to enable testing.
- Compiled SSR checks pass for student empty/incomplete-result dashboards, retained
  attendance input, disabled incomplete-roster completion, grading success feedback
  and active-column empty-table layout.
- Final Standards and Spec reviews have no remaining actionable findings. The two
  initial Standards findings (login footer contrast and Escape on secondary popup
  controls) were corrected and reviewed again.
- Source review covers responsive breakpoints, horizontal tables, native mobile
  navigation and touch targets. Hydrated browser, focus/geometry and touch/mobile
  visual verification could not run because no browser surface was available.

## Form-control follow-up (2026-10-07)

Baseline: `1bab822`. A source-wide inventory found 27 native-select locations,
including repeated controls generated by `AcademicFields` and class-filter loops.
The closed fields were themed, but their opened browser/OS menus were inconsistent
with the existing searchable reference controls. Checkboxes still used default
browser rendering, and optional date/time fields misleadingly displayed required
asterisks through `AcademicFields`.

| Audited controls | Result |
| --- | --- |
| Jenjang; active/academic/KRS/class/attendance status; semester type; weekday; Wajib/Pilihan; coordinator | Replaced with the shared accessible `ui/SelectField.svelte`, including filters and editing forms. |
| Fakultas, Program Studi, Kurikulum, Mata Kuliah, semester reference filters | Replaced with the existing paginated `ReferenceCombobox`; its existing search and page parameters are retained. |
| Dosen, adviser and room references | Existing searchable comboboxes retained and upgraded with shared popup styling, unique IDs and native validation backing. |
| KHS semester selection | Searchable `SelectField` over the complete already-loaded semester list; no extra API or remote search is needed. |
| Checkbox confirmations | Native semantics retained; shared themed checks, borders, disabled/focus states and label targets. |
| Date/time/datetime-local | Native pickers retained deliberately for keyboard entry, platform accessibility and date/time validation; shared field appearance and indicator treatment. Values and WIB handling remain unchanged. |
| Radios, switches, datalist autocomplete, file/color/range inputs | No existing form instances found. Radio CSS shares checkbox tokens and a forced-color fallback; no new controls/workflows added. |
| Login/password autocomplete; numeric entry; disclosure menus | Existing browser semantics retained; authentication autocomplete is useful, while disclosure content already uses custom styled panels. No duplicate control implementation introduced. |

The searchable reference filter's secondary lookup panel now serves only the
no-JavaScript fallback; enhanced users search inside the combobox. Shared popup
positioning uses the top layer above modal/table clipping, tracks viewport changes,
and falls back to fixed positioning when the popover API is unavailable.

Native select audit after migration:

- `apps/web/src/lib/components/ui/SelectField.svelte`: intentionally retained as
  hidden enhanced form/validation/reset backing and the visible no-JavaScript path.
- `apps/web/src/lib/components/ReferenceCombobox.svelte`: retained for the same
  purposes, with reference IDs and selected values preserved across pagination.
- No native select remains directly in a route, editing form or generic
  `AcademicFields` renderer. All 27 original locations were migrated.

Selection sends a bubbling change event from its form backing so existing GET
filters still apply automatically. Popup search typing and consumed Enter keys do
not submit the surrounding filter. Lookup restoration matches named fields and
occurrences instead of shifting button/search-input positions, and synchronizes
the custom display. Validation focuses the visible trigger; reset updates its
display; disabled controls/options cannot commit. Escape preserves the selected
value. IDs distinguish simultaneous filter/edit and repeated attendance fields.

Verification: 73 frontend tests pass (7 opt-in integration tests skipped), all
workspace type checks pass with zero Svelte warnings, and the production build
passes. The full suite reports 304 pass, 28 skip and the same three previously
baseline-confirmed date-dependent KRS failures. Nine focused tests exercise compiled fallback markup
and the actual shipped handlers: enums/required/disabled attributes, unique IDs,
selection/change, keyboard/typeahead, Escape/Tab, filtered search, validation focus,
reset and lookup restoration. Local HTTP checks cover ADMIN/AKADEMIK/DOSEN
navigation, ten data pages, edit/create URLs, existing lookup parameters, invalid
submissions and retained input. An invalid Program Studi POST specifically retains
Jenjang S1, its faculty choice and typed name. Academic records were not changed. The existing
student demo credential remains rejected; student UI contracts are covered by
frontend tests and rendering.

Standards: initial contrast concern fixed with a shared 3.70:1 control-border token;
no remaining actionable findings. Spec: no actionable findings. No backend code,
endpoint, schema, migration or academic policy changed.

No browser surface was available. Actual browser constraint validation/FormData,
Tab traversal, popup positioning, opened visual appearance and touch/mobile
behavior still need browser execution; handler and rendering tests do not establish
those browser behaviors conclusively. Date/time picker interiors intentionally
remain platform-provided.
