# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Start the Expo development server:
```bash
npm start
```

Run on specific platforms:
```bash
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

## Project Overview

This is a React Native voice journaling app built with Expo. It provides two journaling modes and smart organization:
- **Solo Mode**: Record voice journals that are automatically transcribed and summarized
- **Conversational Mode**: Have interactive conversations with an AI journaling companion
- **Smart Folders**: AI-powered automatic organization via embeddings and clustering

## Architecture

### Journaling Modes

The app operates in two distinct modes (defined in `utils/constants.js`):

1. **Solo Mode** (`JOURNAL_MODES.SOLO`):
   - User records audio → stops recording
   - Audio is transcribed via OpenAI Whisper API
   - Transcript is summarized via GPT-4o-mini
   - Entry is saved with transcript + summary
   - User can optionally name the entry

2. **Conversational Mode** (`JOURNAL_MODES.CONVERSATIONAL`):
   - User records audio → stops recording → audio transcribed
   - Transcript sent to GPT-4o-mini as conversational message
   - AI responds with follow-up questions/observations
   - Conversation continues (user can record multiple times)
   - User clicks "Finish & Save" to end the conversation
   - Full conversation history is summarized
   - Entry is saved with complete transcript + summary

Users swipe left/right on the HomeScreen to switch between modes.

### Database Schema

SQLite database with six tables (`services/databaseService.js`):

**journal_entries**:
- Stores both solo entries and conversation sessions
- `mode` field distinguishes between SOLO and CONVERSATIONAL
- `transcript` contains full text (or formatted conversation history)
- `summary` contains AI-generated summary
- `audio_path` points to the .m4a file
- `name` is optional user-provided name
- `embedding` stores JSON array of 1536 floats from OpenAI embeddings
- `topics` stores JSON array of extracted topics/keywords
- `cluster_id` links entry to auto-generated cluster folders

**conversation_messages**:
- Stores individual messages for conversational mode
- Linked to `journal_entries` via `entry_id` foreign key
- Each message has `role` (user/assistant) and `content`
- Used to rebuild conversation history and display in EntryDetailScreen

**smart_folders**:
- Stores both rule-based and cluster-based smart folders
- `type` field: 'rule' or 'cluster'
- `rules` contains JSON filter conditions for rule-based folders
- `cluster_id` links to entries with matching cluster_id (for cluster folders)
- `name` is user-editable (especially for cluster folders)

**manual_folders**:
- User-created folders for manual organization
- Simple name and creation date

**folder_entries**:
- Junction table linking folders to entries
- `folder_type` distinguishes 'smart' vs 'manual'
- Used for manual folders and rule-based smart folders (not cluster folders)

**settings**:
- Key-value store for app settings
- Stores OpenAI API key, clustering preferences, sort preferences

### Service Layer

Six core services handle app functionality:

1. **audioService.js**: Audio recording/playback using expo-av
   - Records to .m4a format
   - Saves recordings to FileSystem.documentDirectory
   - Handles audio playback with status tracking

2. **databaseService.js**: SQLite operations using expo-sqlite
   - Database initialization and migrations
   - CRUD operations for entries, messages, folders
   - Smart folder queries with rule matching
   - Sorting and filtering functions
   - Settings management

3. **transcriptionService.js**: OpenAI Whisper API integration
   - Transcribes audio files to text
   - Also contains `generateSummary()` for solo mode summaries

4. **llmService.js**: OpenAI GPT-4o-mini integration
   - `sendMessageToLLM()`: Handles conversational mode chat
   - `generateConversationSummary()`: Creates summaries of full conversations
   - `speakText()`: Text-to-speech using expo-speech (currently unused in UI)

5. **embeddingsService.js**: Embeddings and clustering
   - `generateEmbedding()`: Calls OpenAI embeddings API (text-embedding-3-small)
   - `clusterEmbeddings()`: K-means clustering algorithm
   - `cosineSimilarity()`: Vector similarity calculation
   - `extractTopics()`: LLM-based topic extraction
   - `labelCluster()`: Generates human-readable labels for clusters

6. **clusteringService.js**: Automatic clustering management
   - `regenerateClusters()`: Runs clustering and creates cluster folders
   - `shouldTriggerClustering()`: Checks if re-clustering is needed
   - Manages cluster folder lifecycle

### Navigation Structure

Stack navigator with five screens (`navigation/AppNavigator.js`):

1. **HomeScreen**: Main recording interface, mode switcher
2. **JournalListScreen**: Tabbed library view (All/Recents/Smart Folders/Manual Folders)
3. **FolderDetailScreen**: Shows entries within a specific folder
4. **EntryDetailScreen**: View individual entry with transcript/conversation
5. **SettingsScreen**: Configure OpenAI API key

### Data Flow

**Solo Mode Flow**:
1. User records → `audioService.startRecording()`
2. User stops → `audioService.stopRecording()` returns audio URI
3. Create entry → `databaseService.createJournalEntry(SOLO, uri)`
4. Transcribe → `transcriptionService.transcribeAudio(uri)`
5. Generate summary → `transcriptionService.generateSummary(transcript)`
6. Update entry → `databaseService.updateJournalEntry(id, {transcript, summary})`
7. **Background**: Generate embedding → `embeddingsService.generateEmbedding(transcript)`
8. **Background**: Extract topics → `embeddingsService.extractTopics(transcript)`
9. **Background**: Check clustering trigger → `clusteringService.shouldTriggerClustering()`
10. **Background**: If threshold met → `clusteringService.regenerateClusters()`
11. Optional: Add name → `databaseService.updateJournalEntry(id, {name})`

**Conversational Mode Flow**:
1. User records first message → creates entry with `createJournalEntry(CONVERSATIONAL, uri)`
2. For each user message:
   - Transcribe audio
   - Save message → `addConversationMessage(entryId, 'user', transcript)`
   - Get AI response → `llmService.sendMessageToLLM(transcript, conversationHistory)`
   - Save response → `addConversationMessage(entryId, 'assistant', response)`
   - Update conversationHistory state
3. User clicks "Finish & Save":
   - Generate summary → `llmService.generateConversationSummary(conversationHistory)`
   - Format full transcript from conversation history
   - Update entry → `updateJournalEntry(id, {transcript, summary})`
   - **Background**: Generate embedding, topics, and trigger clustering (same as solo mode)

### OpenAI API Configuration

All API calls require an OpenAI API key stored in the settings table:
- Key setting: `SETTINGS_KEYS.OPENAI_API_KEY`
- Services retrieve the key via `getSetting('openai_api_key')`
- Uses Whisper-1 model for transcription
- Uses GPT-4o-mini model for summaries and conversations

### UI/Styling

Minimalist design with monochrome palette defined in `utils/constants.js`:
- Black and white primary colors
- Conversational mode inverts to dark theme (black background, white text)
- Animated recording button (circle → square morphing animation)
- Custom modal for naming entries (`components/NameEntryModal.js`)
- Tabbed interface in JournalListScreen with clean tab bar

## Smart Folders System

### Overview

Smart Folders automatically organize journal entries using AI. Two types exist:

1. **Cluster Folders** (Auto-generated):
   - System clusters entries by semantic similarity using embeddings
   - Creates 5-10 topic-based folders automatically
   - Labels generated by LLM (e.g., "Career & Growth", "Relationships")
   - Updates automatically as new entries arrive

2. **Rule-based Folders** (User-defined):
   - Filter entries by metadata (mode, date, text contains, topics)
   - Dynamically populate based on rules
   - Example: "Last 30 days AND mode=solo AND topics contain 'work'"

### Clustering Process

1. **Entry Creation**: After transcription and summary, background process:
   - Generates embedding (1536-dimensional vector via OpenAI)
   - Extracts 3-5 key topics via LLM
   - Stores both in journal_entries table

2. **Trigger Check**: After each entry with embedding:
   - `shouldTriggerClustering()` checks if threshold met (default: 10 new entries)
   - Initial clustering requires minimum 5 entries

3. **Regeneration**: When triggered:
   - Fetches all entries with embeddings
   - Runs k-means clustering (k=5-10 based on settings)
   - Groups entries by cluster_id
   - Deletes old cluster folders
   - For each cluster:
     - Samples 3 representative entries
     - Generates label via LLM
     - Creates smart_folder with type='cluster'
   - Updates all entries with new cluster_id assignments

4. **Folder Display**:
   - Cluster folders appear in "Smart" tab of JournalListScreen
   - Show entry count and "Auto" badge
   - Tapping folder → FolderDetailScreen shows entries
   - Cluster names are user-editable

### Rule-Based Folder Queries

Folders with `type='rule'` store filter conditions in `rules` JSON field:

```javascript
{
  dateRange: { type: 'last_n_days', value: 30 },
  mode: 'solo',
  textContains: 'work',
  topicsContain: ['career', 'productivity']
}
```

`getEntriesMatchingRules()` builds dynamic SQL query:
- Date filters: last_n_days, date range, before/after
- Mode filter: solo/conversational
- Text search: LIKE queries on transcript/summary
- Topic matching: JSON field contains checks

### Folder Types in UI

**JournalListScreen Tabs**:
- **All**: All entries, chronologically sorted (newest/oldest toggle)
- **Recents**: Entries from last 7 days
- **Smart**: Lists all smart folders (cluster + rule-based)
- **Manual**: Lists manual folders (future: user-created collections)

**FolderDetailScreen**:
- Shows entries for selected folder
- For cluster folders: queries `WHERE cluster_id = ?`
- For rule folders: runs `getEntriesMatchingRules()` dynamically
- For manual folders: joins via folder_entries table
- Cluster folders show "Rename" button

### Performance Considerations

- **Embeddings**: Generated async after UI interaction completes
- **Clustering**: Runs in background, doesn't block user
- **Storage**: ~6KB per entry for embeddings (acceptable for SQLite)
- **API Costs**:
  - Embeddings: ~$0.00002 per entry (text-embedding-3-small)
  - Topic extraction: ~$0.0001 per entry (gpt-4o-mini)
  - Cluster labeling: ~$0.0001 per cluster

### Extending Smart Folders

To add new rule types:
1. Update `getEntriesMatchingRules()` in databaseService.js
2. Add condition handling to SQL builder
3. Update rule editor UI (future feature)
