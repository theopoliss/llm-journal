import * as SQLite from 'expo-sqlite';

let db = null;

export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('llm_journal.db');

    // Create journal_entries table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        mode TEXT NOT NULL,
        audio_path TEXT,
        transcript TEXT,
        summary TEXT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create conversation_messages table for conversational mode
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
      );
    `);

    // Create settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Create smart_folders table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS smart_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        rules TEXT,
        cluster_id INTEGER,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create manual_folders table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS manual_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create folder_entries junction table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS folder_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER NOT NULL,
        entry_id INTEGER NOT NULL,
        folder_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Add name column to existing journal_entries table if it doesn't exist
    try {
      await db.execAsync(`
        ALTER TABLE journal_entries ADD COLUMN name TEXT;
      `);
      console.log('Added name column to journal_entries');
    } catch (error) {
      // Column already exists, ignore error
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error);
      }
    }

    // Migration: Add embedding column
    try {
      await db.execAsync(`
        ALTER TABLE journal_entries ADD COLUMN embedding TEXT;
      `);
      console.log('Added embedding column to journal_entries');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error);
      }
    }

    // Migration: Add topics column
    try {
      await db.execAsync(`
        ALTER TABLE journal_entries ADD COLUMN topics TEXT;
      `);
      console.log('Added topics column to journal_entries');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error);
      }
    }

    // Migration: Add cluster_id column
    try {
      await db.execAsync(`
        ALTER TABLE journal_entries ADD COLUMN cluster_id INTEGER;
      `);
      console.log('Added cluster_id column to journal_entries');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const createJournalEntry = async (mode, audioPath) => {
  const date = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO journal_entries (date, mode, audio_path) VALUES (?, ?, ?)',
    [date, mode, audioPath]
  );
  return result.lastInsertRowId;
};

export const updateJournalEntry = async (id, updates) => {
  const fields = [];
  const values = [];

  if (updates.transcript !== undefined) {
    fields.push('transcript = ?');
    values.push(updates.transcript);
  }
  if (updates.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updates.summary);
  }
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.embedding !== undefined) {
    fields.push('embedding = ?');
    values.push(updates.embedding);
  }
  if (updates.topics !== undefined) {
    fields.push('topics = ?');
    values.push(updates.topics);
  }
  if (updates.cluster_id !== undefined) {
    fields.push('cluster_id = ?');
    values.push(updates.cluster_id);
  }

  values.push(id);

  await db.runAsync(
    `UPDATE journal_entries SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const addConversationMessage = async (entryId, role, content) => {
  await db.runAsync(
    'INSERT INTO conversation_messages (entry_id, role, content) VALUES (?, ?, ?)',
    [entryId, role, content]
  );
};

export const getJournalEntries = async () => {
  const result = await db.getAllAsync(
    'SELECT * FROM journal_entries ORDER BY created_at DESC'
  );
  return result;
};

export const getJournalEntry = async (id) => {
  const entry = await db.getFirstAsync(
    'SELECT * FROM journal_entries WHERE id = ?',
    [id]
  );
  return entry;
};

export const getConversationMessages = async (entryId) => {
  const messages = await db.getAllAsync(
    'SELECT * FROM conversation_messages WHERE entry_id = ? ORDER BY timestamp ASC',
    [entryId]
  );
  return messages;
};

export const deleteJournalEntry = async (id) => {
  await db.runAsync('DELETE FROM journal_entries WHERE id = ?', [id]);
};

export const getSetting = async (key) => {
  const result = await db.getFirstAsync(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return result?.value || null;
};

export const setSetting = async (key, value) => {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
};

export const getDatabase = () => db;

// Smart Folders

export const createSmartFolder = async (name, type, rules = null, clusterId = null, color = null) => {
  const result = await db.runAsync(
    'INSERT INTO smart_folders (name, type, rules, cluster_id, color) VALUES (?, ?, ?, ?, ?)',
    [name, type, rules ? JSON.stringify(rules) : null, clusterId, color]
  );
  return result.lastInsertRowId;
};

export const updateSmartFolder = async (id, updates) => {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.rules !== undefined) {
    fields.push('rules = ?');
    values.push(JSON.stringify(updates.rules));
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }

  values.push(id);

  await db.runAsync(
    `UPDATE smart_folders SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const getSmartFolders = async () => {
  const result = await db.getAllAsync(
    'SELECT * FROM smart_folders ORDER BY created_at DESC'
  );
  return result.map(folder => ({
    ...folder,
    rules: folder.rules ? JSON.parse(folder.rules) : null,
  }));
};

export const getSmartFolder = async (id) => {
  const folder = await db.getFirstAsync(
    'SELECT * FROM smart_folders WHERE id = ?',
    [id]
  );
  if (folder && folder.rules) {
    folder.rules = JSON.parse(folder.rules);
  }
  return folder;
};

export const deleteSmartFolder = async (id) => {
  await db.runAsync('DELETE FROM smart_folders WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM folder_entries WHERE folder_id = ? AND folder_type = ?', [id, 'smart']);
};

// Manual Folders

export const createManualFolder = async (name) => {
  const result = await db.runAsync(
    'INSERT INTO manual_folders (name) VALUES (?)',
    [name]
  );
  return result.lastInsertRowId;
};

export const updateManualFolder = async (id, name) => {
  await db.runAsync(
    'UPDATE manual_folders SET name = ? WHERE id = ?',
    [name, id]
  );
};

export const getManualFolders = async () => {
  const result = await db.getAllAsync(
    'SELECT * FROM manual_folders ORDER BY created_at DESC'
  );
  return result;
};

export const deleteManualFolder = async (id) => {
  await db.runAsync('DELETE FROM manual_folders WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM folder_entries WHERE folder_id = ? AND folder_type = ?', [id, 'manual']);
};

// Folder Entries

export const addEntryToFolder = async (folderId, entryId, folderType) => {
  // Check if already exists
  const existing = await db.getFirstAsync(
    'SELECT * FROM folder_entries WHERE folder_id = ? AND entry_id = ? AND folder_type = ?',
    [folderId, entryId, folderType]
  );

  if (!existing) {
    await db.runAsync(
      'INSERT INTO folder_entries (folder_id, entry_id, folder_type) VALUES (?, ?, ?)',
      [folderId, entryId, folderType]
    );
  }
};

export const removeEntryFromFolder = async (folderId, entryId, folderType) => {
  await db.runAsync(
    'DELETE FROM folder_entries WHERE folder_id = ? AND entry_id = ? AND folder_type = ?',
    [folderId, entryId, folderType]
  );
};

export const getEntriesInFolder = async (folderId, folderType) => {
  if (folderType === 'smart') {
    // For smart folders, check if it's a cluster folder
    const folder = await getSmartFolder(folderId);
    if (folder && folder.type === 'cluster' && folder.cluster_id !== null) {
      // For cluster folders, get entries by cluster_id
      const result = await db.getAllAsync(
        'SELECT * FROM journal_entries WHERE cluster_id = ? ORDER BY created_at DESC',
        [folder.cluster_id]
      );
      return result;
    }
  }

  // For manual folders and rule-based smart folders, use junction table
  const result = await db.getAllAsync(
    `SELECT je.* FROM journal_entries je
     INNER JOIN folder_entries fe ON je.id = fe.entry_id
     WHERE fe.folder_id = ? AND fe.folder_type = ?
     ORDER BY je.created_at DESC`,
    [folderId, folderType]
  );
  return result;
};

export const getFolderEntryCount = async (folderId, folderType) => {
  if (folderType === 'smart') {
    // For smart folders, check if it's a cluster folder
    const folder = await getSmartFolder(folderId);
    if (folder && folder.type === 'cluster' && folder.cluster_id !== null) {
      // For cluster folders, count entries by cluster_id
      const result = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM journal_entries WHERE cluster_id = ?',
        [folder.cluster_id]
      );
      return result.count;
    } else if (folder && folder.type === 'rule' && folder.rules) {
      // For rule-based folders, count matching entries
      const entries = await getEntriesMatchingRules(folder.rules);
      return entries.length;
    }
  }

  // For manual folders, use junction table
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM folder_entries WHERE folder_id = ? AND folder_type = ?',
    [folderId, folderType]
  );
  return result.count;
};

// Sorting and Filtering

export const getJournalEntriesSorted = async (sortBy = 'date_desc') => {
  const orderClause = sortBy === 'date_asc'
    ? 'ORDER BY created_at ASC'
    : 'ORDER BY created_at DESC';

  const result = await db.getAllAsync(
    `SELECT * FROM journal_entries ${orderClause}`
  );
  return result;
};

export const getRecentEntries = async (days = 7) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffISO = cutoffDate.toISOString();

  const result = await db.getAllAsync(
    'SELECT * FROM journal_entries WHERE created_at >= ? ORDER BY created_at DESC',
    [cutoffISO]
  );
  return result;
};

export const getEntriesMatchingRules = async (rules) => {
  const conditions = [];
  const params = [];

  // Date range filter
  if (rules.dateRange) {
    if (rules.dateRange.type === 'last_n_days') {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - rules.dateRange.value);
      conditions.push('created_at >= ?');
      params.push(cutoffDate.toISOString());
    } else if (rules.dateRange.type === 'range') {
      conditions.push('created_at >= ? AND created_at <= ?');
      params.push(rules.dateRange.start, rules.dateRange.end);
    }
  }

  // Mode filter
  if (rules.mode) {
    conditions.push('mode = ?');
    params.push(rules.mode);
  }

  // Text contains filter
  if (rules.textContains) {
    conditions.push('(transcript LIKE ? OR summary LIKE ?)');
    const searchTerm = `%${rules.textContains}%`;
    params.push(searchTerm, searchTerm);
  }

  // Topics filter
  if (rules.topicsContain && rules.topicsContain.length > 0) {
    const topicConditions = rules.topicsContain.map(() => 'topics LIKE ?');
    conditions.push(`(${topicConditions.join(' OR ')})`);
    rules.topicsContain.forEach(topic => {
      params.push(`%${topic}%`);
    });
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.getAllAsync(
    `SELECT * FROM journal_entries ${whereClause} ORDER BY created_at DESC`,
    params
  );
  return result;
};

// Embeddings and Clustering

export const getEntriesForClustering = async () => {
  const result = await db.getAllAsync(
    'SELECT id, transcript, summary, embedding FROM journal_entries WHERE embedding IS NOT NULL'
  );
  return result.map(entry => ({
    ...entry,
    embedding: entry.embedding ? JSON.parse(entry.embedding) : null,
  }));
};

export const updateEntryClusters = async (clusterAssignments) => {
  // clusterAssignments is an array of {entryId, clusterId}
  for (const assignment of clusterAssignments) {
    await updateJournalEntry(assignment.entryId, { cluster_id: assignment.clusterId });
  }
};
