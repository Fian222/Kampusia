import { t } from 'elysia';

const uuid = t.String({ format: 'uuid' });

export const studentResultParams = t.Object({ id: uuid });
export const studentSemesterResultParams = t.Object({ id: uuid, semesterId: uuid });
export const ownSemesterResultParams = t.Object({ semesterId: uuid });
