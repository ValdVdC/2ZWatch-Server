const tmdbApi = require('../services/tmdbApi');
const { getTaxonomyCache, getPosterUrl, getBackdropUrl, getProfileUrl } = require('../services/taxonomy');

const EnrichmentLevel = {
  BASIC: 'basic',
  DETAILED: 'detailed'
};

async function fetchWithFallback(primaryFetch, fallbackFetch) {
  try {
    return await primaryFetch();
  } catch (error) {
    if (!error.response || error.response.status !== 429) {
      console.error('Erro na busca principal:', error);
      return await fallbackFetch();
    }
    throw error;
  }
}

async function processMovies(movies, includePosters = true) {
  // Obter cache de taxonomias
  const taxonomyCache = getTaxonomyCache();
  
  // Usar o cache de taxonomias para mapear os dados
  return movies.map(movie => ({
    ...movie,
    genres: movie.genre_ids ? movie.genre_ids.map(genreId => 
      taxonomyCache.genres[genreId] || `Gênero ${genreId}`
    ) : [],
    poster_url: includePosters && movie.poster_path ? getPosterUrl(movie.poster_path) : null,
    backdrop_url: movie.backdrop_path ? getBackdropUrl(movie.backdrop_path) : null,
    release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
  }));
}

async function processGenreBatch(genres, batchSize = 20) {
  return await Promise.allSettled(genres.map(async genre => {
    try {
      const response = await tmdbApi.discoverMovies({
        with_genres: genre.id,
        sort_by: 'popularity.desc',
        page: 1,
        per_page: batchSize
      });

      const movies = response.data.results.map(movie => ({
        ...movie,
        poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : null,
        backdrop_url: movie.backdrop_path ? getBackdropUrl(movie.backdrop_path) : null,
        release_year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
      }));

      return { status: 'fulfilled', genre: genre.name, movies };
    } catch (error) {
      console.error(`Erro ao buscar filmes do gênero ${genre.name}:`, error.message);
      return { status: 'rejected', genre: genre.name, movies: [] };
    }
  }));
}

async function enrichMovieDetails(movie, level = EnrichmentLevel.BASIC) {
  try {
    // Definir quais dados buscar baseado no nível
    const enrichments = [];

    // Dados básicos (sempre incluídos)
    if (movie.id) {
      enrichments.push(fetchMovieGenres(movie.id));
    }

    // Dados detalhados (apenas para nível DETAILED)
    if (level === EnrichmentLevel.DETAILED) {
      if (movie.id) {
        enrichments.push(fetchMovieCredits(movie.id));
        enrichments.push(fetchMovieVideos(movie.id));
        enrichments.push(fetchMovieImages(movie.id));
        enrichments.push(fetchSimilarMovies(movie.id));
      }
    }

    // Executar todas as buscas em paralelo
    const results = await Promise.allSettled(enrichments);

    // Construir objeto de retorno
    const enrichedMovie = { 
      ...movie,
      poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : null,
      backdrop_url: movie.backdrop_path ? getBackdropUrl(movie.backdrop_path) : null
    };

    // Processar resultados
    let currentIndex = 0;

    // Processar gêneros (básico)
    if (movie.id) {
      enrichedMovie.genres = results[currentIndex].status === 'fulfilled' ? 
        results[currentIndex].value : [];
      currentIndex++;
    }

    // Processar dados detalhados
    if (level === EnrichmentLevel.DETAILED) {
      if (movie.id) {
        // Credits
        enrichedMovie.credits = results[currentIndex].status === 'fulfilled' ? 
          results[currentIndex].value : null;
        currentIndex++;

        // Videos
        enrichedMovie.videos = results[currentIndex].status === 'fulfilled' ? 
          results[currentIndex].value : [];
        currentIndex++;

        // Images
        enrichedMovie.images = results[currentIndex].status === 'fulfilled' ? 
          results[currentIndex].value : null;
        currentIndex++;

        // Similar movies
        enrichedMovie.similar_movies = results[currentIndex].status === 'fulfilled' ? 
          results[currentIndex].value : [];
        currentIndex++;
      }
    }

    return enrichedMovie;
  } catch (error) {
    console.error('Erro ao enriquecer detalhes do filme:', error);
    return movie; // Retorna dados básicos em caso de erro
  }
}

// Funções auxiliares de busca
async function fetchMovieGenres(movieId) {
  const response = await tmdbApi.getMovieDetails(movieId);
  return response.data.genres ? response.data.genres.map(genre => genre.name) : [];
}

async function fetchMovieCredits(movieId) {
  const response = await tmdbApi.getMovieCredits(movieId);
  const credits = response.data;
  
  return {
    cast: credits.cast ? credits.cast.slice(0, 10).map(person => ({
      id: person.id,
      name: person.name,
      character: person.character,
      profile_url: person.profile_path ? getProfileUrl(person.profile_path) : null
    })) : [],
    crew: credits.crew ? credits.crew.filter(person => 
      ['Director', 'Producer', 'Executive Producer', 'Screenplay', 'Writer'].includes(person.job)
    ).map(person => ({
      id: person.id,
      name: person.name,
      job: person.job,
      profile_url: person.profile_path ? getProfileUrl(person.profile_path) : null
    })) : []
  };
}

async function fetchMovieVideos(movieId) {
  const response = await tmdbApi.getMovieVideos(movieId);
  return response.data.results ? response.data.results
    .filter(video => video.site === 'YouTube')
    .map(video => ({
      key: video.key,
      name: video.name,
      type: video.type,
      url: `https://youtube.com/embed/${video.key}`
    })) : [];
}

async function fetchMovieImages(movieId) {
  const response = await tmdbApi.getMovieImages(movieId);
  const images = response.data;
  
  return {
    backdrops: images.backdrops ? images.backdrops.slice(0, 5).map(image => ({
      file_path: image.file_path,
      url: getBackdropUrl(image.file_path)
    })) : [],
    posters: images.posters ? images.posters.slice(0, 5).map(image => ({
      file_path: image.file_path,
      url: getPosterUrl(image.file_path)
    })) : []
  };
}

async function fetchSimilarMovies(movieId) {
  const response = await tmdbApi.getSimilarMovies(movieId, { page: 1 });
  return response.data.results ? response.data.results.slice(0, 6).map(movie => ({
    id: movie.id,
    title: movie.title,
    poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : null,
    release_date: movie.release_date,
    vote_average: movie.vote_average
  })) : [];
}

module.exports = {
  fetchWithFallback,
  processMovies,
  processGenreBatch,
  enrichMovieDetails,
  EnrichmentLevel
};