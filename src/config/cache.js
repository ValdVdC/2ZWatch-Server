const NodeCache = require('node-cache');

const movieCache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600
});

const genreCache = new NodeCache({ 
  stdTTL: 3600,
  checkperiod: 600
});

const seriesCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600
});

module.exports = { movieCache, seriesCache, genreCache };