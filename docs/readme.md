# Servidor node para renderización de Carbone.io

## Descripción

API para renderizar plantillas con [Carbone](https://github.com/nltk/carbone). Permite pasar una plantilla, datos para rellenarla y opciones para convertirla a diferentes formatos.

## Endpoints

### POST /convert

Renderiza la plantilla adjunta con los datos proporcionados y la convierte según las opciones.

- Request: 
  - Form data:
    - file: Archivo de la plantilla (docx, xlsx, pptx, odt, etc) 
    - data: Objeto JSON con los datos para rellenar la plantilla
    - options: Objeto JSON con opciones de conversión (por defecto a PDF)
- Response:
  - Body: Archivo renderizado en el formato original o el pasado por parámetro

## Pruebas

Se adjunta un archivo de Postman con ejemplos de requests y una plantilla de prueba en formato DOCX.