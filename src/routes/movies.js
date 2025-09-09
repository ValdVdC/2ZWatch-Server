const router = require('express').Router();
const controller = require('../controllers/movieController');

// Rotas principais de filmes
router.get('/', controller.getPopularMovies);
router.get('/popular', controller.getPopularMovies);
router.get('/now-playing', controller.getNowPlayingMovies);
router.get('/upcoming', controller.getUpcomingMovies);
router.get('/top-rated', controller.getTopRatedMovies);
router.get('/genres', controller.getMoviesByGenre);
router.get('/year/:year', controller.getMoviesByYear);
router.get('/search/:name', controller.searchMovies);

// Rotas de relacionamentos entre filmes
router.get('/:id/similar', controller.getSimilarMovies);
router.get('/:id/recommendations', controller.getMovieRecommendations);
router.get('/:id/keywords', controller.getMovieKeywords);

// Rotas de pessoas
router.get('/person/:id', controller.getPersonDetails);
router.get('/person/:id/movies', controller.getPersonMovies);

// Rotas de coleções e empresas
router.get('/collection/:id', controller.getCollection);
router.get('/company/:id', controller.getCompanyDetails);

// Rota de detalhes do filme
router.get('/:id', controller.getMovieDetails);

module.exports = router;