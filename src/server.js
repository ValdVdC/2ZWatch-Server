const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const { initializeTaxonomies } = require('./services/taxonomy');

async function startServer() {
  try {
    // Inicializar cache de taxonomias do TMDB
    await initializeTaxonomies();
    
    // Iniciar o servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Servidor TMDB rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();