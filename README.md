# Hubana Carbone Service

Microservice to render documents (PDF/ODT/DOCX) using Carbone.

## Endpoints
- `GET /health` → `{ status: 'ok' }`
- `POST /render` (multipart/form-data): `template` file, `data` JSON string, optional `format` (default `pdf`).
- `POST /render-base64` (JSON): `{ templateBase64, data, format }` → returns base64 of rendered file.

## Run
```bash
cd hubana-carbone
npm install
npm start
# Service listens on CARBONE_PORT (default 3001)
```
