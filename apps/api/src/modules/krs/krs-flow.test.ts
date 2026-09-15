import { expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { users } from '@kampusia/db/schema';
import { connect, fixture, cleanup } from './krs.fixtures';
import { createKrsRepository } from './krs.repository';
import { createKrsService } from './krs.service';

test.skipIf(Bun.env.RUN_KRS_E2E !== '1')('SvelteKit student/admin KRS forms complete lifecycle through Eden with role and confirmation checks', async () => {
  const origin = Bun.env.KRS_WEB_ORIGIN ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('KRS flow requires a local web server.');
  const { db, client } = connect(); let f: Awaited<ReturnType<typeof fixture>> | undefined; const cookies: string[] = [];
  const request = (path: string, cookie = '', body?: Record<string, string>) => fetch(origin + path, { redirect: 'manual', method: body ? 'POST' : 'GET', headers: { origin, cookie, accept: 'text/html' }, ...(body ? { body: new URLSearchParams(body) } : {}) });
  try {
    f = await db.transaction(fixture);
    const password = crypto.randomUUID() + '!'; await db.update(users).set({ passwordHash: await Bun.password.hash(password, { algorithm: 'argon2id' }) }).where(inArray(users.id, f.accounts.map(row => row.id)));
    for (const account of [f.user, f.admin]) {
      const result = await request('/login', '', { email: account.email, password }); expect(result.status).toBe(303);
      const cookie = result.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))?.split(';')[0]; expect(cookie).toBeDefined(); cookies.push(cookie!);
    }
    const student = cookies[0]!, admin = cookies[1]!; const path = '/mahasiswa/krs';
    expect((await request(path)).status).toBe(303); expect((await request('/akademik/krs', student)).status).toBe(403);
    expect(await (await request(path, student)).text()).toContain('Buat DRAFT KRS');
    const created = await request(path, student, { mode: 'create', id: f.term.id }); expect(created.status).toBe(200); expect(await created.text()).toContain('belum tersedia IPS semester sebelumnya yang lengkap');
    const service = createKrsService(createKrsRepository(db), 6); const plan = (await service.bySemester(f.user, f.term.id)).krs!; expect(plan).toBeDefined();
    const add = await request(path, student, { mode: 'add', id: plan.id, kelas_id: f.classes[0]!.id }); expect(add.status).toBe(200);
    const html = await add.text(); for (const label of [f.courses[0]!.kode, f.lecturer.nama, f.room.kode, 'Ajukan KRS', 'Hapus', 'Batas SKS maksimum', 'SKS dipilih', 'Sisa SKS']) expect(html).toContain(label);
    const detail = (await service.bySemester(f.user, f.term.id)).krs!.details[0]!;
    expect((await request(path, student, { mode: 'remove', id: plan.id, detail_id: detail.id })).status).toBe(200);
    await request(path, student, { mode: 'add', id: plan.id, kelas_id: f.classes[0]!.id });
    const unconfirmed = await request(path, student, { mode: 'submit', id: plan.id }); expect(unconfirmed.status).toBe(400); expect(await unconfirmed.text()).toContain('Konfirmasikan');
    const submitted = await request(path, student, { mode: 'submit', id: plan.id, confirmed: 'yes' }); expect(submitted.status).toBe(200); expect(await submitted.text()).toContain('menunggu peninjauan');
    const list = await request('/akademik/krs?search=' + f.students[0]!.nim, admin); expect(list.status).toBe(200); expect(await list.text()).toContain(f.students[0]!.nim);
    const review = '/akademik/krs/' + plan.id;
    expect(await (await request(review, admin)).text()).toContain('Setujui');
    expect((await request(review, admin, { mode: 'reject', confirmed: 'yes' })).status).toBe(200);
    expect(await (await request(path, student)).text()).toContain('Perbaiki KRS');
    await request(path, student, { mode: 'reopen', id: plan.id, confirmed: 'yes' }); await request(path, student, { mode: 'submit', id: plan.id, confirmed: 'yes' });
    expect((await request(review, admin, { mode: 'approve', confirmed: 'yes' })).status).toBe(200);
    expect(await (await request(path, student)).text()).toContain('KRS telah disetujui');
    expect((await request(path, student, { mode: 'remove', id: plan.id, detail_id: detail.id })).status).toBe(409);
    await request(review, admin, { mode: 'reopen', confirmed: 'yes' });
    expect((await service.get(f.admin, plan.id)).status).toBe('DRAFT');
    // ADMIN uses the same academic page as AKADEMIK, with live role resolution.
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, f.admin.id));
    expect((await request('/akademik/krs', admin)).status).toBe(200); expect((await request(review, admin)).status).toBe(200);
    await request(review, admin, { mode: 'cancel', confirmed: 'yes' });
    expect((await service.bySemester(f.user, f.term.id)).krs!.status).toBe('DIBATALKAN');
  } finally {
    try { for (const cookie of cookies) await request('/logout', cookie, {}); }
    finally { try { if (f) await cleanup(db, f); } finally { await client.end(); } }
  }
}, 60000);
