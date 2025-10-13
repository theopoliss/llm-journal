/**
 * Utility script to generate embeddings for existing entries that don't have them yet
 * Run this from console or add to Settings screen as a button
 */

import { getJournalEntries, updateJournalEntry } from '../services/databaseService';
import { generateEmbedding, extractTopics } from '../services/embeddingsService';
import { regenerateClusters } from '../services/clusteringService';

export const backfillEmbeddings = async (onProgress) => {
  try {
    console.log('Starting embedding backfill...');

    // Get all entries
    const entries = await getJournalEntries();

    // Filter entries without embeddings
    const entriesNeedingEmbeddings = entries.filter(entry => !entry.embedding);

    console.log(`Found ${entriesNeedingEmbeddings.length} entries without embeddings`);

    if (entriesNeedingEmbeddings.length === 0) {
      console.log('All entries already have embeddings!');
      if (onProgress) onProgress('All entries already have embeddings', 100);
      return;
    }

    let processed = 0;

    for (const entry of entriesNeedingEmbeddings) {
      try {
        const text = entry.transcript || entry.summary || '';
        if (!text) {
          console.log(`Skipping entry ${entry.id} - no text content`);
          continue;
        }

        console.log(`Processing entry ${entry.id}...`);

        // Generate embedding
        const embedding = await generateEmbedding(text);
        await updateJournalEntry(entry.id, {
          embedding: JSON.stringify(embedding),
        });

        // Extract topics
        const topics = await extractTopics(text);
        await updateJournalEntry(entry.id, {
          topics: JSON.stringify(topics),
        });

        processed++;
        const progress = Math.round((processed / entriesNeedingEmbeddings.length) * 100);
        console.log(`Progress: ${processed}/${entriesNeedingEmbeddings.length} (${progress}%)`);

        if (onProgress) {
          onProgress(`Processing ${processed}/${entriesNeedingEmbeddings.length}`, progress);
        }

      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
        // Continue with next entry
      }
    }

    console.log('Backfill complete! Now regenerating clusters...');
    if (onProgress) onProgress('Generating clusters...', 95);

    // Regenerate clusters with all entries
    await regenerateClusters();

    console.log('All done!');
    if (onProgress) onProgress('Complete!', 100);

    return {
      processed,
      total: entriesNeedingEmbeddings.length,
    };

  } catch (error) {
    console.error('Error in backfill process:', error);
    throw error;
  }
};

// Quick test function - logs which entries need embeddings
export const checkEmbeddingStatus = async () => {
  const entries = await getJournalEntries();
  const withEmbeddings = entries.filter(e => e.embedding).length;
  const withoutEmbeddings = entries.filter(e => !e.embedding).length;

  console.log(`\nEmbedding Status:`);
  console.log(`  With embeddings: ${withEmbeddings}`);
  console.log(`  Without embeddings: ${withoutEmbeddings}`);
  console.log(`  Total entries: ${entries.length}\n`);

  return { withEmbeddings, withoutEmbeddings, total: entries.length };
};
