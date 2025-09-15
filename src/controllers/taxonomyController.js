const { getTaxonomyCache } = require('../services/taxonomy');

module.exports = {
  getMovieGenres: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.movieGenres);
    } catch (error) {
      console.error('Erro ao buscar gêneros:', error);
      res.status(500).json({ error: 'Erro interno ao buscar gêneros' });
    }
  },

  getSeriesGenres: (req, res) =>{
    try{
      const taxonomyCache = getTaxonomyCache()
      res.json(taxonomyCache.seriesGenres);
    }catch(error){
      console.error('Erro ao buscar gêneros de séries:', error);
      res.status(500).json({ error: 'Erro interno ao buscar gêneros' })
    }
  },

  getLanguages: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.languages);
    } catch (error) {
      console.error('Erro ao buscar idiomas:', error);
      res.status(500).json({ error: 'Erro interno ao buscar idiomas' });
    }
  },

  getCountries: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.countries);
    } catch (error) {
      console.error('Erro ao buscar países:', error);
      res.status(500).json({ error: 'Erro interno ao buscar países' });
    }
  },

  getConfiguration: (req, res) => {
    try {
      const taxonomyCache = getTaxonomyCache();
      res.json(taxonomyCache.configuration);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      res.status(500).json({ error: 'Erro interno ao buscar configurações' });
    }
  }
};