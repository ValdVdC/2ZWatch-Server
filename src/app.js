const express = require('express');
const app = express();

// Configurações
require('./config/cache');
const corsConfig = require('./config/cors');
const { keepAliveMiddleware, healthRouter } = require('./middleware/keepAlive');

// Middlewares
app.use(corsConfig);
app.use(express.json());
app.use(keepAliveMiddleware);

// Rotas
app.use('/health', healthRouter);
app.use('/api/movies', require('./routes/movies'));
app.use('/api/series', require('./routes/series'))
app.use('/api/taxonomy', require('./routes/taxonomy'));

// Rota de fallback para compatibilidade
app.use('/api/films', require('./routes/movies'));

module.exports = app;