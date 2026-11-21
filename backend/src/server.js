import 'dotenv/config';
import { createApp } from './app.js';
const { app, db } = createApp({ secret: process.env.JWT_SECRET, databasePath: process.env.DATABASE_PATH || './data/database.sqlite' });
const server = app.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`API: http://localhost:${process.env.PORT || 3000}/api`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
