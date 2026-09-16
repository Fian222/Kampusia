import { expect, test } from 'bun:test';
import { hasActiveQuery, queryHref, resetQueryHref } from './navigation/query';
import { isListNavigationPending } from './navigation/pending';
import { createNavigationScheduler } from './navigation/scheduler';

const sourceRoot = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${sourceRoot}/${path}`).text();

test('filter query changes reset the list page and preserve unrelated filters', () => {
  const url = new URL('https://kampusia.test/akademik/mahasiswa?search=andi&status=AKTIF&angkatan=2026&page=4');
  expect(queryHref(url, { search: 'budi' }, { resetPage: true })).toBe(
    '/akademik/mahasiswa?search=budi&status=AKTIF&angkatan=2026',
  );
});

test('empty filters are removed while pagination retains the active query', () => {
  const url = new URL('https://kampusia.test/akademik/kelas-kuliah?search=basis&status=DIBUKA&page=2');
  expect(queryHref(url, { status: null }, { resetPage: true })).toBe('/akademik/kelas-kuliah?search=basis');
  expect(queryHref(url, { page: 3 })).toBe('/akademik/kelas-kuliah?search=basis&status=DIBUKA&page=3');
});

test('reference pagination resets its own page without dropping modal context', () => {
  const url = new URL('https://kampusia.test/akademik/kelas-kuliah?modal=create&semester_page=5&course_page=3');
  expect(queryHref(url, { semester_search: '2026' }, { resetPage: true, pageKey: 'semester_page' })).toBe(
    '/akademik/kelas-kuliah?modal=create&course_page=3&semester_search=2026',
  );
});

test('reset visibility follows meaningful filters and reset preserves unrelated query context', () => {
  const idle = new URL('https://kampusia.test/akademik/mahasiswa?page=3');
  expect(hasActiveQuery(idle, ['search', 'status', 'angkatan'])).toBe(false);

  const filtered = new URL('https://kampusia.test/akademik/mahasiswa?search=andi&status=AKTIF&page=4&program_search=if');
  expect(hasActiveQuery(filtered, ['search', 'status', 'angkatan'])).toBe(true);
  expect(resetQueryHref(filtered, ['search', 'status', 'angkatan'])).toBe(
    '/akademik/mahasiswa?program_search=if',
  );
});

function fakeTimers() {
  let nextId = 0;
  const jobs = new Map<number, () => void>();
  return {
    jobs,
    schedule(callback: () => void) {
      const id = ++nextId;
      jobs.set(id, callback);
      return id;
    },
    cancel(handle: unknown) {
      jobs.delete(handle as number);
    },
    flush() {
      const callbacks = [...jobs.values()];
      jobs.clear();
      callbacks.forEach(callback => callback());
    },
  };
}

test('idle, completed, and failed navigation states do not leave lists pending', () => {
  const navigation: { to: { url: URL } | null } = { to: null };
  expect(isListNavigationPending(navigation, '/akademik/mahasiswa')).toBe(false);
  navigation.to = { url: new URL('https://kampusia.test/akademik/mahasiswa?search=andi') };
  expect(isListNavigationPending(navigation, '/akademik/mahasiswa')).toBe(true);
  navigation.to = null;
  expect(isListNavigationPending(navigation, '/akademik/mahasiswa')).toBe(false);
});

test('same-URL and failed navigation do not lock later explicit submissions', async () => {
  let current = '/akademik/mahasiswa?search=andi';
  let target = current;
  let fail = false;
  const navigated: string[] = [];
  const scheduler = createNavigationScheduler({
    currentHref: () => current,
    targetHref: () => target,
    navigate: async href => {
      navigated.push(href);
      if (fail) throw new Error('navigation failed');
      current = href;
    },
  });

  expect(await scheduler.immediate()).toBe(false);
  expect(navigated).toEqual([]);
  target = '/akademik/mahasiswa?search=budi';
  fail = true;
  expect(await scheduler.immediate()).toBe(false);
  fail = false;
  target = '/akademik/mahasiswa?search=citra';
  expect(await scheduler.immediate()).toBe(true);
  expect(navigated).toEqual(['/akademik/mahasiswa?search=budi', '/akademik/mahasiswa?search=citra']);
});

test('text navigation is debounced but an explicit submit runs immediately and cancels it', async () => {
  const timers = fakeTimers();
  let target = '/akademik/mahasiswa?search=andi';
  const navigated: string[] = [];
  const scheduler = createNavigationScheduler({
    currentHref: () => '/akademik/mahasiswa',
    targetHref: () => target,
    navigate: async href => { navigated.push(href); },
    schedule: (callback, delay) => {
      expect(delay).toBe(320);
      return timers.schedule(callback);
    },
    cancel: handle => timers.cancel(handle),
  });

  scheduler.debounce();
  target = '/akademik/mahasiswa?search=andini';
  scheduler.debounce();
  expect(navigated).toEqual([]);
  expect(timers.jobs.size).toBe(1);

  await scheduler.immediate();
  expect(navigated).toEqual(['/akademik/mahasiswa?search=andini']);
  expect(timers.jobs.size).toBe(0);
  timers.flush();
  expect(navigated).toHaveLength(1);

  scheduler.debounce();
  scheduler.destroy();
  timers.flush();
  expect(navigated).toHaveLength(1);
});

test('rapid explicit changes are handed to SvelteKit immediately so the newest can win', async () => {
  let target = '/akademik/semester?jenis=GANJIL';
  const navigated: string[] = [];
  const scheduler = createNavigationScheduler({
    currentHref: () => '/akademik/semester',
    targetHref: () => target,
    navigate: async href => { navigated.push(href); },
  });
  const first = scheduler.immediate();
  target = '/akademik/semester?jenis=GENAP';
  const second = scheduler.immediate();
  await Promise.all([first, second]);
  expect(navigated).toEqual(['/akademik/semester?jenis=GANJIL', '/akademik/semester?jenis=GENAP']);
});

test('all GET forms use seamless navigation and POST action forms remain POST forms', async () => {
  const glob = new Bun.Glob('**/*.svelte');
  for await (const path of glob.scan({ cwd: sourceRoot, onlyFiles: true })) {
    const source = await read(path);
    for (const form of source.match(/<form\b[^>]*\bmethod="GET"[^>]*>/g) ?? []) {
      expect(form, path).toContain('use:seamlessFilter');
      expect(form, path).not.toContain('use:enhance');
    }
  }

  const detail = await read('routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte');
  expect(detail).toContain('action="?/detail"');
  const meeting = await read('lib/components/MeetingManager.svelte');
  expect(meeting).toContain("const action = '?/meeting';");
  const grading = await read('lib/components/GradingManager.svelte');
  expect(grading).toContain('action="?/grading"');
});

test('auto-applied GET forms hide normal Apply buttons but retain native noscript submission', async () => {
  const glob = new Bun.Glob('**/*.svelte');
  let formCount = 0;
  for await (const path of glob.scan({ cwd: sourceRoot, onlyFiles: true })) {
    const source = await read(path);
    for (const form of source.match(/<form\b[^>]*\bmethod="GET"[^>]*>[\s\S]*?<\/form>/g) ?? []) {
      formCount += 1;
      expect(form, path).toContain('use:seamlessFilter');
      expect(form, path).toMatch(/<noscript>[\s\S]*?<button\b/);
      const enhancedMarkup = form.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
      expect(enhancedMarkup, path).not.toMatch(/<button\b[^>]*>\s*(?:Terapkan(?: filter)?|Cari(?: kelas| pilihan)?|Tampilkan)\s*<\/button>/i);
    }
  }
  expect(formCount).toBeGreaterThan(0);
});

test('paginated modal reference selectors are no longer permanent list-page sections', async () => {
  for (const path of [
    'lib/components/MasterDataPage.svelte',
    'lib/components/CatalogPage.svelte',
    'lib/components/ProfilePage.svelte',
    'routes/(app)/akademik/kelas-kuliah/+page.svelte',
    'routes/(app)/akademik/kurikulum/[id]/+page.svelte',
  ]) {
    const source = await read(path);
    const modal = source.indexOf('<Modal');
    expect(modal, path).toBeGreaterThan(-1);
    expect(source.slice(0, modal), path).not.toMatch(/aria-label="(?:Cari pilihan|Pilihan |Cari fakultas|Cari program studi)/);
  }
});

test('seamless filter action debounces search and uses non-scrolling replace navigation', async () => {
  const source = await read('lib/actions/seamless-filter.ts');
  const scheduler = await read('lib/navigation/scheduler.ts');
  expect(scheduler).toContain('options.debounce ?? 320');
  expect(source).toContain('replaceState: true');
  expect(source).toContain('noScroll: true');
  expect(source).toContain('keepFocus: true');
  expect(source).toContain('preserveDialogForm(form)');
  expect(source).toContain("new Option(snapshot.selectedLabel ?? 'Pilihan tersimpan', snapshot.value)");
  expect(source).toContain("form.addEventListener('submit', submit)");
  expect(source).toContain("form.addEventListener('click', click)");
  expect(source).toContain("form.addEventListener('keydown', keydown)");
  expect(source).toContain("event.key !== 'Enter'");
  expect(source).toContain('void scheduler.immediate()');
  expect(source).toContain('scheduler.debounce()');
  expect(source).toMatch(/const change[\s\S]*?scheduler\.immediate\(\)/);
  const helper = await read('lib/navigation/query.ts');
  expect(helper).toContain('params.delete(pageKey)');
});

test('list tables are clear while idle and filter submit buttons are not navigation-disabled', async () => {
  for (const path of [
    'lib/components/MasterDataPage.svelte',
    'lib/components/CatalogPage.svelte',
    'lib/components/ProfilePage.svelte',
    'routes/(app)/akademik/semester/+page.svelte',
    'routes/(app)/akademik/kelas-kuliah/+page.svelte',
    'routes/(app)/akademik/ruangan/+page.svelte',
    'routes/(app)/akademik/krs/+page.svelte',
    'routes/(app)/akademik/kurikulum/[id]/+page.svelte',
  ]) {
    const source = await read(path);
    expect(source, path).not.toContain('!!navigating');
    expect(source, path).not.toMatch(/class:opacity-(?:50|60)=/);
    expect(source, path).not.toMatch(/blur-[^\s"']*.*listPending/);
    expect(source, path).not.toMatch(/disabled=\{[^}]*navigating/);
    if (source.includes('class:opacity-80=')) expect(source, path).toContain('class:opacity-80={listPending}');
  }
});
