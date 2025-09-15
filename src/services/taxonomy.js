const tmdbApi = require('../services/tmdbApi');

let taxonomyCache = {
  movieGenres: {},
  seriesGenres:{},
  languages: {},
  countries: {},
  configuration: null
};

async function initializeTaxonomies() {
  try {
    console.log('Inicializando taxonomias do TMDB...');
    
    // Carregar configurações do TMDB (URLs de imagens, etc.)
    const configResponse = await tmdbApi.getConfiguration();
    taxonomyCache.configuration = configResponse.data;
    
    // Carregar todos os gêneros de filmes
    const movieGenresResponse = await tmdbApi.getMovieGenres();
    taxonomyCache.movieGenres = movieGenresResponse.data.genres.reduce((acc, genre) => {
      acc[genre.id] = genre.name;
      return acc;
    }, {});
    
    const seriesGenreResponse = await tmdbApi.getSeriesGenres();
    taxonomyCache.seriesGenres = seriesGenreResponse.data.genres.reduce((acc, genre) =>{
      acc[genre.id] = genre.name;
      return acc;
    })

    // Carregar idiomas
    const languagesResponse = await tmdbApi.getLanguages();
    taxonomyCache.languages = languagesResponse.data.reduce((acc, language) => {
      acc[language.iso_639_1] = language.english_name;
      return acc;
    }, {});
    
    // Carregar países
    const countriesResponse = await tmdbApi.getCountries();
    taxonomyCache.countries = countriesResponse.data.reduce((acc, country) => {
      acc[country.iso_3166_1] = country.english_name;
      return acc;
    }, {});
    
    console.log('Taxonomias do TMDB inicializadas com sucesso!');
    console.log(`Gêneros de filme carregados: ${Object.keys(taxonomyCache.movieGenres).length}`);
    console.log(`Gêneros de série carregados: ${Object.keys(taxonomyCache.seriesGenres).length}`)
    console.log(`Idiomas carregados: ${Object.keys(taxonomyCache.languages).length}`);
    console.log(`Países carregados: ${Object.keys(taxonomyCache.countries).length}`);
    
    return true;
  } catch (error) {
    console.error('Erro ao inicializar taxonomias do TMDB:', error);
    return false;
  }
}

function getTaxonomyCache() {
  return taxonomyCache;
}

// Função para construir URLs de imagens
function buildImageUrl(path, size = 'w500') {
  if (!path || !taxonomyCache.configuration) return null;
  
  const baseUrl = taxonomyCache.configuration.images.secure_base_url;
  return `${baseUrl}${size}${path}`;
}

// Função para obter URL do poster
function getPosterUrl(path, size = 'w500') {
  return buildImageUrl(path, size);
}

// Função para obter URL do backdrop
function getBackdropUrl(path, size = 'w1280') {
  return buildImageUrl(path, size);
}

// Função para obter URL de perfil de pessoa
function getProfileUrl(path, size = 'w185') {
  return buildImageUrl(path, size);
}

module.exports = {
  initializeTaxonomies,
  getTaxonomyCache,
  buildImageUrl,
  getPosterUrl,
  getBackdropUrl,
  getProfileUrl
};