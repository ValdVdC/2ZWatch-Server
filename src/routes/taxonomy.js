const router = require('express').Router();
const controller = require('../controllers/taxonomyController');

router.get('/genres', controller.getGenres);
router.get('/languages', controller.getLanguages);
router.get('/countries', controller.getCountries);
router.get('/configuration', controller.getConfiguration);

module.exports = router;