const router = require('express').Router();
const controller = require('../controllers/seriesController');

// Rotas principais de séries
router.get('/', controller.getPopularSeries);
router.get('/popular', controller.getPopularSeries);
router.get('/now-playing', controller.getNowPlayingSeries);
router.get('/upcoming', controller.getUpcomingSeries);
router.get('/top-rated', controller.getTopRatedSeries);
router.get('/genres', controller.getSeriesByGenre);
router.get('/year/:year', controller.getSeriesByYear);
router.get('/search/:name', controller.searchSeries);

// Rotas de relacionamentos entre séries
router.get('/:id/similar', controller.getSimilarSeries);
router.get('/:id/recommendations', controller.getSeriesRecommendations);
router.get('/:id/keywords', controller.getSeriesKeywords);

// Rotas de pessoas
router.get('/person/:id', controller.getPersonDetails);
router.get('/person/:id/movies', controller.getPersonSeries);

// Rotas de coleções e empresas
router.get('/collection/:id', controller.getCollection);
router.get('/company/:id', controller.getCompanyDetails);

// Rota de detalhes da série
router.get('/:id', controller.getSeriesDetails);

module.exports = router;