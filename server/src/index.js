import { createApp } from './app.js';
import { migrate } from './db.js';
import { config } from './config.js';

await migrate();
createApp().listen(config.port, () => {
  console.log(`server listening on :${config.port}`);
});
