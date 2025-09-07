const { gameCache, genreCache } = require('../config/cache'); // Renomear para movieCache depois
const tmdbApi = require('../services/tmdbApi');
const { 
  fetchWithFallback,
  processMovies,
  processGenreBatch,
  enrichMovieDetails,
  EnrichmentLevel
} = require('../utils/helpers');

module.exports = {
  getPopularMovies: async (req, res) => {
    try {
      // Extract pagination parameters from request
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      
      // Generate a unique cache key that includes pagination info
      const cacheKey = `popular_movies_${pageSize}_${page}`;
      
      // Check if we have this page cached
      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            hasMore: true
          }
        });
      }

      // Fetch popular movies with pagination
      const response = await fetchWithFallback(
        async () => {
          return await tmdbApi.getPopularMovies({ page });
        },
        async () => {
          return await tmdbApi.getTopRatedMovies({ page });
        }
      );

      const movies = response.data.results || [];
      
      // If no movies found for this page, return appropriate response
      if (!movies.length) {
        return res.status(200).json({
          movies: [],
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            hasMore: false
          }
        });
      }

      // Process and cache the results
      const processedMovies = await processMovies(movies);
      gameCache.set(cacheKey, processedMovies);

      // Return paginated response
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });

    } catch (error) {
      console.error('Error fetching data: ', error.message);
      
      if (error.response) {
        res.status(error.response.status).json({ 
          error: 'Error fetching TMDB data',
          details: error.response.data 
        });
      } else {
        res.status(500).json({ error: 'Connection error' });
      }
    }
  },

  getMoviesByGenre: async (req, res) => {
    try {
      // Verificar o cache primeiro
      const cachedMoviesByGenre = genreCache.get('genres_movies');
      if (cachedMoviesByGenre) {
        return res.status(200).json(cachedMoviesByGenre);
      }

      // Obter gêneros do cache de taxonomia
      const { getTaxonomyCache } = require('../services/taxonomy');
      const taxonomyCache = getTaxonomyCache();
      const genres = Object.entries(taxonomyCache.genres).map(([id, name]) => ({ id: parseInt(id), name }));

      if (!genres.length) {
        return res.status(404).json({ error: 'Nenhum gênero encontrado' });
      }

      // Buscar filmes por gênero
      const moviesByGenre = await Promise.allSettled(
        genres.map(async genre => {
          try {
            const response = await tmdbApi.discoverMovies({
              with_genres: genre.id,
              sort_by: 'popularity.desc',
              page: 1
            });

            const movies = response.data.results.slice(0, 20).map(movie => ({
              ...movie,
              poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
              backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
              release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
            }));

            return { status: 'fulfilled', genre: genre.name, movies };
          } catch (error) {
            console.error(`Erro ao buscar filmes do gênero ${genre.name}:`, error.message);
            return { status: 'rejected', genre: genre.name, movies: [] };
          }
        })
      );

      // Filtrar apenas resultados bem-sucedidos
      const result = moviesByGenre
        .filter(item => item.status === 'fulfilled' && item.value.movies.length > 0)
        .map(item => ({
          id: genres.find(g => g.name === item.value.genre)?.id,
          value: item.value,
          status: 'fulfilled'
        }));

      // Armazenar em cache
      genreCache.set('genres_movies', result);

      // Retornar resultado
      res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao buscar gêneros:', error);
      res.status(500).json({ error: 'Erro ao buscar dados TMDB' });
    }
  },

  searchMovies: async (req, res) => {
    try {
      const movieName = req.params.name;
      const page = parseInt(req.query.page) || 1;
      
      // Gerar chave de cache para esta busca específica
      const cacheKey = `search_${movieName}_${page}`;
      
      // Verificar cache primeiro
      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      // Buscar filmes
      const response = await tmdbApi.searchMovies(movieName, { page });
      
      if (!response.data.results?.length) {
        return res.status(200).json({
          movies: [],
          pagination: {
            currentPage: page,
            hasMore: false
          }
        });
      }
      
      // Processar filmes
      const processedMovies = await processMovies(response.data.results);
      
      // Cachear os resultados
      gameCache.set(cacheKey, processedMovies);
      
      // Retornar resultados paginados
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
      
    } catch (error) {
      console.error('Erro na busca de filmes:', error);
      
      if (error.response) {
        res.status(error.response.status).json({ 
          error: 'Erro ao buscar dados TMDB',
          details: error.response.data 
        });
      } else {
        res.status(500).json({ error: 'Erro de conexão' });
      }
    }
  },

  getMovieDetails: async (req, res) => {
    try {
      const movieId = req.params.id;
      
      if (isNaN(Number(movieId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      const movieResponse = await tmdbApi.getMovieDetails(movieId, {
        append_to_response: 'credits,videos,images,similar'
      });

      if (!movieResponse.data) {
        return res.status(404).json({ error: 'Filme não encontrado' });
      }

      // Enriquecer com dados detalhados
      const movieDetails = await enrichMovieDetails(movieResponse.data, EnrichmentLevel.DETAILED);
      res.status(200).json(movieDetails);
    } catch (error) {
      console.error('Erro ao buscar detalhes do filme:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes do filme' });
    }
  },

  getNowPlayingMovies: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `now_playing_movies_${page}`;
      
      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getNowPlayingMovies({ page });
      const processedMovies = await processMovies(response.data.results || []);
      
      gameCache.set(cacheKey, processedMovies);
      
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
    } catch (error) {
      console.error('Erro ao buscar filmes em cartaz:', error);
      res.status(500).json({ error: 'Erro ao buscar filmes em cartaz' });
    }
  },

  getUpcomingMovies: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `upcoming_movies_${page}`;
      
      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getUpcomingMovies({ page });
      const processedMovies = await processMovies(response.data.results || []);
      
      gameCache.set(cacheKey, processedMovies);
      
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
    } catch (error) {
      console.error('Erro ao buscar próximos lançamentos:', error);
      res.status(500).json({ error: 'Erro ao buscar próximos lançamentos' });
    }
  },

  getTopRatedMovies: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `top_rated_movies_${page}`;
      
      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getTopRatedMovies({ page });
      const processedMovies = await processMovies(response.data.results || []);
      
      gameCache.set(cacheKey, processedMovies);
      
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
    } catch (error) {
      console.error('Erro ao buscar filmes mais bem avaliados:', error);
      res.status(500).json({ error: 'Erro ao buscar filmes mais bem avaliados' });
    }
  },

  getMoviesByYear: async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `movies_year_${year}_${page}`;
      
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) {
        return res.status(400).json({ error: 'Ano inválido' });
      }
      
      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.discoverMovies({
        primary_release_year: year,
        sort_by: 'popularity.desc',
        page
      });
      
      const processedMovies = await processMovies(response.data.results || []);
      gameCache.set(cacheKey, processedMovies);
      
      res.status(200).json({
        movies: processedMovies,
        year,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
    } catch (error) {
      console.error('Erro ao buscar filmes por ano:', error);
      res.status(500).json({ error: 'Erro ao buscar filmes por ano' });
    }
  },

  // Filmes similares a um filme específico
  getSimilarMovies: async (req, res) => {
    try {
      const movieId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `similar_movies_${movieId}_${page}`;
      
      if (isNaN(Number(movieId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getSimilarMovies(movieId, { page });
      
      if (!response.data.results?.length) {
        return res.status(200).json({
          movies: [],
          pagination: {
            currentPage: page,
            hasMore: false
          }
        });
      }

      const processedMovies = await processMovies(response.data.results);
      gameCache.set(cacheKey, processedMovies);
      
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
    } catch (error) {
      console.error('Erro ao buscar filmes similares:', error);
      res.status(500).json({ error: 'Erro ao buscar filmes similares' });
    }
  },

  // Recomendações baseadas em um filme
  getMovieRecommendations: async (req, res) => {
    try {
      const movieId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `recommendations_${movieId}_${page}`;
      
      if (isNaN(Number(movieId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json({
          movies: gameCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getMovieRecommendations(movieId, { page });
      
      if (!response.data.results?.length) {
        return res.status(200).json({
          movies: [],
          pagination: {
            currentPage: page,
            hasMore: false
          }
        });
      }

      const processedMovies = await processMovies(response.data.results);
      gameCache.set(cacheKey, processedMovies);
      
      res.status(200).json({
        movies: processedMovies,
        pagination: {
          currentPage: page,
          hasMore: page < response.data.total_pages,
          totalPages: response.data.total_pages,
          totalResults: response.data.total_results
        }
      });
    } catch (error) {
      console.error('Erro ao buscar recomendações:', error);
      res.status(500).json({ error: 'Erro ao buscar recomendações' });
    }
  },

  // Detalhes de uma pessoa (ator, diretor, etc.)
  getPersonDetails: async (req, res) => {
    try {
      const personId = req.params.id;
      const cacheKey = `person_details_${personId}`;
      
      if (isNaN(Number(personId))) {
        return res.status(400).json({ error: 'ID da pessoa inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json(gameCache.get(cacheKey));
      }

      const response = await tmdbApi.getPersonDetails(personId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Pessoa não encontrada' });
      }

      const { getProfileUrl } = require('../services/taxonomy');
      
      const personDetails = {
        ...response.data,
        profile_url: response.data.profile_path ? getProfileUrl(response.data.profile_path) : null
      };

      gameCache.set(cacheKey, personDetails);
      res.status(200).json(personDetails);
    } catch (error) {
      console.error('Erro ao buscar detalhes da pessoa:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes da pessoa' });
    }
  },

  // Filmografia de uma pessoa
  getPersonMovies: async (req, res) => {
    try {
      const personId = req.params.id;
      const cacheKey = `person_movies_${personId}`;
      
      if (isNaN(Number(personId))) {
        return res.status(400).json({ error: 'ID da pessoa inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json(gameCache.get(cacheKey));
      }

      const response = await tmdbApi.getPersonMovies(personId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Filmografia não encontrada' });
      }

      const { getPosterUrl } = require('../services/taxonomy');
      
      const filmography = {
        cast: response.data.cast ? response.data.cast.map(movie => ({
          ...movie,
          poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : null,
          release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
        })).sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0)) : [],
        
        crew: response.data.crew ? response.data.crew.map(movie => ({
          ...movie,
          poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : null,
          release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
        })).sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0)) : []
      };

      gameCache.set(cacheKey, filmography);
      res.status(200).json(filmography);
    } catch (error) {
      console.error('Erro ao buscar filmografia:', error);
      res.status(500).json({ error: 'Erro ao buscar filmografia' });
    }
  },

  // Detalhes de uma coleção
  getCollection: async (req, res) => {
    try {
      const collectionId = req.params.id;
      const cacheKey = `collection_${collectionId}`;
      
      if (isNaN(Number(collectionId))) {
        return res.status(400).json({ error: 'ID da coleção inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json(gameCache.get(cacheKey));
      }

      const response = await tmdbApi.getCollection(collectionId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Coleção não encontrada' });
      }

      const { getPosterUrl, getBackdropUrl } = require('../services/taxonomy');
      
      const collection = {
        ...response.data,
        poster_url: response.data.poster_path ? getPosterUrl(response.data.poster_path) : null,
        backdrop_url: response.data.backdrop_path ? getBackdropUrl(response.data.backdrop_path) : null,
        parts: response.data.parts ? response.data.parts.map(movie => ({
          ...movie,
          poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : null,
          release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
        })).sort((a, b) => new Date(a.release_date || 0) - new Date(b.release_date || 0)) : []
      };

      gameCache.set(cacheKey, collection);
      res.status(200).json(collection);
    } catch (error) {
      console.error('Erro ao buscar coleção:', error);
      res.status(500).json({ error: 'Erro ao buscar coleção' });
    }
  },

  // Palavras-chave de um filme
  getMovieKeywords: async (req, res) => {
    try {
      const movieId = req.params.id;
      const cacheKey = `movie_keywords_${movieId}`;
      
      if (isNaN(Number(movieId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json(gameCache.get(cacheKey));
      }

      const response = await tmdbApi.getMovieKeywords(movieId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Palavras-chave não encontradas' });
      }

      const keywords = response.data.keywords || [];
      gameCache.set(cacheKey, keywords);
      res.status(200).json(keywords);
    } catch (error) {
      console.error('Erro ao buscar palavras-chave:', error);
      res.status(500).json({ error: 'Erro ao buscar palavras-chave' });
    }
  },

  // Detalhes de uma empresa/estúdio
  getCompanyDetails: async (req, res) => {
    try {
      const companyId = req.params.id;
      const cacheKey = `company_${companyId}`;
      
      if (isNaN(Number(companyId))) {
        return res.status(400).json({ error: 'ID da empresa inválido' });
      }

      if (gameCache.get(cacheKey)) {
        return res.status(200).json(gameCache.get(cacheKey));
      }

      const response = await tmdbApi.getCompany(companyId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Empresa não encontrada' });
      }

      gameCache.set(cacheKey, response.data);
      res.status(200).json(response.data);
    } catch (error) {
      console.error('Erro ao buscar detalhes da empresa:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes da empresa' });
    }
  }
};