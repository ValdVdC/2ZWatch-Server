const router = require('express').Router();
const controller = require('../controllers/taxonomyController');

router.get('/movie-genres', controller.getMovieGenres);
router.get('/series-genres', controller.getSeriesGenres)
router.get('/languages', controller.getLanguages);
router.get('/countries', controller.getCountries);
router.get('/configuration', controller.getConfiguration);

module.exports = router;