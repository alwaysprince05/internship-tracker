import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';

// staticDir: the built client (client/dist). When set, the API and the app are
// served from one origin, so the refresh cookie is first-party and browsers
// that block third-party cookies don't log the user out on reload.
export function createApp({ staticDir = config.staticDir } = {}) {
  const app = express();
  // sendFile needs an absolute path; STATIC_DIR may be given relative to the working directory.
  if (staticDir) staticDir = path.resolve(staticDir);
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

  if (staticDir) {
    // Hashed asset names never change, so they can be cached for a year; index.html must not be.
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(staticDir, { index: false }));
    app.get('/{*path}', (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  // Express 5 forwards rejected promises here.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'invalid JSON body' });
    }
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });
  return app;
}
