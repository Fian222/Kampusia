import { expect, test } from 'bun:test';
import ts from 'typescript';

const sourceRoot = `${import.meta.dir}/..`;

async function read(relativePath: string) {
  return Bun.file(`${sourceRoot}/${relativePath}`).text();
}

function actionNames(source: string, fileName: string) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'actions' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      names = node.initializer.properties.flatMap(property => {
        if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property) && !ts.isShorthandPropertyAssignment(property)) return [];
        return [property.name.getText(file).replace(/^['"]|['"]$/g, '')];
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

function postForms(source: string) {
  return source.match(/<form\b[^>]*\bmethod="POST"[^>]*>/g) ?? [];
}

test('SvelteKit action maps never mix a default action with named actions', async () => {
  const glob = new Bun.Glob('routes/**/+page.server.ts');
  for await (const path of glob.scan({ cwd: sourceRoot, onlyFiles: true })) {
    const names = actionNames(await read(path), path);
    if (names.includes('default')) expect(names, path).toEqual(['default']);
  }
});

test('class detail forms submit to their explicit named actions', async () => {
  const dosenServer = await read('routes/(app)/dosen/kelas-kuliah/[id]/+page.server.ts');
  expect(actionNames(dosenServer, 'dosen/+page.server.ts')).toEqual(['meeting', 'grading']);

  const akademikServer = await read('routes/(app)/akademik/kelas-kuliah/[id]/+page.server.ts');
  expect(actionNames(akademikServer, 'akademik/+page.server.ts')).toEqual(['detail', 'meeting', 'grading']);

  const meetings = await read('lib/components/MeetingManager.svelte');
  expect(meetings).toContain("const action = '?/meeting';");
  expect(postForms(meetings)).toHaveLength(3);
  for (const form of postForms(meetings)) expect(form).toContain('{action}');

  const grading = await read('lib/components/GradingManager.svelte');
  expect(postForms(grading).length).toBeGreaterThan(0);
  for (const form of postForms(grading)) expect(form).toContain('action="?/grading"');

  const detail = await read('routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte');
  expect(postForms(detail).length).toBeGreaterThan(0);
  for (const form of postForms(detail)) expect(form).toContain('action="?/detail"');
  expect(detail.match(/<ScheduleForm action="\?\/detail"/g)).toHaveLength(2);

  const schedule = await read('lib/components/ScheduleForm.svelte');
  expect(postForms(schedule)).toEqual([expect.stringContaining('{action}')]);
});
