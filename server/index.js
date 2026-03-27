import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { checkDbHealth, getDbPool } from './db.js';
import { createPasswordPayload, createSessionToken, normalizeEmail, readBearerToken, verifyPassword, verifySessionToken } from './auth.js';

const app = express();
const port = Number(process.env.API_PORT || 4000);
const corsOrigin = process.env.API_CORS_ORIGIN || 'http://localhost:5173';
const apiAccessKey = (process.env.API_ACCESS_KEY || '').trim();
const sessionAuthEnabled = Boolean((process.env.API_SESSION_SECRET || '').trim());

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '2mb' }));

app.use('/api', (request, response, next) => {
  if (!apiAccessKey) {
    next();
    return;
  }

  const requestKey = String(request.header('x-ifz14-api-key') || '').trim();
  if (requestKey !== apiAccessKey) {
    response.status(401).json({ ok: false, message: 'Unauthorized API request' });
    return;
  }

  next();
});

app.get('/api/auth/config', (_request, response) => {
  response.json({
    ok: true,
    sessionAuthEnabled,
  });
});

function resolveAuthorizedUserId(request) {
  if (sessionAuthEnabled) {
    const token = readBearerToken(request);
    const session = verifySessionToken(token);
    if (!session?.userId) {
      return { ok: false, status: 401, message: 'Invalid session' };
    }
    return { ok: true, userId: session.userId };
  }

  const userId = String(request.body?.userId || request.query.userId || '').trim();
  if (!userId) {
    return { ok: false, status: 400, message: 'userId is required' };
  }

  return { ok: true, userId };
}

app.post('/api/auth/signup', async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password || '').trim();
  const name = String(request.body?.name || '').trim() || 'Operator';

  if (!email) {
    response.status(400).json({ ok: false, message: 'Email required' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ ok: false, message: 'Enter a valid email address' });
    return;
  }

  if (password.length < 8) {
    response.status(400).json({ ok: false, message: 'Use at least 8 characters' });
    return;
  }

  try {
    const [existingRows] = await getDbPool().execute(
      `SELECT user_id AS userId FROM auth_users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      response.status(409).json({ ok: false, message: 'Account already exists' });
      return;
    }

    const { salt, passwordHash } = createPasswordPayload(password);
    const userId = crypto.randomUUID();

    await getDbPool().execute(
      `INSERT INTO auth_users (user_id, email, name, password_hash, salt, last_login_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, email, name, passwordHash, salt]
    );

    const sessionToken = createSessionToken({ userId, email, name });

    response.status(201).json({
      ok: true,
      user: {
        id: userId,
        email,
        name,
      },
      sessionToken,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to create account',
    });
  }
});

app.post('/api/auth/signin', async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password || '').trim();

  if (!email) {
    response.status(400).json({ ok: false, message: 'Email required' });
    return;
  }

  if (!password) {
    response.status(400).json({ ok: false, message: 'Password required' });
    return;
  }

  try {
    const [rows] = await getDbPool().execute(
      `SELECT user_id AS userId, email, name, password_hash AS passwordHash, salt
       FROM auth_users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = Array.isArray(rows) ? rows[0] : null;
    if (!user || !verifyPassword(password, user)) {
      response.status(401).json({ ok: false, message: 'Invalid credentials' });
      return;
    }

    await getDbPool().execute(
      `UPDATE auth_users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [user.userId]
    );

    const sessionToken = createSessionToken(user);

    response.json({
      ok: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
      },
      sessionToken,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to sign in',
    });
  }
});

app.get('/api/auth/me', async (request, response) => {
  const token = readBearerToken(request);
  const session = verifySessionToken(token);
  if (!session) {
    response.status(401).json({ ok: false, message: 'Invalid session' });
    return;
  }

  response.json({
    ok: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
    },
  });
});

app.get('/api/health', async (_request, response) => {
  try {
    await checkDbHealth();
    response.json({
      ok: true,
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      database: 'disconnected',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});

app.get('/api/daily-entries', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  try {
    const [rows] = await getDbPool().execute(
      `SELECT entry_date AS date, payload, updated_at AS updatedAt
       FROM daily_entries
       WHERE user_id = ?
       ORDER BY entry_date DESC`,
      [auth.userId]
    );

    response.json({
      ok: true,
      entries: rows,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load daily entries',
    });
  }
});

app.put('/api/daily-entries/:date', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  const date = String(request.params.date || '').trim();
  const payload = request.body?.payload;

  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    response.status(400).json({ ok: false, message: 'date must be YYYY-MM-DD' });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ ok: false, message: 'payload must be an object' });
    return;
  }

  try {
    await getDbPool().execute(
      `INSERT INTO daily_entries (user_id, entry_date, payload)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         updated_at = CURRENT_TIMESTAMP`,
      [auth.userId, date, JSON.stringify(payload)]
    );

    response.json({
      ok: true,
      saved: { userId: auth.userId, date },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save daily entry',
    });
  }
});

app.get('/api/tasks', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  try {
    const [rows] = await getDbPool().execute(
      `SELECT task_id AS id, payload, updated_at AS updatedAt
       FROM tasks
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [auth.userId]
    );

    response.json({
      ok: true,
      tasks: rows,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load tasks',
    });
  }
});

app.put('/api/tasks/:id', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  const taskId = String(request.params.id || '').trim();
  const payload = request.body?.payload;

  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  if (!taskId) {
    response.status(400).json({ ok: false, message: 'task id is required' });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ ok: false, message: 'payload must be an object' });
    return;
  }

  try {
    await getDbPool().execute(
      `INSERT INTO tasks (user_id, task_id, payload)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         updated_at = CURRENT_TIMESTAMP`,
      [auth.userId, taskId, JSON.stringify(payload)]
    );

    response.json({
      ok: true,
      saved: { userId: auth.userId, taskId },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save task',
    });
  }
});

app.delete('/api/tasks/:id', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  const taskId = String(request.params.id || '').trim();

  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  if (!taskId) {
    response.status(400).json({ ok: false, message: 'task id is required' });
    return;
  }

  try {
    await getDbPool().execute(
      `DELETE FROM tasks
       WHERE user_id = ? AND task_id = ?`,
      [auth.userId, taskId]
    );

    response.json({
      ok: true,
      removed: { userId: auth.userId, taskId },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to delete task',
    });
  }
});

app.get('/api/goals', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  try {
    const [rows] = await getDbPool().execute(
      `SELECT goal_id AS id, payload, updated_at AS updatedAt
       FROM goals
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [auth.userId]
    );

    response.json({
      ok: true,
      goals: rows,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load goals',
    });
  }
});

app.put('/api/goals/:id', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  const goalId = String(request.params.id || '').trim();
  const payload = request.body?.payload;

  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  if (!goalId) {
    response.status(400).json({ ok: false, message: 'goal id is required' });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ ok: false, message: 'payload must be an object' });
    return;
  }

  try {
    await getDbPool().execute(
      `INSERT INTO goals (user_id, goal_id, payload)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         updated_at = CURRENT_TIMESTAMP`,
      [auth.userId, goalId, JSON.stringify(payload)]
    );

    response.json({
      ok: true,
      saved: { userId: auth.userId, goalId },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save goal',
    });
  }
});

app.delete('/api/goals/:id', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  const goalId = String(request.params.id || '').trim();

  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  if (!goalId) {
    response.status(400).json({ ok: false, message: 'goal id is required' });
    return;
  }

  try {
    await getDbPool().execute(
      `DELETE FROM goals
       WHERE user_id = ? AND goal_id = ?`,
      [auth.userId, goalId]
    );

    response.json({
      ok: true,
      removed: { userId: auth.userId, goalId },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to delete goal',
    });
  }
});

app.get('/api/analytics-history', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  try {
    const [rows] = await getDbPool().execute(
      `SELECT history_id AS id, payload, updated_at AS updatedAt
       FROM analytics_history
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [auth.userId]
    );

    response.json({
      ok: true,
      history: rows,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load analytics history',
    });
  }
});

app.put('/api/analytics-history/:id', async (request, response) => {
  const auth = resolveAuthorizedUserId(request);
  const historyId = String(request.params.id || '').trim();
  const payload = request.body?.payload;

  if (!auth.ok) {
    response.status(auth.status).json({ ok: false, message: auth.message });
    return;
  }

  if (!historyId) {
    response.status(400).json({ ok: false, message: 'history id is required' });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ ok: false, message: 'payload must be an object' });
    return;
  }

  try {
    await getDbPool().execute(
      `INSERT INTO analytics_history (user_id, history_id, payload)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         updated_at = CURRENT_TIMESTAMP`,
      [auth.userId, historyId, JSON.stringify(payload)]
    );

    response.json({
      ok: true,
      saved: { userId: auth.userId, historyId },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save analytics history',
    });
  }
});

app.listen(port, () => {
  console.log(`IFZ14 API listening on http://localhost:${port}`);
});
