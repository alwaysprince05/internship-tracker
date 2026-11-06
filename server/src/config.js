const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env var ${key} (see .env.example)`);
  }
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: '15m',
  refreshTtlDays: 7,
  // Two tabs (or a quick double reload) can send the same refresh token at once.
  refreshReuseGraceSeconds: 30,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Used for the default applied_on date; Postgres CURRENT_DATE would be UTC.
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  isProd: process.env.NODE_ENV === 'production',
  staticDir: process.env.STATIC_DIR || null,
};
