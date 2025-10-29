const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Load OpenAPI spec (re-use week8/static/openapi.yml)
const openapiPath = path.join(__dirname, '../static/openapi.yml');
const openapiDocument = YAML.load(openapiPath);

// App
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Mongo connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/library_v8';
mongoose
  .connect(mongoUri, { dbName: 'library_v8' })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Swagger UI
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Controllers
const booksController = require('./controllers/booksController');

// Routes (align with OpenAPI paths for Books)
app.get('/books', booksController.listBooks); // operationId: listBooks
app.post('/books', booksController.createBook); // operationId: createBook
app.get('/books/:id', booksController.getBookById); // operationId: getBookById
app.put('/books/:id', booksController.updateBookById); // operationId: updateBookById
app.delete('/books/:id', booksController.deleteBookById); // operationId: deleteBookById

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start
const port = process.env.PORT || 5008;
app.listen(port, () => {
  console.log(`Node backend listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/swagger`);
});


