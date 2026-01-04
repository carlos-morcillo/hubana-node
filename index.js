const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { execSync } = require('child_process');

// --- SYNC DIAGNOSTICS (BEFORE CARBONE LOADS) ---
console.log('[STARTUP] Starting pre-Carbone checks...');
console.log('[STARTUP] HOME:', process.env.HOME);
console.log('[STARTUP] PATH:', process.env.PATH);

// Ensure HOME is set (LibreOffice needs a user profile directory)
if (!process.env.HOME) {
    process.env.HOME = '/tmp';
    console.log('[STARTUP] HOME was not set, setting to /tmp');
}

// Create LibreOffice profile directory
const loProfile = path.join(process.env.HOME, '.config', 'libreoffice');
if (!fs.existsSync(loProfile)) {
    fs.mkdirSync(loProfile, { recursive: true });
    console.log('[STARTUP] Created LibreOffice profile dir:', loProfile);
}

// Test execSync which soffice (exactly what Carbone does)
try {
    const result = execSync('which soffice', { encoding: 'utf8' });
    console.log('[STARTUP] execSync which soffice:', result.trim());
} catch (e) {
    console.error('[STARTUP] execSync which soffice FAILED:', e.message);
}

// Test libreoffice --version (to ensure it can execute)
try {
    const result = execSync('soffice --version', { encoding: 'utf8', timeout: 10000 });
    console.log('[STARTUP] soffice --version:', result.trim());
} catch (e) {
    console.error('[STARTUP] soffice --version FAILED:', e.message);
}
// Test fs.existsSync for all paths Carbone might check
const pathsToCheck = [
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/lib/libreoffice/program/soffice',
    '/usr/lib/libreoffice/program/soffice.bin',
    '/opt/libreoffice/program/soffice.bin',
    '/opt/libreoffice7.4/program/soffice.bin',
];
console.log('[STARTUP] fs.existsSync checks:');
for (const p of pathsToCheck) {
    console.log(`  ${p}: ${fs.existsSync(p)}`);
}

console.log('[STARTUP] Pre-checks complete. Loading Carbone...');

// NOW load Carbone (after environment is set up)
const carbone = require('carbone');
console.log('[STARTUP] Carbone loaded successfully.');

// Try to access and patch Carbone's internal converter module
try {
    // The converter module path
    const converterPath = require.resolve('carbone/lib/converter');
    console.log('[STARTUP] Converter module path:', converterPath);
    
    // Try to load it directly
    const converter = require('carbone/lib/converter');
    console.log('[STARTUP] Converter module loaded');
    console.log('[STARTUP] Converter keys:', Object.keys(converter));
    
    // Try to see if there's a way to set the path
    if (typeof converter.init === 'function') {
        console.log('[STARTUP] Calling converter.init()...');
        converter.init();
    }
    
    // Check if there's an internal path variable we can log
    if (converter._converterPath !== undefined) {
        console.log('[STARTUP] converter._converterPath:', converter._converterPath);
    }
    if (converter._soffice !== undefined) {
        console.log('[STARTUP] converter._soffice:', converter._soffice);
    }
} catch (e) {
    console.error('[STARTUP] Error accessing converter:', e.message);
}

const app = express();
// Force 3001 because Easypanel proxy is explicitly configured to point to 3001
const port = 3001;

const reportDestination = path.join('/tmp', 'reports');
if (!fs.existsSync(reportDestination)) {
	fs.mkdirSync(reportDestination, { recursive: true });
}

// --- DIAGNOSTICS START ---
const { exec } = require('child_process');
console.log('[DIAGNOSTICS] PATH:', process.env.PATH);

const checkCmd = (name, cmd) => {
    exec(cmd, (err, stdout, stderr) => {
        console.log(`[DIAGNOSTICS] ${name}:`);
        if (err) console.log(`  Error: ${err.message}`);
        if (stdout) console.log(`  Stdout: ${stdout.trim()}`);
        if (stderr) console.log(`  Stderr: ${stderr.trim()}`);
    });
};

checkCmd('Check `libreoffice` path', 'which libreoffice');
checkCmd('Check `soffice` path', 'which soffice');
checkCmd('Check `libreoffice` version', 'libreoffice --version');
checkCmd('Check `soffice` version', 'soffice --version');
// --- DIAGNOSTICS END ---

// Attempt to locate LibreOffice to help Carbone (legacy check)
const possiblePaths = [
    process.env.LIBREOFFICE_PATH,
    '/usr/bin/libreoffice',
    '/usr/lib/libreoffice/program/soffice',
    '/usr/bin/soffice'
];

let loPath = null;
for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
        loPath = p;
        break;
    }
}

if (loPath) {
    console.log(`[INFO] LibreOffice found at: ${loPath}`);
} else {
    console.warn('[WARN] LibreOffice binary NOT FOUND in common paths. Carbone might fail.');
}

/* Setting up a middleware in the Express application to allow parsing of JSON in the incoming requests. */
app.use(express.json());

/* Health check endpoint for Easypanel */
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Carbone Service Running' });
});

/* Configuring Multer, a middleware for handling file uploads in Express. */
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, '/tmp');
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	}
});

/* Creating an instance of the Multer middleware with a specified storage configuration. Multer is a middleware for handling file
uploads in Express. */
const upload = multer({ storage: storage });

/* Defines a route handler for the HTTP POST request to the '/convert' endpoint. */
app.post('/convert', upload.single('file'), (req, res) => {
	console.log(`file: ${req.file.destination}/${req.file.originalname}`);
	console.log(`data: ${req.body.data}`);
	console.log(`options: ${req.body.options}`);

	const file = req.file;
	const data = JSON.parse(req.body.data ?? 'null');
	const options = JSON.parse(req.body.options ?? '{}');

	let reportName = options.reportName ?? file.originalname;

	carbone.render(
		path.join(file.destination, file.originalname),
		data,
		{
			reportName,
			...options
		},
		async function (err, result) {
			if (err) {
				console.error('Carbone Render Error:', err);
				return res.status(500).json({ message: 'error rendering file', error: err.toString() });
			}

			try {
				await fs.promises.writeFile(
					path.join(reportDestination, reportName),
					result
				);
			} catch (error) {
				console.error('File Write Error:', error);
				return res.status(500).json({ message: 'error writing file', error: error.toString() });
			}

			const options = {
				root: reportDestination,
				dotfiles: 'deny',
				headers: {
					'x-timestamp': Date.now(),
					'x-sent': true,
					'Content-Disposition': `attachment; filename="${reportName}"`
				}
			};
			res.sendFile(`./${reportName}`, options, async (err) => {
				if (err) {
					console.error('Send File Error:', err);
					// Cannot send JSON if headers sent, but try/catch block is implicit here if res.sendFile fails?
					// Usually res.sendFile handles error callback.
					// If we get here, headers likely not sent fully or connection closed.
					// We can't really reply if sendFile fails mid-stream, but we'll try just in case.
					if (!res.headersSent) {
						res.status(500).json({ message: 'error sending file', error: err.toString() });
					}
				}
				try {
					await fs.promises.unlink(
						path.join(reportDestination, reportName)
					);
					await fs.promises.unlink(
						path.join(file.destination, file.originalname)
					);
				} catch (e) {
					console.error('Cleanup Error:', e);
				}
			});
		}
	);
});

/* Starting the server and listening for incoming requests on the specified port. */
const server = app.listen(port, '0.0.0.0', () => {
	console.log(`Servidor API REST en ejecución en http://0.0.0.0:${port}`);
});
