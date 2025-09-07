const axios = require('../config/axios');
const API_URL = 'https://api.themoviedb.org/3/';

// Configuração básica para todas as requisições
const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.TMDB_API_TOKEN}`,
  'Content-Type': 'application/json'
});

// Função genérica para realizar chamadas à API
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
  
  // Descobrir filmes por filtros
  discoverMovies: (params) => apiRequest('discover/movie', params),
  
  // Taxonomias
  getGenres: () => apiRequest('genre/movie/list'),
  getLanguages: () => apiRequest('configuration/languages'),
  getCountries: () => apiRequest('configuration/countries'),
  
  // Configurações (para URLs de imagens)
  getConfiguration: () => apiRequest('configuration'),
  
  // Pessoas (atores, diretores)
  getPersonDetails: (personId) => apiRequest(`person/${personId}`),
  getPersonMovies: (personId) => apiRequest(`person/${personId}/movie_credits`),
  
  // Coleções
  getCollection: (collectionId) => apiRequest(`collection/${collectionId}`),
  
  // Empresas de produção
  getCompany: (companyId) => apiRequest(`company/${companyId}`),
  
  // Keywords
  getMovieKeywords: (movieId) => apiRequest(`movie/${movieId}/keywords`),
  
  // Filmes similares
  getSimilarMovies: (movieId, params) => apiRequest(`movie/${movieId}/similar`, params),
  
  // Recomendações
  getMovieRecommendations: (movieId, params) => apiRequest(`movie/${movieId}/recommendations`, params)
};