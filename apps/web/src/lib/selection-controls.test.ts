import { afterAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { nextEnabledOption } from './navigation/reference-options';
import type { SelectOption } from './components/ui/SelectField.svelte';

const source = await Bun.file(new URL('./components/ui/SelectField.svelte', import.meta.url)).text();
const directory = await mkdtemp(join(import.meta.dir, '../../.svelte-kit/select-test-'));
afterAll(() => rm(directory, { recursive: true, force: true }));
const iconSource = await Bun.file(new URL('./components/ui/Icon.svelte', import.meta.url)).text();
await Bun.write(join(directory, 'Icon.js'), compile(iconSource, { generate: 'server', filename: 'Icon.svelte' }).js.code);
const compiled = compile(source, { generate: 'server', filename: 'SelectField.svelte' }).js.code
  .replace("'./Icon.svelte'", "'./Icon.js'")
  .replaceAll("'$lib/", `'${import.meta.dir}/`);
await Bun.write(join(directory, 'SelectField.js'), compiled);
const SelectField = (await import(join(directory, 'SelectField.js'))).default as Component<Record<string, unknown>>;

test('selection fallback keeps exact enum values, selected value, required and disabled semantics', () => {
  const body = render(SelectField, { props: { name: 'jenjang', label: 'Jenjang', value: 'S1', required: true, options: [{ value: 'S1', label: 'Sarjana' }, { value: 'S2', label: 'Magister', disabled: true }] } }).body;
  expect(body).toContain('name="jenjang"');
  expect(body).toContain('required');
  expect(body).toMatch(/value="S1"[^>]*selected/);
  expect(body).toMatch(/value="S2"[^>]*disabled/);
  expect(body).toContain('Sarjana');
  expect(body).not.toContain('role="combobox"'); // A usable native field precedes enhancement.
  const disabled = render(SelectField, { props: { name: 'status', label: 'Status', disabled: true, options: [] } }).body;
  expect(disabled).toMatch(/<select[^>]* disabled/);
});

test('selection IDs distinguish repeated attendance controls and filter/edit field names', () => {
  const Pair: Component = (renderer) => {
    SelectField(renderer, { name: 'status', label: 'Status pertama', options: [] });
    SelectField(renderer, { name: 'status', label: 'Status kedua', options: [] });
    return {};
  };
  const body = render(Pair).body;
  const ids = [...body.matchAll(/<select[^>]* id="([^"]+)"/g)].map(match => match[1]);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
});

// Exercise the shipped component's handlers directly; DOM painting is separately browser-dependent.
function controls(options: SelectOption[], initialValue = '', isDisabled = false, searchable = false) {
  const handlers = source.slice(source.indexOf('  onMount(() =>'), source.indexOf('</script>'))
    .replace(/  \$effect\(\(\) => \{ if \(disabled\) open = false; \}\);/, '');
  const filter = /const visibleOptions = \$derived\((.*)\);/.exec(source)?.[1];
  const search = /oninput=\{event => \{ (.*?) \}\}/.exec(source)?.[1];
  const invalidHandler = /oninvalid=\{event => \{ (.*) \}\}>/.exec(source)?.[1];
  if (!filter || !search || !invalidHandler) throw new Error('Missing selection handlers');
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(handlers).replaceAll('visibleOptions', 'filteredOptions()');
  const factory = new Function('options', 'initialValue', 'disabled', 'nextEnabledOption', 'searchable', `
    let value = initialValue, open = false, enhanced = false, query = '', activeIndex = -1, invalid = false, typed = '', typedAt = 0;
    const id = 'test'; function filteredOptions() { return ${filter}; }
    const events = [], listeners = new Map(); let focuses = 0;
    const trigger = { focus() { focuses++; } }, searchInput = trigger;
    const native = { value, form: { addEventListener(name, listener) { listeners.set(name, listener); }, removeEventListener() {} }, addEventListener(name, listener) { listeners.set(name, listener); }, removeEventListener() {}, dispatchEvent(event) { events.push({ type: event.type, bubbles: event.bubbles, value: this.value }); } };
    const document = { getElementById() { return null; } };
    const label = 'Jenjang';
    const onMount = callback => callback();
    const tick = async () => { native.value = value; };
    ${js}
    return { choose, async key(key) { let prevented = false, stopped = false; keydown({ key, target: trigger, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } }); await tick(); return { prevented, stopped }; }, snapshot() { return { value, open, activeIndex, focuses, events, invalid }; }, search(text) { const event = { currentTarget: { value: text } }; ${search.replaceAll('visibleOptions', 'filteredOptions()')} }, invalid() { let prevented = false; const event = { preventDefault() { prevented = true; } }; ${invalidHandler} return prevented; }, async reset(next) { native.value = next; listeners.get('reset')(); await Promise.resolve(); }, restore(next) { native.value = next; listeners.get('kampusia:restore')(); } };
  `);
  return factory(options, initialValue, isDisabled, nextEnabledOption, searchable) as {
    choose(option?: SelectOption): Promise<void>;
    key(key: string): Promise<{ prevented: boolean; stopped: boolean }>;
    search(text: string): void; invalid(): boolean;
    snapshot(): { invalid: boolean; value: string; open: boolean; activeIndex: number; focuses: number; events: { type: string; bubbles: boolean; value: string }[] };
    reset(value: string): Promise<void>; restore(value: string): void;
  };
}

test('keyboard navigation skips disabled choices, accepts selection and emits the form change', async () => {
  const control = controls([{ value: 'D3', label: 'Diploma', disabled: true }, { value: 'S1', label: 'Sarjana' }, { value: 'S2', label: 'Magister' }]);
  expect((await control.key('ArrowDown')).prevented).toBe(true);
  expect(control.snapshot().activeIndex).toBe(1);
  await control.key('ArrowDown');
  await control.key('Enter');
  expect(control.snapshot()).toMatchObject({ value: 'S2', open: false, events: [{ type: 'change', bubbles: true, value: 'S2' }] });
});

test('Escape and Tab close without changing the value and return focus to the trigger', async () => {
  const control = controls([{ value: 'S1', label: 'Sarjana' }, { value: 'S2', label: 'Magister' }], 'S1');
  await control.key('ArrowDown'); await control.key('ArrowDown');
  expect(await control.key('Escape')).toEqual({ prevented: true, stopped: true });
  expect(control.snapshot()).toMatchObject({ value: 'S1', open: false, focuses: 1, events: [] });
  await control.key('Enter');
  expect((await control.key('Tab')).prevented).toBe(false);
  expect(control.snapshot()).toMatchObject({ value: 'S1', open: false, focuses: 2 });
});

test('Home, End and typeahead navigate enabled options; disabled controls cannot commit', async () => {
  const options = [{ value: 'S1', label: 'Sarjana' }, { value: 'S2', label: 'Magister', disabled: true }, { value: 'S3', label: 'Doktor' }];
  const control = controls(options);
  await control.key('End'); expect(control.snapshot().activeIndex).toBe(2);
  await control.key('Home'); expect(control.snapshot().activeIndex).toBe(0);
  await control.key('d'); await control.key('Enter'); expect(control.snapshot().value).toBe('S3');
  await control.choose(options[1]); expect(control.snapshot().value).toBe('S3');
  const disabled = controls(options, 'S1', true);
  await disabled.key('Enter'); await disabled.choose(options[2]);
  expect(disabled.snapshot()).toMatchObject({ value: 'S1', open: false, events: [] });
});

test('all-disabled lists terminate and form reset/lookup restoration synchronize displayed values', async () => {
  const control = controls([{ value: 'S1', label: 'Sarjana', disabled: true }]);
  await control.key('ArrowDown'); await control.key('ArrowUp'); await control.key('Enter');
  expect(control.snapshot()).toMatchObject({ value: '', activeIndex: -1, events: [] });
  await control.reset('S1'); expect(control.snapshot().value).toBe('S1');
  control.restore(''); expect(control.snapshot().value).toBe('');
});


test('searchable local choices filter before keyboard acceptance and empty searches cannot commit', async () => {
  const control = controls([{ value: '20261', label: 'Ganjil 2026' }, { value: '20262', label: 'Genap 2026' }], '', false, true);
  await control.key('Enter'); control.search('genap'); await control.key('Enter');
  expect(control.snapshot()).toMatchObject({ value: '20262', events: [{ type: 'change', bubbles: true, value: '20262' }] });
  await control.key('Enter'); control.search('Tidak cocok'); await control.key('Enter');
  expect(control.snapshot()).toMatchObject({ value: '20262', activeIndex: -1, open: true });
});

test('required validation directs focus to the visible control and clears after choosing', async () => {
  const control = controls([{ value: 'S1', label: 'Sarjana' }]);
  expect(control.invalid()).toBe(true);
  expect(control.snapshot()).toMatchObject({ invalid: true, focuses: 1 });
  await control.choose({ value: 'S1', label: 'Sarjana' });
  expect(control.snapshot()).toMatchObject({ invalid: false, value: 'S1' });
});

test('reference lookup restores named fields despite popup controls changing form-element order', async () => {
  const actionSource = await Bun.file(new URL('./actions/seamless-filter.ts', import.meta.url)).text();
  const body = actionSource.slice(actionSource.indexOf('function preserveDialogForm'), actionSource.indexOf('/** Keeps GET forms'));
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(body);
  class Input {
    checked = false; type = 'text'; events: string[] = [];
    constructor(public name: string, public value: string) {}
    dispatchEvent(event: Event) { this.events.push(event.type); }
  }
  class Option {
    constructor(public textContent: string, public value: string) {}
  }
  class Select {
    events: string[] = [];
    constructor(public name: string, public value: string, public options: Option[]) {}
    get selectedOptions() { return this.options.filter(option => option.value === this.value); }
    add(option: Option) { this.options.push(option); }
    dispatchEvent(event: Event) { this.events.push(event.type); }
  }
  class Textarea extends Input {}
  const factory = new Function('HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Option', `${js}; return preserveDialogForm;`);
  const preserve = factory(Input, Select, Textarea, Option) as (form: { closest: () => { querySelectorAll: () => unknown[] } }) => () => void;
  const originalCheckbox = new Input('confirm', 'yes'); originalCheckbox.type = 'checkbox'; originalCheckbox.checked = true;
  const form = { elements: [new Input('nama', 'Draft remains'), new Select('jenjang', 'S2', [new Option('Magister', 'S2')]), originalCheckbox] as unknown[] };
  const restore = preserve({ closest: () => ({ querySelectorAll: () => [form] }) });
  const name = new Input('nama', ''), jenjang = new Select('jenjang', 'S1', [new Option('Sarjana', 'S1')]);
  const checkbox = new Input('confirm', 'yes'); checkbox.type = 'checkbox';
  form.elements = [{ name: '', type: 'button' }, jenjang, new Input('', 'lookup text'), name, checkbox];
  restore();
  expect(name.value).toBe('Draft remains');
  expect(jenjang.value).toBe('S2');
  expect(jenjang.selectedOptions[0]?.textContent).toBe('Magister');
  expect(jenjang.events).toEqual(['kampusia:restore']);
  expect(checkbox.checked).toBe(true);
});
