import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getSetting, setSetting } from '../services/databaseService';
import { COLORS, SETTINGS_KEYS } from '../utils/constants';
import { backfillEmbeddings, checkEmbeddingStatus } from '../scripts/backfillEmbeddings';

export default function SettingsScreen({ navigation }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const key = await getSetting(SETTINGS_KEYS.OPENAI_API_KEY);
      if (key) {
        setApiKey(key);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      Alert.alert(
        'Warning',
        'OpenAI API keys typically start with "sk-". Are you sure this is correct?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: () => saveSettings() },
        ]
      );
      return;
    }

    await saveSettings();
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await setSetting(SETTINGS_KEYS.OPENAI_API_KEY, apiKey.trim());
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleClearApiKey = () => {
    Alert.alert('Clear API Key', 'Are you sure you want to clear your API key?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setApiKey('');
          await setSetting(SETTINGS_KEYS.OPENAI_API_KEY, '');
        },
      },
    ]);
  };

  const handleGenerateEmbeddings = async () => {
    try {
      // First check status
      const status = await checkEmbeddingStatus();

      if (status.withoutEmbeddings === 0) {
        Alert.alert('Up to Date', 'All entries already have embeddings and are clustered!');
        return;
      }

      Alert.alert(
        'Generate Smart Folders',
        `Found ${status.withoutEmbeddings} entries without embeddings. This will:\n\n• Generate embeddings for all entries\n• Extract topics\n• Create cluster folders\n\nThis may take a few minutes.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start',
            onPress: async () => {
              setBackfilling(true);
              setBackfillProgress('Starting...');

              try {
                await backfillEmbeddings((message, progress) => {
                  setBackfillProgress(`${message} (${progress}%)`);
                });

                setBackfillProgress('');
                setBackfilling(false);
                Alert.alert('Success', 'Smart folders generated! Check the Smart tab in your journal list.');
              } catch (error) {
                console.error('Backfill error:', error);
                setBackfillProgress('');
                setBackfilling(false);
                Alert.alert('Error', 'Failed to generate embeddings: ' + error.message);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error checking status:', error);
      Alert.alert('Error', 'Failed to check embedding status');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* API Key Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OpenAI API Key</Text>
          <Text style={styles.sectionDescription}>
            Enter your OpenAI API key to enable transcription and LLM features.
            Your key is stored locally on your device.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="sk-..."
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save API Key'}
              </Text>
            </TouchableOpacity>

            {apiKey ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearApiKey}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Smart Folders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Folders</Text>
          <Text style={styles.sectionDescription}>
            Generate AI-powered topic folders for your entries. This analyzes all your journal entries and automatically organizes them by theme.
          </Text>

          {backfilling && backfillProgress ? (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{backfillProgress}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveButton, backfilling && styles.saveButtonDisabled]}
            onPress={handleGenerateEmbeddings}
            disabled={backfilling}
          >
            <Text style={styles.saveButtonText}>
              {backfilling ? 'Processing...' : 'Generate Smart Folders'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How to get an API key:</Text>
          <Text style={styles.infoText}>
            1. Visit platform.openai.com{'\n'}
            2. Sign up or log in to your account{'\n'}
            3. Navigate to API Keys section{'\n'}
            4. Create a new API key{'\n'}
            5. Copy and paste it here
          </Text>

          <Text style={[styles.infoTitle, { marginTop: 20 }]}>
            Features:
          </Text>
          <Text style={styles.infoText}>
            • Solo Mode: Record voice journals that are automatically transcribed
            and summarized{'\n'}
            • Conversational Mode: Have back-and-forth conversations with an AI
            journaling companion{'\n'}
            • Smart Folders: AI automatically organizes entries by topic{'\n'}
            • Audio Playback: Listen to your original recordings{'\n'}
            • History: Browse and search all your past entries
          </Text>
        </View>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>LLM Journal v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 40,
    paddingBottom: 30,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: COLORS.text,
    marginBottom: 20,
    letterSpacing: 2,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 40,
    paddingBottom: 60,
  },
  section: {
    marginBottom: 50,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginBottom: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: '300',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 15,
    fontWeight: '400',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  clearButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 1,
  },
  infoSection: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 22,
    fontWeight: '300',
  },
  progressContainer: {
    padding: 15,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  progressText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '300',
    textAlign: 'center',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  versionText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '300',
    letterSpacing: 1,
  },
});
