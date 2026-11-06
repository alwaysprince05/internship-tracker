import { createApp } from './app.js';
import { migrate, pool } from './db.js';
import { config } from './config.js';

await migrate();
const server = createApp().listen(config.port, () => {
  console.log(`server listening on :${config.port}`);
});

// Hosts send SIGTERM before replacing the instance on a deploy: finish
// in-flight requests, then close the database pool.
process.on('SIGTERM', () => {
  server.close(() => pool.end().then(() => process.exit(0)));
});
