process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgres://tracker:tracker@localhost:5433/tracker_test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';
