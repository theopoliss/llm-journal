import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { getSetting } from './databaseService';

export const transcribeAudio = async (audioUri) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Read the audio file
    const audioFile = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Get file info for the filename
    const fileName = audioUri.split('/').pop();

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
      }
    );

    return response.data.text;
  } catch (error) {
    console.error('Transcription error:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
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
            content: 'You are a helpful assistant that creates concise, meaningful summaries of journal entries. Focus on main themes, emotions, and key insights. Keep summaries under 200 words.',
          },
          {
            role: 'user',
            content: `Please summarize this journal entry:\n\n${transcript}`,
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
