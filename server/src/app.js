import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/applications', applicationRoutes);

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
