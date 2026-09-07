const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const { healthCheck } = require('./db/pool');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const visitorsRoutes = require('./routes/visitors.routes');
const calllogRoutes = require('./routes/calllog.routes');
const settingsRoutes = require('./routes/settings.routes');
const reportsRoutes = require('./routes/reports.routes');
const searchRoutes = require('./routes/search.routes');
const importRoutes = require('./routes/import.routes');
const buildOptionsRouter = require('./routes/optionsFactory');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '8mb' }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

app.get('/api/health', async (req, res) => {
  try {
    const dbOk = await healthCheck();
    res.json({ status: 'ok', db: dbOk, version: config.version, time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: false, error: 'Database unavailable.' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/calllog', calllogRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/import', importRoutes);
app.use('/api/settings/purpose-options', buildOptionsRouter('purpose_options'));
app.use('/api/settings/enquiry-type-options', buildOptionsRouter('enquiry_type_options'));
app.use('/api/settings/meeting-person-options', buildOptionsRouter('meeting_person_options'));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Visitor Register & Call Log API listening on port ${config.port} [${config.env}]`);
  });
}

module.exports = app;
