const { seriesCache, genreCache } = require('../config/cache'); 
const tmdbApi = require('../services/tmdbApi');
const { 
  fetchWithFallback,
  processSeries,
  processGenreBatch,
  enrichSeriesDetails,
  EnrichmentLevel
} = require('../utils/helpers');

module.exports = {
    getPopularSeries: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;

      const cacheKey = `popular_series_${pageSize}_${page}`;

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            hasMore: true
          }
        });
      }

      const response = await fetchWithFallback(
        async () => {
          return await tmdbApi.getPopularSeries({ page });
        },
        async () => {
          return await tmdbApi.getTopRatedSeries({ page });
        }
      );

      const series = response.data.results || [];

      if (!series.length) {
        return res.status(200).json({
          series: [],
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            hasMore: false
          }
        });
      }

      const processedSeries = await processSeries(series);
      seriesCache.set(cacheKey, processedSeries);

      res.status(200).json({
        series: processedSeries,
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

  getSeriesByGenre: async (req, res) => {
    try {
      // Verificar o cache primeiro
      const cachedSeriesByGenre = genreCache.get('genres_series');
      if (cachedSeriesByGenre) {
        return res.status(200).json(cachedSeriesByGenre);
      }

      // Obter gêneros do cache de taxonomia
      const { getTaxonomyCache } = require('../services/taxonomy');
      const taxonomyCache = getTaxonomyCache();
      const genres = Object.entries(taxonomyCache.movieGenres).map(([id, name]) => ({ id: parseInt(id), name }));

      if (!genres.length) {
        return res.status(404).json({ error: 'Nenhum gênero encontrado' });
      }

      // Buscar filmes por gênero
      const seriesByGenre = await Promise.allSettled(
        genres.map(async genre => {
          try {
            const response = await tmdbApi.discoverSeries({
              with_genres: genre.id,
              sort_by: 'popularity.desc',
              page: 1
            });

            const series = response.data.results.slice(0, 20).map(series => ({
              ...series,
              poster_url: series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : null,
              backdrop_url: series.backdrop_path ? `https://image.tmdb.org/t/p/w1280${series.backdrop_path}` : null,
              release_year: series.release_date ? new Date(series.release_date).getFullYear() : null
            }));

            return { status: 'fulfilled', genre: genre.name, series };
          } catch (error) {
            console.error(`Erro ao buscar filmes do gênero ${genre.name}:`, error.message);
            return { status: 'rejected', genre: genre.name, series: [] };
          }
        })
      );

      // Filtrar apenas resultados bem-sucedidos
      const result = seriesByGenre
        .filter(item => item.status === 'fulfilled' && item.value.series.length > 0)
        .map(item => ({
          id: genres.find(g => g.name === item.value.genre)?.id,
          value: item.value,
          status: 'fulfilled'
        }));

      // Armazenar em cache
      genreCache.set('genres_series', result);

      // Retornar resultado
      res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao buscar gêneros:', error);
      res.status(500).json({ error: 'Erro ao buscar dados TMDB' });
    }
  },

  searchSeries: async (req, res) => {
    try {
      const seriesName = req.params.name;
      const page = parseInt(req.query.page) || 1;
      
      // Gerar chave de cache para esta busca específica
      const cacheKey = `search_${seriesName}_${page}`;
      
      // Verificar cache primeiro
      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      // Buscar filmes
      const response = await tmdbApi.searchSeries(seriesName, { page });
      
      if (!response.data.results?.length) {
        return res.status(200).json({
          series: [],
          pagination: {
            currentPage: page,
            hasMore: false
          }
        });
      }
      
      // Processar filmes
      const processedSeries = await processSeries(response.data.results);
      
      // Cachear os resultados
      seriesCache.set(cacheKey, processedSeries);
      
      // Retornar resultados paginados
      res.status(200).json({
        series: processedSeries,
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

  getSeriesDetails: async (req, res) => {
    try {
      const seriesId = req.params.id;
      
      if (isNaN(Number(seriesId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      const seriesResponse = await tmdbApi.getSeriesDetails(seriesId, {
        append_to_response: 'credits,videos,images,similar'
      });

      if (!seriesResponse.data) {
        return res.status(404).json({ error: 'Filme não encontrado' });
      }

      // Enriquecer com dados detalhados
      const seriesDetails = await enrichSeriesDetails(seriesResponse.data, EnrichmentLevel.DETAILED);
      res.status(200).json(seriesDetails);
    } catch (error) {
      console.error('Erro ao buscar detalhes do filme:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes do filme' });
    }
  },

  getNowPlayingSeries: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `now_playing_series_${page}`;
      
      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getAiringTodaySeries({ page });
      const processedSeries = await processSeries(response.data.results || []);
      
      seriesCache.set(cacheKey, processedSeries);
      
      res.status(200).json({
        series: processedSeries,
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

  getUpcomingSeries: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `upcoming_series_${page}`;
      
      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getOnTheAirSeries({ page });
      const processedSeries = await processSeries(response.data.results || []);
      
      seriesCache.set(cacheKey, processedSeries);
      
      res.status(200).json({
        series: processedSeries,
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

  getTopRatedSeries: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `top_rated_series_${page}`;
      
      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getTopRatedSeries({ page });
      const processedSeries = await processSeries(response.data.results || []);
      
      seriesCache.set(cacheKey, processedSeries);
      
      res.status(200).json({
        series: processedSeries,
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

  getSeriesByYear: async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `series_year_${year}_${page}`;
      
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) {
        return res.status(400).json({ error: 'Ano inválido' });
      }
      
      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.discoverSeries({
        primary_release_year: year,
        sort_by: 'popularity.desc',
        page
      });
      
      const processedSeries = await processSeries(response.data.results || []);
      seriesCache.set(cacheKey, processedSeries);
      
      res.status(200).json({
        series: processedSeries,
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
  getSimilarSeries: async (req, res) => {
    try {
      const seriesId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `similar_series_${seriesId}_${page}`;
      
      if (isNaN(Number(seriesId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getSimilarSeries(seriesId, { page });
      
      if (!response.data.results?.length) {
        return res.status(200).json({
          series: [],
          pagination: {
            currentPage: page,
            hasMore: false
          }
        });
      }

      const processedSeries = await processSeries(response.data.results);
      seriesCache.set(cacheKey, processedSeries);
      
      res.status(200).json({
        series: processedSeries,
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
  getSeriesRecommendations: async (req, res) => {
    try {
      const seriesId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const cacheKey = `recommendations_${seriesId}_${page}`;
      
      if (isNaN(Number(seriesId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json({
          series: seriesCache.get(cacheKey),
          pagination: {
            currentPage: page,
            hasMore: true
          }
        });
      }

      const response = await tmdbApi.getSeriesRecommendations(seriesId, { page });
      
      if (!response.data.results?.length) {
        return res.status(200).json({
          series: [],
          pagination: {
            currentPage: page,
            hasMore: false
          }
        });
      }

      const processedSeries = await processSeries(response.data.results);
      seriesCache.set(cacheKey, processedSeries);
      
      res.status(200).json({
        series: processedSeries,
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

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json(seriesCache.get(cacheKey));
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

      seriesCache.set(cacheKey, personDetails);
      res.status(200).json(personDetails);
    } catch (error) {
      console.error('Erro ao buscar detalhes da pessoa:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes da pessoa' });
    }
  },

  // Filmografia de uma pessoa
  getPersonSeries: async (req, res) => {
    try {
      const personId = req.params.id;
      const cacheKey = `person_series_${personId}`;
      
      if (isNaN(Number(personId))) {
        return res.status(400).json({ error: 'ID da pessoa inválido' });
      }

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json(seriesCache.get(cacheKey));
      }

      const response = await tmdbApi.getPersonSeries(personId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Filmografia não encontrada' });
      }

      const { getPosterUrl } = require('../services/taxonomy');
      
      const filmography = {
        cast: response.data.cast ? response.data.cast.map(series => ({
          ...series,
          poster_url: series.poster_path ? getPosterUrl(series.poster_path) : null,
          release_year: series.release_date ? new Date(series.release_date).getFullYear() : null
        })).sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0)) : [],
        
        crew: response.data.crew ? response.data.crew.map(series => ({
          ...series,
          poster_url: series.poster_path ? getPosterUrl(series.poster_path) : null,
          release_year: series.release_date ? new Date(series.release_date).getFullYear() : null
        })).sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0)) : []
      };

      seriesCache.set(cacheKey, filmography);
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

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json(seriesCache.get(cacheKey));
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
        parts: response.data.parts ? response.data.parts.map(series => ({
          ...series,
          poster_url: series.poster_path ? getPosterUrl(series.poster_path) : null,
          release_year: series.release_date ? new Date(series.release_date).getFullYear() : null
        })).sort((a, b) => new Date(a.release_date || 0) - new Date(b.release_date || 0)) : []
      };

      seriesCache.set(cacheKey, collection);
      res.status(200).json(collection);
    } catch (error) {
      console.error('Erro ao buscar coleção:', error);
      res.status(500).json({ error: 'Erro ao buscar coleção' });
    }
  },

  // Palavras-chave de um filme
  getSeriesKeywords: async (req, res) => {
    try {
      const seriesId = req.params.id;
      const cacheKey = `series_keywords_${seriesId}`;
      
      if (isNaN(Number(seriesId))) {
        return res.status(400).json({ error: 'ID do filme inválido' });
      }

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json(seriesCache.get(cacheKey));
      }

      const response = await tmdbApi.getSeriesKeywords(seriesId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Palavras-chave não encontradas' });
      }

      const keywords = response.data.results || [];
      seriesCache.set(cacheKey, keywords);
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

      if (seriesCache.get(cacheKey)) {
        return res.status(200).json(seriesCache.get(cacheKey));
      }

      const response = await tmdbApi.getCompany(companyId);
      
      if (!response.data) {
        return res.status(404).json({ error: 'Empresa não encontrada' });
      }

      seriesCache.set(cacheKey, response.data);
      res.status(200).json(response.data);
    } catch (error) {
      console.error('Erro ao buscar detalhes da empresa:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes da empresa' });
    }
  }
};