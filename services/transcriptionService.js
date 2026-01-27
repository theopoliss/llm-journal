import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { getSetting } from './databaseService';

// OpenAI Whisper API has a 25MB limit, but we set a lower threshold to be safe
const MAX_FILE_SIZE_MB = 20;

export const transcribeAudio = async (audioUri) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Get file info
    const fileName = audioUri.split('/').pop();
    const fileInfo = await FileSystem.getInfoAsync(audioUri);

    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    // Check file size
    const fileSizeMB = fileInfo.size / (1024 * 1024);

    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      const durationEstimate = Math.round((fileSizeMB / 1.4) / 60); // Rough estimate: ~1.4MB per minute
      throw new Error(
        `Recording is too long (${fileSizeMB.toFixed(1)}MB, ~${durationEstimate} minutes). ` +
        `Please keep recordings under 20 minutes for now.`
      );
    }

    console.log(`Transcribing ${fileName} (${fileSizeMB.toFixed(1)}MB)...`);

    // Create form data
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
  } catch (error) {
    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Transcription timed out. The recording may be too long.');
    }

    // Handle file size error from API
    if (error.response?.status === 413) {
      throw new Error('Recording too large. Please keep recordings under 20 minutes.');
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
