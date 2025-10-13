import {
  getEntriesForClustering,
  updateEntryClusters,
  createSmartFolder,
  getSmartFolders,
  updateSmartFolder,
  deleteSmartFolder,
  getJournalEntry,
  getSetting,
  setSetting,
} from './databaseService';
import { clusterEmbeddings, labelCluster } from './embeddingsService';

/**
 * Regenerate all cluster folders from scratch
 * @param {number} numClusters - Number of clusters to create (default from settings)
 * @returns {Promise<void>}
 */
export const regenerateClusters = async (numClusters = null) => {
  try {
    console.log('Starting cluster regeneration...');

    // Get number of clusters from settings or use default
    if (!numClusters) {
      const setting = await getSetting('cluster_count');
      numClusters = setting ? parseInt(setting) : 5;
    }

    // Get all entries with embeddings
    const entries = await getEntriesForClustering();

    if (entries.length < 3) {
      console.log('Not enough entries with embeddings to cluster');
      return;
    }

    // Adjust k if we have fewer entries than clusters
    const k = Math.min(numClusters, Math.floor(entries.length / 2));

    console.log(`Clustering ${entries.length} entries into ${k} clusters...`);

    // Run k-means clustering
    const clusterAssignments = clusterEmbeddings(entries, k);

    // Group entries by cluster
    const clusterGroups = {};
    for (const assignment of clusterAssignments) {
      if (!clusterGroups[assignment.clusterId]) {
        clusterGroups[assignment.clusterId] = [];
      }
      clusterGroups[assignment.clusterId].push(assignment.entryId);
    }

    // Update entry cluster assignments in database
    await updateEntryClusters(clusterAssignments);

    // Delete old cluster folders
    const existingFolders = await getSmartFolders();
    for (const folder of existingFolders) {
      if (folder.type === 'cluster') {
        await deleteSmartFolder(folder.id);
      }
    }

    // Create new cluster folders with labels
    console.log('Generating cluster labels...');
    for (const [clusterId, entryIds] of Object.entries(clusterGroups)) {
      if (entryIds.length < 2) {
        continue; // Skip clusters with too few entries
      }

      // Get sample entries for labeling
      const sampleEntries = await Promise.all(
        entryIds.slice(0, 3).map(id => getJournalEntry(id))
      );

      // Generate label using LLM
      const label = await labelCluster(sampleEntries);

      // Create smart folder
      await createSmartFolder(label, 'cluster', null, parseInt(clusterId));

      console.log(`Created cluster folder: "${label}" with ${entryIds.length} entries`);
    }

    // Update last clustering timestamp
    await setSetting('last_clustering_date', new Date().toISOString());

    console.log('Cluster regeneration complete!');
  } catch (error) {
    console.error('Error regenerating clusters:', error);
    throw error;
  }
};

/**
 * Check if clustering should be triggered based on new entries
 * @returns {Promise<boolean>}
 */
export const shouldTriggerClustering = async () => {
  try {
    const lastClusteringDate = await getSetting('last_clustering_date');
    const clusterThreshold = await getSetting('cluster_threshold') || '10';

    if (!lastClusteringDate) {
      // Never clustered before
      const entries = await getEntriesForClustering();
      return entries.length >= 5; // Initial threshold
    }

    // Check how many entries have been added since last clustering
    const allEntries = await getEntriesForClustering();
    const lastDate = new Date(lastClusteringDate);
    const newEntries = allEntries.filter(entry => {
      const entryDate = new Date(entry.created_at);
      return entryDate > lastDate;
    });

    return newEntries.length >= parseInt(clusterThreshold);
  } catch (error) {
    console.error('Error checking clustering trigger:', error);
    return false;
  }
};

/**
 * Get cluster folder for a specific cluster ID
 * @param {number} clusterId - Cluster ID
 * @returns {Promise<object|null>} - Smart folder object or null
 */
export const getClusterFolder = async (clusterId) => {
  const folders = await getSmartFolders();
  return folders.find(f => f.type === 'cluster' && f.cluster_id === clusterId) || null;
};

/**
 * Update cluster folder name
 * @param {number} clusterId - Cluster ID
 * @param {string} newName - New name for the cluster
 * @returns {Promise<void>}
 */
export const renameClusterFolder = async (clusterId, newName) => {
  const folder = await getClusterFolder(clusterId);
  if (folder) {
    await updateSmartFolder(folder.id, { name: newName });
  }
};

/**
 * Get statistics about current clustering
 * @returns {Promise<object>} - Clustering statistics
 */
export const getClusteringStats = async () => {
  try {
    const folders = await getSmartFolders();
    const clusterFolders = folders.filter(f => f.type === 'cluster');
    const lastClusteringDate = await getSetting('last_clustering_date');
    const entries = await getEntriesForClustering();

    return {
      totalClusters: clusterFolders.length,
      totalEntriesWithEmbeddings: entries.length,
      lastClusteringDate: lastClusteringDate ? new Date(lastClusteringDate) : null,
      clusters: clusterFolders.map(f => ({
        id: f.cluster_id,
        name: f.name,
        folderId: f.id,
      })),
    };
  } catch (error) {
    console.error('Error getting clustering stats:', error);
    return {
      totalClusters: 0,
      totalEntriesWithEmbeddings: 0,
      lastClusteringDate: null,
      clusters: [],
    };
  }
};
