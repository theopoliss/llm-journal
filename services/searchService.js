import { generateEmbedding, cosineSimilarity } from './embeddingsService';
import { getDatabase } from './databaseService';

/**
 * Search modes
 */
export const SEARCH_MODES = {
  HYBRID: 'hybrid',
  SEMANTIC: 'semantic',
  KEYWORD: 'keyword',
};

/**
 * Default search configuration
 */
const DEFAULT_CONFIG = {
  mode: SEARCH_MODES.HYBRID,
  semanticWeight: 0.6,
  keywordWeight: 0.4,
  minScore: 0.1,
  maxResults: 50,
};

/**
 * Perform keyword-based search across entries
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Matching entries with scores
 */
export const performKeywordSearch = async (query) => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const db = getDatabase();
    const searchTerm = `%${query.toLowerCase()}%`;

    // Search across transcript, summary, name, and topics
    const results = await db.getAllAsync(
      `SELECT
        id,
        date,
        mode,
        transcript,
        summary,
        name,
        topics,
        embedding,
        cluster_id,
        created_at,
        CASE
          WHEN LOWER(name) LIKE ? THEN 4
          WHEN LOWER(summary) LIKE ? THEN 3
          WHEN LOWER(topics) LIKE ? THEN 2
          WHEN LOWER(transcript) LIKE ? THEN 1
          ELSE 0
        END as match_score
       FROM journal_entries
       WHERE
         LOWER(transcript) LIKE ? OR
         LOWER(summary) LIKE ? OR
         LOWER(name) LIKE ? OR
         LOWER(topics) LIKE ?
       ORDER BY match_score DESC, created_at DESC`,
      [
        searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm
      ]
    );

    // Normalize scores to 0-1 range
    const maxScore = results.length > 0 ? Math.max(...results.map(r => r.match_score)) : 1;

    return results.map(entry => ({
      ...entry,
      score: entry.match_score / maxScore,
      searchType: 'keyword',
    }));
  } catch (error) {
    console.error('Keyword search error:', error);
    return [];
  }
};

/**
 * Perform semantic search using embeddings
 * @param {string} query - Search query
 * @param {number[]} queryEmbedding - Pre-computed query embedding (optional)
 * @returns {Promise<Array>} - Matching entries with similarity scores
 */
export const performSemanticSearch = async (query, queryEmbedding = null) => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    // Generate embedding for query if not provided
    let embedding = queryEmbedding;
    if (!embedding) {
      embedding = await generateEmbedding(query);
    }

    // Get all entries with embeddings
    const db = getDatabase();
    const entries = await db.getAllAsync(
      'SELECT * FROM journal_entries WHERE embedding IS NOT NULL ORDER BY created_at DESC'
    );

    if (entries.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const results = entries.map(entry => {
      const entryEmbedding = JSON.parse(entry.embedding);
      const similarity = cosineSimilarity(embedding, entryEmbedding);

      return {
        ...entry,
        score: similarity,
        searchType: 'semantic',
      };
    });

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    return results;
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
};

/**
 * Combine and rank results from multiple search methods
 * @param {Array} semanticResults - Results from semantic search
 * @param {Array} keywordResults - Results from keyword search
 * @param {number} semanticWeight - Weight for semantic scores (0-1)
 * @param {number} keywordWeight - Weight for keyword scores (0-1)
 * @returns {Array} - Combined and ranked results
 */
export const combineResults = (semanticResults, keywordResults, semanticWeight, keywordWeight) => {
  // Create a map to merge results by entry ID
  const resultsMap = new Map();

  // Add semantic results
  semanticResults.forEach(result => {
    resultsMap.set(result.id, {
      ...result,
      semanticScore: result.score,
      keywordScore: 0,
      combinedScore: result.score * semanticWeight,
      matchTypes: ['semantic'],
    });
  });

  // Merge keyword results
  keywordResults.forEach(result => {
    if (resultsMap.has(result.id)) {
      const existing = resultsMap.get(result.id);
      existing.keywordScore = result.score;
      existing.combinedScore = (existing.semanticScore * semanticWeight) + (result.score * keywordWeight);
      existing.matchTypes.push('keyword');
    } else {
      resultsMap.set(result.id, {
        ...result,
        semanticScore: 0,
        keywordScore: result.score,
        combinedScore: result.score * keywordWeight,
        matchTypes: ['keyword'],
      });
    }
  });

  // Convert to array and sort by combined score
  const combined = Array.from(resultsMap.values());
  combined.sort((a, b) => b.combinedScore - a.combinedScore);

  return combined;
};

/**
 * Main search function with hybrid approach
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Search results with scores
 */
export const searchEntries = async (query, options = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };

  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    let results = [];

    switch (config.mode) {
      case SEARCH_MODES.SEMANTIC:
        // Semantic search only
        results = await performSemanticSearch(query);
        results = results.map(r => ({ ...r, combinedScore: r.score }));
        break;

      case SEARCH_MODES.KEYWORD:
        // Keyword search only
        results = await performKeywordSearch(query);
        results = results.map(r => ({ ...r, combinedScore: r.score }));
        break;

      case SEARCH_MODES.HYBRID:
      default:
        // Hybrid: both semantic and keyword
        const [semanticResults, keywordResults] = await Promise.all([
          performSemanticSearch(query),
          performKeywordSearch(query),
        ]);

        results = combineResults(
          semanticResults,
          keywordResults,
          config.semanticWeight,
          config.keywordWeight
        );
        break;
    }

    // Filter by minimum score
    results = results.filter(r => r.combinedScore >= config.minScore);

    // Limit results
    if (config.maxResults) {
      results = results.slice(0, config.maxResults);
    }

    return results;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

/**
 * Search entries with filters
 * @param {string} query - Search query
 * @param {Object} filters - Additional filters (mode, dateRange, etc.)
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Filtered search results
 */
export const searchEntriesWithFilters = async (query, filters = {}, options = {}) => {
  let results = await searchEntries(query, options);

  // Apply filters
  if (filters.mode) {
    results = results.filter(r => r.mode === filters.mode);
  }

  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    results = results.filter(r => {
      const entryDate = new Date(r.created_at);
      return entryDate >= new Date(start) && entryDate <= new Date(end);
    });
  }

  if (filters.hasName !== undefined) {
    results = results.filter(r => filters.hasName ? r.name : !r.name);
  }

  if (filters.clusterId !== undefined) {
    results = results.filter(r => r.cluster_id === filters.clusterId);
  }

  return results;
};

/**
 * Get search suggestions based on topics
 * @returns {Promise<Array>} - Array of suggested search terms
 */
export const getSearchSuggestions = async () => {
  try {
    const db = getDatabase();
    const entries = await db.getAllAsync(
      'SELECT topics FROM journal_entries WHERE topics IS NOT NULL ORDER BY created_at DESC LIMIT 50'
    );

    // Extract and count unique topics
    const topicCounts = new Map();
    entries.forEach(entry => {
      if (entry.topics) {
        const topics = JSON.parse(entry.topics);
        topics.forEach(topic => {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        });
      }
    });

    // Sort by frequency and return top suggestions
    const suggestions = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    return suggestions;
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
};
