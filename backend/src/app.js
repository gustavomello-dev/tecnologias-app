import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createApp({ databasePath = './data/database.sqlite', secret } = {}) {
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET precisa de pelo menos 32 caracteres.');
  if (databasePath !== ':memory:') mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS technologies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
      base TEXT NOT NULL CHECK(base IN ('PHP','C#','JavaScript','TypeScript','Java','Python','Outra')),
      learning_hours INTEGER NOT NULL CHECK(learning_hours BETWEEN 1 AND 100000),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    );`);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Muitas tentativas. Aguarde 15 minutos.' } });
  const issue = user => jwt.sign({ name: user.name }, secret, {
    subject: String(user.id), expiresIn: '1h', algorithm: 'HS256', issuer: 'tecnologias-api', audience: 'tecnologias-web'
  });
  const publicUser = user => ({ id: user.id, name: user.name, email: user.email });
  const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  function authenticate(req, res, next) {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ message: 'Token ausente.' });
    try {
      const payload = jwt.verify(match[1], secret, { algorithms: ['HS256'], issuer: 'tecnologias-api', audience: 'tecnologias-web' });
      const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.sub);
      if (!user) return res.status(401).json({ message: 'Usuário não encontrado.' });
      req.user = user;
      next();
    } catch { return res.status(401).json({ message: 'Token inválido ou expirado.' }); }
  }
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const { name, password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || !validEmail(email) ||
        typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
      return res.status(400).json({ message: 'Informe nome (2–100 caracteres), e-mail válido e senha com pelo menos 8 caracteres e até 72 bytes.' });
    const hash = await bcrypt.hash(password, 12);
    try {
      const result = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(name.trim(), email, hash);
      const user = { id: Number(result.lastInsertRowid), name: name.trim(), email };
      res.status(201).json({ token: issue(user), user });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'E-mail já cadastrado.' });
      throw error;
    }
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string' || Buffer.byteLength(password) > 72)
      return res.status(400).json({ message: 'Informe e-mail e senha válidos.' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    res.json({ token: issue(user), user: publicUser(user) });
  });
  app.get('/api/auth/me', authenticate, (req, res) => res.json(publicUser(req.user)));
  app.use('/api/technologies', authenticate);
  const fields = 'id, name, base, learning_hours AS learningHours, created_at AS createdAt, updated_at AS updatedAt';
  function validateTechnology(req, res, next) {
    const { name, base, learningHours } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 ||
        !['PHP','C#','JavaScript','TypeScript','Java','Python','Outra'].includes(base) ||
        !Number.isInteger(learningHours) || learningHours < 1 || learningHours > 100000)
      return res.status(400).json({ message: 'Nome de 2 a 100 caracteres, base válida e tempo inteiro entre 1 e 100000 horas são obrigatórios.' });
    req.technology = { name: name.trim(), base, learningHours };
    next();
  }
  function validId(req, res, next) {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)))
      return res.status(400).json({ message: 'ID inválido.' });
    next();
  }
  app.get('/api/technologies', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase().slice(0,100) : '';
    res.json(db.prepare(`SELECT ${fields} FROM technologies WHERE user_id = ? AND instr(lower(name), ?) > 0 ORDER BY id DESC`).all(req.user.id, search));
  });
  app.get('/api/technologies/:id', validId, (req, res) => {
    const item = db.prepare(`SELECT ${fields} FROM technologies WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ message: 'Tecnologia não encontrada.' });
    res.json(item);
  });
  app.post('/api/technologies', validateTechnology, (req, res) => {
    const { name, base, learningHours } = req.technology;
    const result = db.prepare('INSERT INTO technologies (user_id,name,base,learning_hours) VALUES (?,?,?,?)').run(req.user.id, name, base, learningHours);
    res.status(201).json(db.prepare(`SELECT ${fields} FROM technologies WHERE id = ?`).get(result.lastInsertRowid));
  });
  app.put('/api/technologies/:id', validId, validateTechnology, (req, res) => {
    const { name, base, learningHours } = req.technology;
    const result = db.prepare('UPDATE technologies SET name=?, base=?, learning_hours=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(name, base, learningHours, req.params.id, req.user.id);
    if (!result.changes) return res.status(404).json({ message: 'Tecnologia não encontrada.' });
    res.json(db.prepare(`SELECT ${fields} FROM technologies WHERE id=? AND user_id=?`).get(req.params.id, req.user.id));
  });
  app.delete('/api/technologies/:id', validId, (req, res) => {
    const result = db.prepare('DELETE FROM technologies WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    if (!result.changes) return res.status(404).json({ message: 'Tecnologia não encontrada.' });
    res.status(204).end();
  });
  app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
  app.use((error, req, res, next) => {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Você já cadastrou uma tecnologia com esse nome.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido.' });
    if (error.status === 413) return res.status(413).json({ message: 'Requisição muito grande.' });
    console.error(error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  });
  return { app, db };
}
