import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('autenticação, CRUD, validação e isolamento por usuário', async t => {
  const { app, db } = createApp({ databasePath: ':memory:', secret: 'test-secret-with-at-least-32-characters-long' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data };
  }
  assert.equal((await request('/technologies')).status, 401);
  assert.equal((await request('/technologies', 'GET', null, 'invalid')).status, 401);
  const registration = await request('/auth/register', 'POST', { name:'Aluno', email:'aluno@example.com', password:'Senha123!' });
  assert.equal(registration.status, 201);
  const token = registration.data.token;
  assert.equal((await request('/auth/me','GET',null,token)).data.name, 'Aluno');
  assert.equal((await request('/auth/register','POST',{ name:'Outro',email:'aluno@example.com',password:'Senha123!' })).status,409);
  assert.equal((await request('/auth/login','POST',{email:'aluno@example.com',password:'errada123'})).status,401);
  assert.equal((await request('/auth/login','POST',{email:'aluno@example.com',password:'Senha123!'})).status,200);
  const payload = { name:'Angular',base:'TypeScript',learningHours:80 };
  const created = await request('/technologies','POST',payload,token);
  assert.equal(created.status,201);
  const id = created.data.id;
  assert.equal((await request('/technologies','POST',payload,token)).status,409);
  assert.equal((await request('/technologies','POST',{...payload,learningHours:0},token)).status,400);
  assert.equal((await request('/technologies','POST',{...payload,base:'inválida'},token)).status,400);
  assert.equal((await request('/technologies?search=angular','GET',null,token)).data.length,1);
  assert.equal((await request(`/technologies/${id}`,'GET',null,token)).status,200);
  const other = await request('/auth/register','POST',{name:'Outro',email:'outro@example.com',password:'Senha123!'});
  const otherToken = other.data.token;
  assert.equal((await request('/technologies','GET',null,otherToken)).data.length,0);
  assert.equal((await request(`/technologies/${id}`,'GET',null,otherToken)).status,404);
  assert.equal((await request(`/technologies/${id}`,'PUT',payload,otherToken)).status,404);
  assert.equal((await request(`/technologies/${id}`,'DELETE',null,otherToken)).status,404);
  assert.equal((await request(`/technologies/${id}`,'PUT',{...payload,learningHours:100},token)).data.learningHours,100);
  assert.equal((await request(`/technologies/${id}`,'DELETE',null,token)).status,204);
  assert.equal((await request(`/technologies/${id}`,'GET',null,token)).status,404);
});
