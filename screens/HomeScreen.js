import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  startRecording,
  stopRecording,
} from '../services/audioService';
import { transcribeAudio, generateSummary } from '../services/transcriptionService';
import { sendMessageToLLM } from '../services/llmService';
import {
  createJournalEntry,
  updateJournalEntry,
  addConversationMessage,
} from '../services/databaseService';
import { generateEmbedding, extractTopics } from '../services/embeddingsService';
import { shouldTriggerClustering, regenerateClusters } from '../services/clusteringService';
import { JOURNAL_MODES, RECORDING_STATES, COLORS } from '../utils/constants';
import NameEntryModal from '../components/NameEntryModal';

export default function HomeScreen({ navigation }) {
  const [mode, setMode] = useState(JOURNAL_MODES.SOLO);
  const [recordingState, setRecordingState] = useState(RECORDING_STATES.IDLE);
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [audioUri, setAudioUri] = useState(null);
  const [blinkAnim] = useState(new Animated.Value(1));
  const [currentResponse, setCurrentResponse] = useState('');
  const [buttonShapeAnim] = useState(new Animated.Value(60)); // 60 = circle, 0 = square
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState(null);

  // Swipe gesture handler
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only detect horizontal swipes
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (recordingState === RECORDING_STATES.IDLE) {
        // Swipe left to go to conversational
        if (gestureState.dx < -50 && mode === JOURNAL_MODES.SOLO) {
          setMode(JOURNAL_MODES.CONVERSATIONAL);
        }
        // Swipe right to go to solo (only if no active conversation)
        else if (gestureState.dx > 50 && mode === JOURNAL_MODES.CONVERSATIONAL && !currentEntryId) {
          setMode(JOURNAL_MODES.SOLO);
        }
      }
    },
  });

  useEffect(() => {
    if (recordingState === RECORDING_STATES.RECORDING) {
      // Start blinking animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
      // Morph to square
      Animated.timing(buttonShapeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Stop animation
      blinkAnim.setValue(1);
      // Morph back to circle
      Animated.timing(buttonShapeAnim, {
        toValue: 60,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [recordingState]);

  const handleStartRecording = async () => {
    try {
      setRecordingState(RECORDING_STATES.RECORDING);
      setStatusMessage('Recording...');
      await startRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
      setRecordingState(RECORDING_STATES.IDLE);
      setStatusMessage('');
    }
  };

  const handleStopRecording = async () => {
    try {
      setRecordingState(RECORDING_STATES.PROCESSING);
      setStatusMessage('Processing...');

      const uri = await stopRecording();
      setAudioUri(uri);

      // Create entry if this is the first recording
      let entryId = currentEntryId;
      if (!entryId) {
        entryId = await createJournalEntry(mode, uri);
        setCurrentEntryId(entryId);
      }

      // Transcribe audio
      setStatusMessage('Transcribing...');
      const transcript = await transcribeAudio(uri);

      if (mode === JOURNAL_MODES.SOLO) {
        // Solo mode: save transcript, generate summary, embedding, and topics
        await updateJournalEntry(entryId, {
          transcript,
        });

        setStatusMessage('Generating summary...');
        const summary = await generateSummary(transcript);
        await updateJournalEntry(entryId, { summary });

        // Generate embedding and topics in background (don't block UI)
        generateEmbeddingAndTopics(entryId, transcript).catch(err => {
          console.error('Background processing error:', err);
        });

        setRecordingState(RECORDING_STATES.IDLE);
        setStatusMessage('');
        setCurrentEntryId(null);
        setAudioUri(null);

        // Show name entry modal
        setPendingEntryId(entryId);
        setShowNameModal(true);
      } else {
        // Conversational mode: send to LLM
        await addConversationMessage(entryId, 'user', transcript);
        const updatedHistory = [...conversationHistory, { role: 'user', content: transcript }];
        setConversationHistory(updatedHistory);

        setRecordingState(RECORDING_STATES.WAITING_FOR_RESPONSE);
        setStatusMessage('Getting response...');
        setCurrentResponse('');

        const response = await sendMessageToLLM(transcript, conversationHistory, (_chunk, fullText) => {
          setCurrentResponse(fullText);
        });

        await addConversationMessage(entryId, 'assistant', response);
        setConversationHistory([...updatedHistory, { role: 'assistant', content: response }]);

        // Display the response (no TTS)
        setRecordingState(RECORDING_STATES.IDLE);
        setStatusMessage('');
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      Alert.alert('Error', 'Failed to process recording: ' + error.message);
      setRecordingState(RECORDING_STATES.IDLE);
      setStatusMessage('');
    }
  };

  const generateEmbeddingAndTopics = async (entryId, text) => {
    try {
      console.log('Generating embedding and topics for entry', entryId);

      // Generate embedding
      const embedding = await generateEmbedding(text);
      await updateJournalEntry(entryId, {
        embedding: JSON.stringify(embedding),
      });

      // Extract topics
      const topics = await extractTopics(text);
      await updateJournalEntry(entryId, {
        topics: JSON.stringify(topics),
      });

      console.log('Embedding and topics generated successfully');

      // Check if we should trigger clustering
      const shouldCluster = await shouldTriggerClustering();
      if (shouldCluster) {
        console.log('Triggering cluster regeneration...');
        await regenerateClusters();
      }
    } catch (error) {
      console.error('Error generating embedding/topics:', error);
      // Don't throw - this is background processing
    }
  };

  const handleFinishConversation = async () => {
    try {
      if (!currentEntryId) {
        return;
      }

      setStatusMessage('Generating summary...');
      const { generateConversationSummary } = require('../services/llmService');
      const summary = await generateConversationSummary(conversationHistory);

      // Combine all messages into a transcript
      const transcript = conversationHistory
        .map((msg) => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      await updateJournalEntry(currentEntryId, { transcript, summary });

      // Generate embedding and topics in background
      generateEmbeddingAndTopics(currentEntryId, transcript).catch(err => {
        console.error('Background processing error:', err);
      });

      const savedEntryId = currentEntryId;
      setRecordingState(RECORDING_STATES.IDLE);
      setStatusMessage('');
      setCurrentEntryId(null);
      setConversationHistory([]);
      setAudioUri(null);
      setCurrentResponse('');

      // Show name entry modal
      setPendingEntryId(savedEntryId);
      setShowNameModal(true);
    } catch (error) {
      console.error('Error finishing conversation:', error);
      Alert.alert('Error', 'Failed to save conversation: ' + error.message);
    }
  };

  const handleSaveName = async (name) => {
    if (pendingEntryId) {
      await updateJournalEntry(pendingEntryId, { name });
    }
    setShowNameModal(false);
    const entryId = pendingEntryId;
    setPendingEntryId(null);
    navigation.navigate('JournalList');
    navigation.navigate('EntryDetail', { entryId });
  };

  const handleSkipName = () => {
    setShowNameModal(false);
    const entryId = pendingEntryId;
    setPendingEntryId(null);
    navigation.navigate('JournalList');
    navigation.navigate('EntryDetail', { entryId });
  };

  const isRecording = recordingState === RECORDING_STATES.RECORDING;
  const isProcessing = recordingState === RECORDING_STATES.PROCESSING ||
                       recordingState === RECORDING_STATES.WAITING_FOR_RESPONSE;

  return (
    <View style={[styles.container, mode === JOURNAL_MODES.CONVERSATIONAL && styles.containerDark]} {...panResponder.panHandlers}>
      {/* Settings Icon */}
      <TouchableOpacity
        style={styles.settingsIcon}
        onPress={() => navigation.navigate('Settings')}
      >
        <Ionicons
          name="settings-outline"
          size={24}
          color={mode === JOURNAL_MODES.CONVERSATIONAL ? '#FFFFFF' : '#000000'}
        />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, mode === JOURNAL_MODES.CONVERSATIONAL && styles.titleDark]}>
          {mode === JOURNAL_MODES.SOLO ? 'Solo' : 'Conversational'}
        </Text>

        {/* Status Message - Fixed height to prevent layout shift */}
        <View style={styles.statusContainer}>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Animated.View
                style={[
                  styles.redDot,
                  { opacity: blinkAnim },
                ]}
              />
              <Text style={[styles.statusText, mode === JOURNAL_MODES.CONVERSATIONAL && styles.statusTextDark]}>Recording</Text>
            </View>
          )}
          {statusMessage && !isRecording && (
            <Text style={[styles.statusText, mode === JOURNAL_MODES.CONVERSATIONAL && styles.statusTextDark]}>{statusMessage}</Text>
          )}
        </View>

        {/* Current Response Display */}
        {currentResponse && (
          <View style={[styles.responseContainer, mode === JOURNAL_MODES.CONVERSATIONAL && styles.responseContainerDark]}>
            <Text style={[styles.responseText, mode === JOURNAL_MODES.CONVERSATIONAL && styles.responseTextDark]}>{currentResponse}</Text>
          </View>
        )}

        {/* Recording Button */}
        <View style={styles.recordingContainer}>
          <TouchableOpacity
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isProcessing}
          >
            <Animated.View
              style={[
                styles.recordButton,
                { borderRadius: buttonShapeAnim },
                mode === JOURNAL_MODES.CONVERSATIONAL && styles.recordButtonDark,
                isRecording && styles.recordButtonActive,
                mode === JOURNAL_MODES.CONVERSATIONAL && isRecording && styles.recordButtonActiveDark,
              ]}
            >
              <Text style={[styles.recordButtonText, mode === JOURNAL_MODES.CONVERSATIONAL && styles.recordButtonTextDark]}>
                {isRecording ? 'Stop' : 'Record'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Conversational Mode Controls */}
        {mode === JOURNAL_MODES.CONVERSATIONAL && currentEntryId && !isProcessing && (
          <TouchableOpacity
            style={[styles.finishButton, mode === JOURNAL_MODES.CONVERSATIONAL && styles.finishButtonDark]}
            onPress={handleFinishConversation}
          >
            <Text style={[styles.finishButtonText, mode === JOURNAL_MODES.CONVERSATIONAL && styles.finishButtonTextDark]}>Finish & Save</Text>
          </TouchableOpacity>
        )}

        {/* Subtle Entries Button */}
        <View style={styles.entriesButtonContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('JournalList')}
            style={[
              styles.entriesButton,
              mode === JOURNAL_MODES.CONVERSATIONAL && styles.entriesButtonDark
            ]}
          >
            <Text style={[styles.entriesButtonText, mode === JOURNAL_MODES.CONVERSATIONAL && styles.entriesButtonTextDark]}>
              ···
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <NameEntryModal
        visible={showNameModal}
        onSave={handleSaveName}
        onSkip={handleSkipName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  settingsIcon: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 40,
    paddingTop: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 60,
    color: COLORS.text,
    letterSpacing: 2,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  statusContainer: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  statusTextDark: {
    color: '#FFFFFF',
  },
  responseContainer: {
    backgroundColor: COLORS.card,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 60,
  },
  responseContainerDark: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
  },
  responseText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '300',
    lineHeight: 24,
  },
  responseTextDark: {
    color: '#FFFFFF',
  },
  recordingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  recordButton: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recordButtonDark: {
    borderColor: '#FFFFFF',
  },
  recordButtonActive: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
  },
  recordButtonActiveDark: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
  },
  recordButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 2,
  },
  recordButtonTextDark: {
    color: '#FFFFFF',
  },
  finishButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  finishButtonDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  finishButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  finishButtonTextDark: {
    color: '#000000',
  },
  entriesButtonContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  entriesButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  entriesButtonDark: {
  },
  entriesButtonText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '300',
    letterSpacing: 3,
  },
  entriesButtonTextDark: {
    color: '#FFFFFF',
  },
});
