import axios from 'axios';
import * as Speech from 'expo-speech';
import { getSetting } from './databaseService';

export const sendMessageToLLM = async (message, conversationHistory = [], onChunk) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const messages = [
      {
        role: 'system',
        content: 'You are a straightforward conversation partner for journaling. Help the user think through their ideas by asking clarifying questions and offering direct observations. Be curious and engaged, but casual and natural - like talking to a friend who asks good questions. Keep responses concise (2-3 sentences).',
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message,
      },
    ];

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 200,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const fullResponse = response.data.choices[0].message.content;

    // Simulate streaming by chunking the response word by word
    if (onChunk) {
      const words = fullResponse.split(' ');
      let accumulated = '';

      for (let i = 0; i < words.length; i++) {
        const word = i === 0 ? words[i] : ' ' + words[i];
        accumulated += word;
        onChunk(word, accumulated);
        // Add a small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('LLM error:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    throw error;
  }
};

export const speakText = async (text, onDone) => {
  try {
    Speech.speak(text, {
      onDone: onDone,
      onError: (error) => {
        console.error('Speech error:', error);
      },
    });
  } catch (error) {
    console.error('Failed to speak text:', error);
    throw error;
  }
};

export const stopSpeaking = () => {
  Speech.stop();
};

export const isSpeaking = async () => {
  return await Speech.isSpeakingAsync();
};

export const generateConversationSummary = async (conversationHistory) => {
  try {
    const apiKey = await getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Format conversation history
    const formattedConversation = conversationHistory
      .map((msg) => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Summarize the journal conversation directly and naturally. Start immediately with the main topics or themes discussed. Do not use meta-phrases like "the conversation covers", "the user discusses", "this conversation", or "the entry explores". Focus on main topics, key thoughts, insights, and any realizations or action items. Write objectively. Keep it under 250 words.',
          },
          {
            role: 'user',
            content: `Summarize:\n\n${formattedConversation}`,
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
    console.error('Conversation summary error:', error);
    throw error;
  }
};
