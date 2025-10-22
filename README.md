# LLM Journal

A voice-first journaling app with AI-powered transcription, conversation, and automatic organization.

## Overview

LLM Journal is a React Native mobile application that lets you create journal entries through voice recording. It offers two journaling modes and uses AI to transcribe, summarize, and automatically organize your entries into smart folders.

## Features

### Journaling Modes

- **Solo Mode**: Record voice journals that are automatically transcribed and summarized
- **Conversational Mode**: Have interactive conversations with an AI journaling companion that asks follow-up questions

### Smart Organization

- **Automatic Clustering**: AI analyzes your entries and groups them into 5-10 topic-based folders using semantic similarity
- **Rule-Based Folders**: Create custom folders with filters for date ranges, keywords, and topics
- **Manual Folders**: Traditional folder organization for manual categorization

### AI Capabilities

- Voice-to-text transcription via OpenAI Whisper
- Automatic summarization of journal entries
- Interactive AI conversations for deeper reflection
- Topic extraction and semantic embeddings
- K-means clustering for automatic organization

## Technologies

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tooling
- **React Navigation** - Navigation library

### Backend & Storage
- **SQLite** (expo-sqlite) - Local database
- **Expo FileSystem** - Audio file management
- **Expo AV** - Audio recording and playback

### AI & Machine Learning
- **OpenAI Whisper API** - Speech-to-text transcription
- **OpenAI GPT-4o-mini** - Summarization and conversational AI
- **OpenAI Embeddings API** (text-embedding-3-small) - Semantic vector generation
- **K-means clustering** - Automatic topic grouping

### Other Libraries
- **Axios** - HTTP client for API requests
- **Expo Speech** - Text-to-speech capabilities

## Getting Started

### Prerequisites

- Node.js and npm installed
- Expo CLI (`npm install -g expo-cli`)
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Run on your preferred platform:
   ```bash
   npm run ios      # iOS simulator
   npm run android  # Android emulator
   npm run web      # Web browser
   ```

### Configuration

1. Launch the app and navigate to Settings
2. Enter your OpenAI API key
3. Configure clustering preferences (optional)

## Project Structure

```
llm-journal/
├── services/           # Core business logic
│   ├── audioService.js         # Recording and playback
│   ├── databaseService.js      # SQLite operations
│   ├── transcriptionService.js # Whisper API integration
│   ├── llmService.js           # GPT-4o-mini chat and summaries
│   ├── embeddingsService.js    # Embeddings and clustering
│   └── clusteringService.js    # Automatic folder management
├── screens/            # UI screens
│   ├── HomeScreen.js           # Main recording interface
│   ├── JournalListScreen.js    # Entry library
│   ├── EntryDetailScreen.js    # Entry viewer
│   ├── FolderDetailScreen.js   # Folder contents
│   └── SettingsScreen.js       # Configuration
├── components/         # Reusable UI components
├── navigation/         # Navigation configuration
└── utils/              # Constants and helpers
```

## Database Schema

- **journal_entries**: Stores entries with transcripts, summaries, and embeddings
- **conversation_messages**: Individual messages for conversational mode
- **smart_folders**: Auto-generated and rule-based folders
- **manual_folders**: User-created folders
- **folder_entries**: Junction table for manual folder organization
- **settings**: App configuration and API keys

## How It Works

### Solo Mode Flow
1. Record audio
2. Transcribe via Whisper API
3. Generate summary via GPT-4o-mini
4. Extract topics and generate embedding
5. Check if re-clustering is needed
6. Automatically organize into smart folders

### Conversational Mode Flow
1. Record first message
2. Transcribe and send to GPT-4o-mini
3. AI responds with questions or observations
4. Continue conversation with multiple recordings
5. Generate final summary of entire conversation
6. Process embedding and clustering

### Smart Folders
- Entries are automatically clustered based on semantic similarity
- Clustering runs after every 10 new entries
- LLM generates human-readable labels for each cluster
- Folders update automatically as new entries arrive

## License

Private project
