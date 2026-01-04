const express = require('express');
const carbone = require('carbone');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();
const port = process.env.PORT || 3001;

const reportDestination = path.join('/tmp', 'reports');
if (!fs.existsSync(reportDestination)) {
	fs.mkdirSync(reportDestination, { recursive: true });
}

// Attempt to locate LibreOffice to help Carbone
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
    carbone.set({ startFactory: true, factory: { path: loPath } });
} else {
    console.warn('[WARN] LibreOffice binary NOT FOUND in common paths. Carbone might fail.');
}

/* Setting up a middleware in the Express application to allow parsing of JSON in the incoming requests. */
app.use(express.json());

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
