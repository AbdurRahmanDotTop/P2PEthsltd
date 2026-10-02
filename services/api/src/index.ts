import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb, Bindings, Variables } from './db';

// Import routes (we will create these next)
import { authRoutes } from './routes/auth';
import { walletRoutes } from './routes/wallets';
import { p2pRoutes } from './routes/p2p';
import { settingsRoutes } from './routes/settings';
import { supportRoutes } from './routes/support';
import { tradingRoutes } from './routes/trading';
import { adminRoutes } from './routes/admin';
import { adminPaymentRoutes } from './routes/admin/payments';
import { adminTradingRoutes } from './routes/admin/trading';
import { notificationRoutes } from './routes/notifications';
import { adminSystemSettingsRoutes } from './routes/admin/system-settings';
import { webhookRoutes } from './routes/webhooks';
import { expertRoutes } from './routes/experts';
import { adminCurrencyRateRoutes } from './routes/admin/currency-rates';
import { publicCurrencyRateRoutes } from './routes/currency-rates';

// New Admin Routes
import adminApiKeysRouter from './routes/admin-api-keys';
import adminAuditRouter from './routes/admin-audit';
import adminContractsRouter from './routes/admin-contracts';
import adminRiskRouter from './routes/admin-risk';
import adminSystemRouter from './routes/admin-system';
import adminNotificationsRouter from './routes/admin-notifications';
import adminExportRouter from './routes/admin-export';
import adminBackupRouter from './routes/admin-backup';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
// Triggering deployment to apply CORS fix

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return 'https://p2p.ethsltd.com';
    const allowed = [
      'https://p2p.ethsltd.com', 
      'https://ethsltd.com', 
      'https://www.ethsltd.com',
      'https://p2p-ethsltd-web.ethsltd.workers.dev',
      'https://ethsltd-web.ethsltd.workers.dev',
      'http://localhost:3000'
    ];
    return allowed.includes(origin) ? origin : 'https://p2p.ethsltd.com';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Trading-Mode', 'x-cregis-signature'],
  credentials: true,
}));

// Setup DB context middleware
app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB));
  await next();
});

app.get('/', (c) => c.json({ status: 'ok', service: 'Ethsltd API', version: '1.0' }));

// Mount routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/wallets', walletRoutes);
app.route('/api/v1/p2p', p2pRoutes);
app.route('/api/v1/settings', settingsRoutes);
app.route('/api/v1/support', supportRoutes);
app.route('/api/v1/trading', tradingRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/admin/payments', adminPaymentRoutes);
app.route('/api/v1/admin/trading', adminTradingRoutes);
app.route('/api/v1/admin/system-settings', adminSystemSettingsRoutes);
app.route('/api/v1/notifications', notificationRoutes);
app.route('/api/v1/experts', expertRoutes);
app.route('/api/v1/currency-rates', publicCurrencyRateRoutes);
app.route('/api/v1/admin/currency-rates', adminCurrencyRateRoutes);
app.route('/api/v1/admin/api-keys', adminApiKeysRouter);
app.route('/api/v1/admin/audit', adminAuditRouter);
app.route('/api/v1/admin/contracts', adminContractsRouter);
app.route('/api/v1/admin/risk', adminRiskRouter);
app.route('/api/v1/admin/system', adminSystemRouter);
app.route('/api/v1/admin/notifications', adminNotificationsRouter);
app.route('/api/v1/admin/export', adminExportRouter);
app.route('/api/v1/admin/backup', adminBackupRouter);
app.route('/webhooks', webhookRoutes);

export default app;
