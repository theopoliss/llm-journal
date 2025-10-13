import axios from 'axios';
import { getSetting } from './databaseService';

/**
 * Generate embedding vector for text using OpenAI's text-embedding-3-small model
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector (1536 dimensions)
 */
export const generateEmbedding = async (text) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Truncate text if too long (OpenAI has token limits)
    const maxLength = 8000; // rough character limit
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: 'text-embedding-3-small',
        input: truncatedText,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation error:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    throw error;
  }
};

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Similarity score between -1 and 1
 */
export const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

/**
 * Simple k-means clustering algorithm
 * @param {Array<{id: number, embedding: number[]}>} entries - Entries with embeddings
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations
 * @returns {Array<{clusterId: number, entryId: number}>} - Cluster assignments
 */
export const clusterEmbeddings = (entries, k = 5, maxIterations = 10) => {
  if (entries.length < k) {
    // Not enough entries for k clusters, assign all to cluster 0
    return entries.map(entry => ({ entryId: entry.id, clusterId: 0 }));
  }

  const embeddings = entries.map(e => e.embedding);
  const n = embeddings.length;
  const dims = embeddings[0].length;

  // Initialize centroids randomly by selecting k random data points
  const centroids = [];
  const usedIndices = new Set();
  for (let i = 0; i < k; i++) {
    let idx;
    do {
      idx = Math.floor(Math.random() * n);
    } while (usedIndices.has(idx));
    usedIndices.add(idx);
    centroids.push([...embeddings[idx]]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assignment step: assign each point to nearest centroid
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestSimilarity = cosineSimilarity(embeddings[i], centroids[0]);

      for (let j = 1; j < k; j++) {
        const similarity = cosineSimilarity(embeddings[i], centroids[j]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = j;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) {
      break; // Converged
    }

    // Update step: recalculate centroids
    const newCentroids = Array(k).fill(null).map(() => new Array(dims).fill(0));
    const counts = new Array(k).fill(0);

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      for (let d = 0; d < dims; d++) {
        newCentroids[cluster][d] += embeddings[i][d];
      }
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        for (let d = 0; d < dims; d++) {
          centroids[j][d] = newCentroids[j][d] / counts[j];
        }
      }
    }
  }

  // Return cluster assignments with entry IDs
  return entries.map((entry, index) => ({
    entryId: entry.id,
    clusterId: assignments[index],
  }));
};

/**
 * Extract key topics from text using LLM
 * @param {string} text - Text to analyze
 * @returns {Promise<string[]>} - Array of topic keywords
 */
export const extractTopics = async (text) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract 3-5 key topics or themes from the journal entry. Return only the topics as a comma-separated list, lowercase, no explanations.',
          },
          {
            role: 'user',
            content: `Extract topics from:\n\n${text}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const topicsText = response.data.choices[0].message.content.trim();
    const topics = topicsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
    return topics;
  } catch (error) {
    console.error('Topic extraction error:', error);
    return [];
  }
};

/**
 * Generate a label for a cluster based on sample entries
 * @param {Array<{transcript: string, summary: string}>} sampleEntries - Sample entries from cluster
 * @returns {Promise<string>} - Cluster label
 */
export const labelCluster = async (sampleEntries) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Format sample entries
    const samples = sampleEntries.slice(0, 3).map((entry, idx) =>
      `Entry ${idx + 1}: ${entry.summary || entry.transcript.substring(0, 200)}`
    ).join('\n\n');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive label (2-4 words) for a cluster of journal entries. The label should capture the main theme. Examples: "Career & Growth", "Relationships", "Personal Health", "Creative Projects".',
          },
          {
            role: 'user',
            content: `Generate a label for these related journal entries:\n\n${samples}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 20,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Cluster labeling error:', error);
    return 'Untitled Topic';
  }
};
