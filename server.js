/* Express + Carbone render service
 * Endpoints:
 *  - GET /health -> { status: 'ok' }
 *  - POST /render (multipart/form-data: template file, data json string, format pdf/odt/docx)
 *  - POST /render-base64 (json: { templateBase64, data, format })
 */
const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const carbone = require('carbone');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const upload = multer({ dest: 'tmp/' });
const app = express();
app.use(morgan('dev'));
app.use(express.json({ limit: '15mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Multipart render: template file + data
app.post('/render', upload.single('template'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'template file is required' });
    }
    const data = req.body.data ? JSON.parse(req.body.data) : {};
    const format = req.body.format || 'pdf';

    carbone.render(req.file.path, data, { convertTo: format }, (err, result) => {
      fs.unlink(req.file.path, () => {});
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'render failed', error: err.message });
      }
      res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="document.${format}"`);
      return res.send(result);
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'unexpected error', error: e.message });
  }
});

// JSON render: template in base64
app.post('/render-base64', (req, res) => {
  try {
    const { templateBase64, data = {}, format = 'pdf' } = req.body || {};
    if (!templateBase64) {
      return res.status(400).json({ success: false, message: 'templateBase64 is required' });
    }
    const buffer = Buffer.from(templateBase64, 'base64');
    const tmpName = crypto.randomUUID() + '.odt';
    const tmpPath = path.join('tmp', tmpName);
    fs.writeFileSync(tmpPath, buffer);

    carbone.render(tmpPath, data, { convertTo: format }, (err, result) => {
      fs.unlink(tmpPath, () => {});
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'render failed', error: err.message });
      }
      const base64 = Buffer.from(result).toString('base64');
      return res.json({ success: true, data: base64 });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'unexpected error', error: e.message });
  }
});

const port = process.env.CARBONE_PORT || 3001;
app.listen(port, () => console.log(`Carbone service listening on ${port}`));
