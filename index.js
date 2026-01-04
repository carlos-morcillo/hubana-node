const express = require('express');
const carbone = require('carbone');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3001;

// Create reports directory
const reportDestination = path.join('/tmp', 'reports');
if (!fs.existsSync(reportDestination)) {
    fs.mkdirSync(reportDestination, { recursive: true });
}

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Carbone Service Running' });
});

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, '/tmp'),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Convert endpoint
app.post('/convert', upload.single('file'), (req, res) => {
    const file = req.file;
    const data = JSON.parse(req.body.data ?? 'null');
    const options = JSON.parse(req.body.options ?? '{}');
    const reportName = options.reportName ?? file.originalname;

    carbone.render(
        path.join(file.destination, file.originalname),
        data,
        { reportName, ...options },
        async (err, result) => {
            if (err) {
                console.error('Carbone Render Error:', err);
                return res.status(500).json({ message: 'error rendering file', error: err.toString() });
            }

            try {
                await fs.promises.writeFile(path.join(reportDestination, reportName), result);
            } catch (error) {
                console.error('File Write Error:', error);
                return res.status(500).json({ message: 'error writing file', error: error.toString() });
            }

            res.sendFile(`./${reportName}`, {
                root: reportDestination,
                headers: {
                    'Content-Disposition': `attachment; filename="${reportName}"`
                }
            }, async (sendErr) => {
                // Cleanup files
                try {
                    await fs.promises.unlink(path.join(reportDestination, reportName));
                    await fs.promises.unlink(path.join(file.destination, file.originalname));
                } catch (e) {
                    console.error('Cleanup Error:', e);
                }
            });
        }
    );
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Carbone API running on http://0.0.0.0:${port}`);
});
