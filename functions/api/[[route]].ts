import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { handle } from 'hono/cloudflare-pages';
import type { Context } from 'hono';

type Role = 'user' | 'admin';
type MemorialStatus = 'pending_payment' | 'pending_order' | 'accepted' | 'in_progress' | 'pending_acceptance' | 'completed';

interface AppEnv extends Env {
  AUTH_SECRET?: string;
  ADMIN_USERNAMES?: string;
  SILICONFLOW_API_KEY?: string;
}

interface UserRow {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string | null;
  created_at?: string;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
}

interface MemorialRow {
  id: string;
  author_id: string;
  author_name?: string | null;
  status: MemorialStatus;
}

type AppContext = Context<{ Bindings: AppEnv }>;

const app = new Hono<{ Bindings: AppEnv }>().basePath('/api');
const SESSION_COOKIE = 'anyi_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

const allowedStatuses = new Set<MemorialStatus>([
  'pending_payment',
  'pending_order',
  'accepted',
  'in_progress',
  'pending_acceptance',
  'completed'
]);

const jsonArray = (value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const publicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatar: row.avatar || '',
  role: row.role === 'admin' ? 'admin' : 'user'
});

const requiredString = (value: unknown, maxLength = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const optionalString = (value: unknown, maxLength = 500) => {
  const text = requiredString(value, maxLength);
  return text.length > 0 ? text : null;
};

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
};

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
};

const authSecret = (c: AppContext) => {
  if (c.env.AUTH_SECRET && c.env.AUTH_SECRET.length >= 32) return c.env.AUTH_SECRET;
  const host = new URL(c.req.url).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'dev-only-auth-secret-change-before-production';
  throw new Error('AUTH_SECRET must be configured and at least 32 characters long.');
};

const hmac = async (secret: string, data: string) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
};

const createSessionToken = async (c: AppContext, userId: string) => {
  const payload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await hmac(authSecret(c), encodedPayload));
  return `${encodedPayload}.${signature}`;
};

const verifySessionToken = async (c: AppContext, token?: string) => {
  if (!token) return null;
  try {
    const [encodedPayload, encodedSignature] = token.split('.');
    if (!encodedPayload || !encodedSignature) return null;

    const expected = await hmac(authSecret(c), encodedPayload);
    const actual = base64UrlDecode(encodedSignature);
    if (!constantTimeEqual(expected, actual)) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as { userId?: string; exp?: number };
    if (!payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.userId;
  } catch {
    return null;
  }
};

const setSessionCookie = async (c: AppContext, userId: string) => {
  const token = await createSessionToken(c, userId);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:'
  });
};

const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${base64UrlEncode(salt)}.${password}`));
  return `sha256$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(digest))}`;
};

const verifyPassword = async (password: string, stored: string) => {
  if (stored.startsWith('sha256$')) {
    const [, saltText, hashText] = stored.split('$');
    if (!saltText || !hashText) return false;
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${saltText}.${password}`));
    return constantTimeEqual(new Uint8Array(digest), base64UrlDecode(hashText));
  }

  if (!stored.startsWith('pbkdf2$')) {
    return constantTimeEqual(encoder.encode(password), encoder.encode(stored));
  }

  const [, iterationsText, saltText, hashText] = stored.split('$');
  const iterations = Number(iterationsText);
  if (!iterations || !saltText || !hashText) return false;

  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64UrlDecode(saltText), iterations, hash: 'SHA-256' },
    material,
    256
  );
  return constantTimeEqual(new Uint8Array(bits), base64UrlDecode(hashText));
};

const getUserById = (c: AppContext, id: string) => {
  return c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
};

const getCurrentUser = async (c: AppContext) => {
  const userId = await verifySessionToken(c, getCookie(c, SESSION_COOKIE));
  return userId ? getUserById(c, userId) : null;
};

const requireUser = async (c: AppContext) => {
  const user = await getCurrentUser(c);
  if (!user) return { response: c.json({ error: 'Unauthorized' }, 401) };
  return { user };
};

const requireAdmin = async (c: AppContext) => {
  const result = await requireUser(c);
  if ('response' in result) return result;
  if (result.user.role !== 'admin') return { response: c.json({ error: 'Forbidden' }, 403) };
  return result;
};

const getMemorial = (c: AppContext, id: string) => {
  return c.env.DB.prepare('SELECT id, author_id, author_name, status FROM memorials WHERE id = ?').bind(id).first<MemorialRow>();
};

const ownsMemorial = (user: UserRow, memorial: MemorialRow | null) => {
  return Boolean(memorial && (user.role === 'admin' || memorial.author_id === user.id));
};

const isAdminUsername = (env: AppEnv, username: string) => {
  const configured = (env.ADMIN_USERNAMES || '').split(',').map(name => name.trim()).filter(Boolean);
  return configured.includes(username);
};

app.onError((error, c) => {
  console.error(JSON.stringify({ message: error.message, stack: error.stack }));
  if (error.message.includes('AUTH_SECRET')) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ error: 'Internal server error' }, 500);
});

app.get('/health', (c) => {
  return c.json({
    ok: true,
    bindings: {
      DB: Boolean(c.env.DB),
      BUCKET: Boolean(c.env.BUCKET),
      AUTH_SECRET: Boolean(c.env.AUTH_SECRET && c.env.AUTH_SECRET.length >= 32),
      ADMIN_USERNAMES: Boolean(c.env.ADMIN_USERNAMES),
      SILICONFLOW_API_KEY: Boolean(c.env.SILICONFLOW_API_KEY)
    }
  });
});

app.get('/auth/me', async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user: publicUser(user) });
});

app.post('/auth/register', async (c) => {
  const body = await c.req.json();
  const username = requiredString(body.username, 80);
  const password = requiredString(body.password, 256);
  const displayName = optionalString(body.name, 80) || username;

  if (username.length < 2 || password.length < 6) {
    return c.json({ error: '账号至少 2 位，密码至少 6 位。' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return c.json({ error: '该账号已被注册。' }, 409);

  const id = crypto.randomUUID();
  const role: Role = isAdminUsername(c.env, username) ? 'admin' : 'user';
  const email = optionalString(body.email, 120) || `${username}@system.local`;
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare('INSERT INTO users (id, username, password, name, email, role) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, username, passwordHash, displayName, email, role)
    .run();

  const user = await getUserById(c, id);
  if (!user) return c.json({ error: '注册失败，请重试。' }, 500);
  await setSessionCookie(c, user.id);
  return c.json({ user: publicUser(user) }, 201);
});

app.post('/auth/login', async (c) => {
  const body = await c.req.json();
  const username = requiredString(body.username, 80);
  const password = requiredString(body.password, 256);
  const requestedRole = body.role === 'admin' ? 'admin' : 'user';

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>();
  if (!user || !(await verifyPassword(password, user.password))) {
    return c.json({ error: '账号或密码错误。' }, 401);
  }
  if (requestedRole === 'admin' && user.role !== 'admin') {
    return c.json({ error: '该账号无管理员权限。' }, 403);
  }

  if (!user.password.startsWith('pbkdf2$')) {
    await c.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(await hashPassword(password), user.id).run();
  }

  await setSessionCookie(c, user.id);
  return c.json({ user: publicUser(user) });
});

app.post('/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ success: true });
});

app.post('/upload', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'No file uploaded' }, 400);
  if (!file.type.startsWith('image/')) return c.json({ error: 'Only image uploads are allowed.' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Image must be 5 MB or smaller.' }, 400);

  const extension = file.type.split('/')[1]?.replace(/[^a-z0-9]/giu, '') || 'bin';
  const filename = `${crypto.randomUUID()}.${extension}`;

  await c.env.BUCKET.put(filename, file.stream(), {
    httpMetadata: {
      contentType: file.type
    }
  });

  return c.json({ url: `/api/assets/${filename}` });
});

app.get('/assets/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

app.delete('/assets/:key', async (c) => {
  const auth = await requireAdmin(c);
  if ('response' in auth) return auth.response;

  const key = c.req.param('key');
  if (!/^[a-z0-9-]+\.[a-z0-9]+$/iu.test(key)) return c.json({ error: 'Invalid asset key.' }, 400);

  await c.env.BUCKET.delete(key);
  return c.json({ success: true });
});

app.get('/users', async (c) => {
  const auth = await requireAdmin(c);
  if ('response' in auth) return auth.response;

  const username = optionalString(c.req.query('username'), 80);
  const statement = username
    ? c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username)
    : c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100');
  const { results } = await statement.all<UserRow>();
  return c.json(results.map(publicUser));
});

app.get('/users/:id', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const id = c.req.param('id');
  if (auth.user.role !== 'admin' && auth.user.id !== id) return c.json({ error: 'Forbidden' }, 403);

  const user = await getUserById(c, id);
  if (!user) return c.notFound();
  return c.json(publicUser(user));
});

app.put('/users/:id', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const id = c.req.param('id');
  if (auth.user.role !== 'admin' && auth.user.id !== id) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  const name = requiredString(body.name, 80);
  const avatar = optionalString(body.avatar, 1000);
  if (!name) return c.json({ error: 'Name is required.' }, 400);

  await c.env.DB.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').bind(name, avatar, id).run();
  return c.json({ success: true });
});

app.get('/forum_posts', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM forum_posts ORDER BY created_at DESC LIMIT 100').all<Record<string, unknown>>();
  const parsed = results.map(row => ({
    ...row,
    flowers: jsonArray(row.flowers),
    forum_comments: jsonArray(row.forum_comments),
    _deleted: row.deleted === 1
  }));

  return c.json(parsed);
});

app.post('/forum_posts', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const body = await c.req.json();
  const content = requiredString(body.content, 3000);
  if (!content) return c.json({ error: 'Content is required.' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO forum_posts (id, user_id, content, user_name, user_role, user_avatar, image_url, flowers, forum_comments, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(
      id,
      auth.user.id,
      content,
      auth.user.name,
      auth.user.role,
      auth.user.avatar || null,
      optionalString(body.image_url, 1000),
      '[]',
      '[]',
      0
    )
    .run();
  return c.json({ id }, 201);
});

app.put('/forum_posts/:id', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT user_id, flowers, forum_comments FROM forum_posts WHERE id = ?').bind(id).first<{ user_id: string; flowers?: string | null; forum_comments?: string | null }>();
  if (!existing) return c.notFound();

  const body = await c.req.json();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.content !== undefined || body._deleted !== undefined) {
    if (auth.user.role !== 'admin' && existing.user_id !== auth.user.id) return c.json({ error: 'Forbidden' }, 403);
  }

  if (body.content !== undefined) { updates.push('content = ?'); values.push(requiredString(body.content, 3000)); }
  if (body.flowers !== undefined) {
    const flowerUsers = jsonArray(existing.flowers).filter((value): value is string => typeof value === 'string');
    const nextFlowers = flowerUsers.includes(auth.user.id)
      ? flowerUsers.filter(userId => userId !== auth.user.id)
      : [...flowerUsers, auth.user.id];
    updates.push('flowers = ?');
    values.push(JSON.stringify(nextFlowers));
  }
  if (body.forum_comments !== undefined) {
    if (body._deleted) {
      updates.push('forum_comments = ?');
      values.push('[]');
    } else {
      const submitted = Array.isArray(body.forum_comments) ? body.forum_comments : [];
      const latest = submitted.at(-1);
      const content = requiredString(latest?.content, 1000);
      if (content) {
        const comments = jsonArray(existing.forum_comments);
        updates.push('forum_comments = ?');
        values.push(JSON.stringify([...comments, {
          user_id: auth.user.id,
          user_name: auth.user.name,
          content,
          created_at: new Date().toISOString()
        }]));
      }
    }
  }
  if (body._deleted !== undefined) { updates.push('deleted = ?'); values.push(body._deleted ? 1 : 0); }

  if (updates.length > 0) {
    values.push(id);
    await c.env.DB.prepare(`UPDATE forum_posts SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  }
  return c.json({ success: true });
});

app.delete('/forum_posts/:id', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT user_id FROM forum_posts WHERE id = ?').bind(id).first<{ user_id: string }>();
  if (!existing) return c.notFound();
  if (auth.user.role !== 'admin' && existing.user_id !== auth.user.id) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.prepare('DELETE FROM forum_posts WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.get('/memorials', async (c) => {
  const authorId = optionalString(c.req.query('author_id'), 80);
  const status = c.req.query('status');

  if (authorId) {
    const auth = await requireUser(c);
    if ('response' in auth) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.id !== authorId) return c.json({ error: 'Forbidden' }, 403);

    const { results } = await c.env.DB.prepare('SELECT * FROM memorials WHERE author_id = ? ORDER BY created_at DESC').bind(authorId).all<Record<string, unknown>>();
    return c.json(results.map(row => ({ ...row, progress_images: jsonArray(row.progress_images), completion_images: jsonArray(row.completion_images) })));
  }

  if (status === 'accepted,completed') {
    const { results } = await c.env.DB.prepare('SELECT * FROM memorials WHERE status IN ("accepted", "completed") ORDER BY created_at DESC LIMIT 50').all<Record<string, unknown>>();
    return c.json(results.map(row => ({ ...row, progress_images: jsonArray(row.progress_images), completion_images: jsonArray(row.completion_images) })));
  }

  const auth = await requireAdmin(c);
  if ('response' in auth) return auth.response;

  const { results } = await c.env.DB.prepare('SELECT * FROM memorials ORDER BY created_at DESC').all<Record<string, unknown>>();
  return c.json(results.map(row => ({ ...row, progress_images: jsonArray(row.progress_images), completion_images: jsonArray(row.completion_images) })));
});

app.post('/memorials', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const body = await c.req.json();
  const type = body.type === 'festival' ? 'festival' : 'person';
  const requestedStatus = allowedStatuses.has(body.status) ? body.status as MemorialStatus : 'pending_payment';
  const status: MemorialStatus = type === 'festival' ? 'pending_payment' : requestedStatus;
  const id = crypto.randomUUID();

  await c.env.DB.prepare('INSERT INTO memorials (id, name, relation, birth_date, death_date, message, image_url, author_name, author_id, type, status, event_date, plan, remarks, progress_images, completion_images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(
      id,
      optionalString(body.name, 120),
      optionalString(body.relation, 80),
      optionalString(body.birth_date, 40),
      optionalString(body.death_date, 40),
      requiredString(body.message, 5000),
      optionalString(body.image_url, 1000),
      auth.user.name,
      auth.user.id,
      type,
      status,
      optionalString(body.event_date, 40),
      typeof body.plan === 'number' ? body.plan : null,
      optionalString(body.remarks, 2000),
      '[]',
      '[]'
    )
    .run();
  return c.json({ id }, 201);
});

app.put('/memorials/:id', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const id = c.req.param('id');
  const memorial = await getMemorial(c, id);
  if (!memorial) return c.notFound();

  const body = await c.req.json();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  let userCanAcceptCompleted = false;

  if (body.status !== undefined) {
    const nextStatus = allowedStatuses.has(body.status) ? body.status as MemorialStatus : null;
    if (!nextStatus) return c.json({ error: 'Invalid status.' }, 400);

    const userCanPayOwnOrder = auth.user.id === memorial.author_id && memorial.status === 'pending_payment' && nextStatus === 'pending_order';
    userCanAcceptCompleted = auth.user.id === memorial.author_id && memorial.status === 'pending_acceptance' && nextStatus === 'completed';
    if (auth.user.role !== 'admin' && !userCanPayOwnOrder && !userCanAcceptCompleted) return c.json({ error: 'Forbidden' }, 403);

    updates.push('status = ?');
    values.push(nextStatus);
    if (userCanAcceptCompleted) {
      updates.push('completed_at = ?');
      values.push(new Date().toISOString());
    }
  }

  const adminOnlyFields = ['completion_time', 'completion_location', 'completion_images', 'completion_remarks', 'progress_images', 'completed_at'] as const;
  if (adminOnlyFields.some(field => body[field] !== undefined && !(field === 'completed_at' && userCanAcceptCompleted)) && auth.user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (body.completion_time !== undefined) { updates.push('completion_time = ?'); values.push(optionalString(body.completion_time, 120)); }
  if (body.completion_location !== undefined) { updates.push('completion_location = ?'); values.push(optionalString(body.completion_location, 300)); }
  if (body.completion_images !== undefined) { updates.push('completion_images = ?'); values.push(JSON.stringify(Array.isArray(body.completion_images) ? body.completion_images : [body.completion_images].filter(Boolean))); }
  if (body.completion_remarks !== undefined) { updates.push('completion_remarks = ?'); values.push(optionalString(body.completion_remarks, 2000)); }
  if (body.progress_images !== undefined) { updates.push('progress_images = ?'); values.push(JSON.stringify(Array.isArray(body.progress_images) ? body.progress_images : [body.progress_images].filter(Boolean))); }
  if (body.completed_at !== undefined && auth.user.role === 'admin') { updates.push('completed_at = ?'); values.push(optionalString(body.completed_at, 80)); }

  if (updates.length > 0) {
    values.push(id);
    await c.env.DB.prepare(`UPDATE memorials SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  return c.json({ success: true });
});

app.delete('/memorials/:id', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const id = c.req.param('id');
  const memorial = await getMemorial(c, id);
  if (!ownsMemorial(auth.user, memorial)) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.prepare('DELETE FROM memorials WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.get('/comments', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const statement = auth.user.role === 'admin'
    ? c.env.DB.prepare('SELECT * FROM comments ORDER BY created_at ASC')
    : c.env.DB.prepare(`
        SELECT comments.*
        FROM comments
        INNER JOIN memorials ON memorials.id = comments.memorial_id
        WHERE memorials.author_id = ? OR memorials.status IN ("accepted", "completed")
        ORDER BY comments.created_at ASC
      `).bind(auth.user.id);
  const { results } = await statement.all();
  return c.json(results);
});

app.post('/comments', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const body = await c.req.json();
  const memorialId = requiredString(body.memorial_id, 80);
  const content = requiredString(body.content, 2000);
  if (!memorialId || !content) return c.json({ error: 'Missing memorial or content.' }, 400);

  const memorial = await getMemorial(c, memorialId);
  if (!memorial) return c.notFound();
  if (memorial.status !== 'accepted' && memorial.status !== 'completed' && !ownsMemorial(auth.user, memorial)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await c.env.DB.prepare('INSERT INTO comments (id, memorial_id, user_id, content, user_name) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), memorialId, auth.user.id, content, auth.user.name)
    .run();
  return c.json({ success: true }, 201);
});

app.get('/messages', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const memorialId = optionalString(c.req.query('memorial_id'), 80);
  if (!memorialId) return c.json([]);

  const memorial = await getMemorial(c, memorialId);
  if (!ownsMemorial(auth.user, memorial)) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(`
    SELECT messages.*, COALESCE(users.name, messages.sender_id) AS sender_name
    FROM messages
    LEFT JOIN users ON users.id = messages.sender_id
    WHERE messages.memorial_id = ?
    ORDER BY messages.created_at ASC
  `).bind(memorialId).all();
  return c.json(results);
});

app.post('/messages', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const body = await c.req.json();
  const memorialId = requiredString(body.memorial_id, 80);
  const content = requiredString(body.content, 2000);
  if (!memorialId || !content) return c.json({ error: 'Missing memorial or content.' }, 400);

  const memorial = await getMemorial(c, memorialId);
  if (!ownsMemorial(auth.user, memorial)) return c.json({ error: 'Forbidden' }, 403);

  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO messages (id, memorial_id, sender_id, content) VALUES (?, ?, ?, ?)')
    .bind(id, memorialId, auth.user.id, content)
    .run();
  return c.json({ id }, 201);
});

app.post('/ai/chat', async (c) => {
  const auth = await requireUser(c);
  if ('response' in auth) return auth.response;

  const apiKey = c.env.SILICONFLOW_API_KEY;
  if (!apiKey) return c.json({ error: 'AI service not configured' }, 500);

  const body = await c.req.json();
  const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: requiredString(body.model, 120) || 'Qwen/Qwen2.5-7B-Instruct',
      messages: Array.isArray(body.messages) ? body.messages : [],
      max_tokens: typeof body.max_tokens === 'number' ? Math.min(body.max_tokens, 1024) : 512,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.7
    })
  });

  if (!response.ok) {
    return c.json({ error: 'AI service request failed' }, 502);
  }

  return c.json(await response.json());
});

export const onRequest = handle(app);
