import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { getSetting } from './databaseService';
import { needsChunking, splitAudioIntoChunks, cleanupChunks } from './audioChunkingService';

// Maximum file size in MB before chunking is required
const MAX_FILE_SIZE_MB = 20;

/**
 * Transcribe a single audio file (must be under 25MB)
 * @param {string} audioUri - Audio file URI
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Transcription text
 */
const transcribeSingleFile = async (audioUri, apiKey) => {
  const fileName = audioUri.split('/').pop();
  const fileInfo = await FileSystem.getInfoAsync(audioUri);

  if (!fileInfo.exists) {
    throw new Error('Audio file not found');
  }

  const fileSizeMB = fileInfo.size / (1024 * 1024);
  console.log(`Transcribing ${fileName} (${fileSizeMB.toFixed(1)}MB)...`);

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: fileName,
    type: 'audio/m4a',
  });
  formData.append('model', 'whisper-1');

  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    formData,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minute timeout
    }
  );

  return response.data.text;
};

/**
 * Transcribe audio with automatic chunking for large files
 * Files over 20MB are split into 10-minute chunks, transcribed separately,
 * and the results are concatenated.
 * @param {string} audioUri - Audio file URI
 * @returns {Promise<string>} Full transcription text
 */
export const transcribeAudio = async (audioUri) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    const fileSizeMB = fileInfo.size / (1024 * 1024);

    // Check if file needs chunking
    if (fileSizeMB <= MAX_FILE_SIZE_MB) {
      // File is small enough - transcribe directly
      return await transcribeSingleFile(audioUri, apiKey);
    }

    // File is too large - split into chunks
    console.log(`File size ${fileSizeMB.toFixed(1)}MB exceeds ${MAX_FILE_SIZE_MB}MB limit, splitting into chunks...`);

    let chunkUris = [];
    try {
      chunkUris = await splitAudioIntoChunks(audioUri);
      console.log(`Split audio into ${chunkUris.length} chunks`);

      // Transcribe each chunk sequentially
      const transcriptions = [];
      for (let i = 0; i < chunkUris.length; i++) {
        console.log(`Transcribing chunk ${i + 1}/${chunkUris.length}...`);
        const chunkTranscript = await transcribeSingleFile(chunkUris[i], apiKey);
        transcriptions.push(chunkTranscript);
      }

      // Concatenate transcriptions with proper spacing
      const fullTranscript = transcriptions.join(' ');
      console.log('Successfully transcribed all chunks');

      return fullTranscript;
    } finally {
      // Clean up chunk files
      if (chunkUris.length > 0) {
        await cleanupChunks(chunkUris, audioUri);
      }
    }
  } catch (error) {
    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Transcription timed out. The recording may be too long.');
    }

    // Handle file size error from API
    if (error.response?.status === 413) {
      throw new Error('Audio file too large for transcription.');
    }

    // Handle other API errors
    if (error.response?.data?.error?.message) {
      throw new Error(`Transcription failed: ${error.response.data.error.message}`);
    }

    console.error('Transcription error:', error);
    throw error;
  }
};

export const generateSummary = async (transcript) => {
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
            content: 'Create a concise summary of the journal entry. Write in a direct, natural style starting immediately with the main theme or content. Do not use meta-phrases like "this entry", "the user", "this journal", or "the author". Focus on main themes, emotions, and key insights. Keep summaries under 200 words.',
          },
          {
            role: 'user',
            content: `Summarize:\n\n${transcript}`,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Summary generation error:', error);
    throw error;
  }
};
