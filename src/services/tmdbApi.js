const axios = require('../config/axios');
const API_URL = 'https://api.themoviedb.org/3/';

// Configuração básica para todas as requisições
const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.TMDB_API_TOKEN}`,
  'Content-Type': 'application/json'
});

// Função para realizar chamadas à API
const apiRequest = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(
      `${API_URL}${endpoint}`, 
      { 
        headers: getHeaders(),
        params: {
          language: 'pt-BR',
          ...params
        }
      }
    );
    return response;
  } catch (error) {
    console.error(`Erro na chamada à API (${endpoint}):`, error.message);
    throw error;
  }
};

module.exports = {
  // Função genérica
  request: (endpoint, params) => apiRequest(endpoint, params),
  
  // Filmes populares
  getPopularMovies: (params) => apiRequest('movie/popular', params),
  
  // Filmes em cartaz
  getNowPlayingMovies: (params) => apiRequest('movie/now_playing', params),
  
  // Próximos lançamentos
  getUpcomingMovies: (params) => apiRequest('movie/upcoming', params),
  
  // Filmes mais bem avaliados
  getTopRatedMovies: (params) => apiRequest('movie/top_rated', params),
  
  // Detalhes do filme
  getMovieDetails: (movieId, params) => apiRequest(`movie/${movieId}`, params),
  
  // Créditos do filme (cast/crew)
  getMovieCredits: (movieId) => apiRequest(`movie/${movieId}/credits`),
  
  // Vídeos do filme
  getMovieVideos: (movieId) => apiRequest(`movie/${movieId}/videos`),
  
  // Imagens do filme
  getMovieImages: (movieId) => apiRequest(`movie/${movieId}/images`),
  
  // Buscar filmes
  searchMovies: (query, params) => apiRequest('search/movie', { query, ...params }),
  searchSeries: (query, params) => apiRequest('search/tv', {query, ...params}),
  
  // Séries populares
  getPopularSeries: (params) => apiRequest('tv/popular', params),

  // Séries em exibição
  getAiringTodaySeries: (params) => apiRequest('tv/airing_today', params),

  // Em breve
  getOnTheAirSeries: (params) => apiRequest('tv/on_the_air', params),

  // Séries mais bem avaliadas
  getTopRatedSeries: (params) => apiRequest('tv/top_rated', params),

  // Detalhes da série
  getSeriesDetails: (tvId, params) => apiRequest(`tv/${tvId}`,params),

  // Descobrir filmes por filtros
  discoverMovies: (params) => apiRequest('discover/movie', params),
  discoverSeries: (params) => apiRequest('discover/tv', params),
  
  // Taxonomias
  getMovieGenres: () => apiRequest('genre/movie/list'),
  getSeriesGenres: () => apiRequest('genre/tv/list'), 
  getLanguages: () => apiRequest('configuration/languages'),
  getCountries: () => apiRequest('configuration/countries'),
  
  // Configurações (para URLs de imagens)
  getConfiguration: () => apiRequest('configuration'),
  
  // Pessoas (atores, diretores)
  getPersonDetails: (personId) => apiRequest(`person/${personId}`),
  getPersonMovies: (personId) => apiRequest(`person/${personId}/movie_credits`),
  getPersonSeries: (personId) => apiRequest(`person/${personId}/tv_credits`),
  
  // Coleções
  getCollection: (collectionId) => apiRequest(`collection/${collectionId}`),
  
  // Empresas de produção
  getCompany: (companyId) => apiRequest(`company/${companyId}`),
  
  // Keywords
  getMovieKeywords: (movieId) => apiRequest(`movie/${movieId}/keywords`),
  getSeriesKeywords: (seriesId) => apiRequest(`tv/${seriesId}/keywords`),
  
  // Filmes similares
  getSimilarMovies: (movieId, params) => apiRequest(`movie/${movieId}/similar`, params),
  getSimilarSeries: (seriesId, params) => apiRequest(`tv/${seriesId}/similar`, params),
  
  // Recomendações
  getMovieRecommendations: (movieId, params) => apiRequest(`movie/${movieId}/recommendations`, params),
  getSeriesRecommendations: (seriesId, params) => apiRequest(`tv/${seriesId}/recommendations`, params)
};