import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  getJournalEntry,
  getConversationMessages,
  deleteJournalEntry,
} from '../services/databaseService';
import { playAudio, stopAudio, deleteAudioFile } from '../services/audioService';
import { COLORS, JOURNAL_MODES } from '../utils/constants';

export default function EntryDetailScreen({ route, navigation }) {
  const { entryId } = route.params;
  const [entry, setEntry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntry();

    return () => {
      stopAudio();
    };
  }, [entryId]);

  const loadEntry = async () => {
    try {
      const entryData = await getJournalEntry(entryId);
      setEntry(entryData);

      if (entryData.mode === JOURNAL_MODES.CONVERSATIONAL) {
        const messagesData = await getConversationMessages(entryId);
        setMessages(messagesData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading entry:', error);
      Alert.alert('Error', 'Failed to load entry');
      setLoading(false);
    }
  };

  const handlePlayAudio = async () => {
    try {
      if (isPlaying) {
        await stopAudio();
        setIsPlaying(false);
      } else {
        if (entry.audio_path) {
          await playAudio(entry.audio_path);
          setIsPlaying(true);

          // Auto-stop when done
          setTimeout(async () => {
            setIsPlaying(false);
          }, 1000); // This is a simple implementation, ideally you'd use proper callbacks
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
      setIsPlaying(false);
    }
  };

  const handleDeleteEntry = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (entry.audio_path) {
                await deleteAudioFile(entry.audio_path);
              }
              await deleteJournalEntry(entry.id);
              navigation.navigate('JournalList');
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Entry not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Entry Name */}
        {entry.name && (
          <View style={styles.nameContainer}>
            <Text style={styles.entryName}>{entry.name}</Text>
          </View>
        )}

        {/* Date and Mode */}
        <View style={styles.metaContainer}>
          <Text style={styles.date}>{formatDate(entry.date)}</Text>
          <View
            style={[
              styles.modeBadge,
              entry.mode === JOURNAL_MODES.CONVERSATIONAL &&
                styles.modeBadgeConversational,
            ]}
          >
            <Text style={styles.modeBadgeText}>
              {entry.mode === JOURNAL_MODES.SOLO ? 'Solo' : 'Conversational'}
            </Text>
          </View>
        </View>

        {/* Audio Player */}
        {entry.audio_path && (
          <TouchableOpacity
            style={styles.audioButton}
            onPress={handlePlayAudio}
          >
            <Text style={styles.audioButtonText}>
              {isPlaying ? '⏸ Pause Audio' : '▶ Play Audio'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Summary */}
        {entry.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>{entry.summary}</Text>
            </View>
          </View>
        )}

        {/* Full Transcript */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {entry.mode === JOURNAL_MODES.CONVERSATIONAL
              ? 'Conversation'
              : 'Transcript'}
          </Text>
          <View style={styles.transcriptCard}>
            {entry.mode === JOURNAL_MODES.CONVERSATIONAL && messages.length > 0 ? (
              messages.map((msg, index) => (
                <View
                  key={index}
                  style={[
                    styles.messageContainer,
                    msg.role === 'user'
                      ? styles.userMessage
                      : styles.assistantMessage,
                  ]}
                >
                  <Text style={styles.messageRole}>
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </Text>
                  <Text style={styles.messageContent}>{msg.content}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.transcriptText}>
                {entry.transcript || 'No transcript available'}
              </Text>
            )}
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteEntry}
        >
          <Text style={styles.deleteButtonText}>Delete Entry</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 40,
    paddingBottom: 25,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    paddingTop: 30,
    paddingBottom: 60,
  },
  nameContainer: {
    marginBottom: 20,
  },
  entryName: {
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  date: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    flex: 1,
    letterSpacing: 1,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBadgeConversational: {
    backgroundColor: COLORS.primary,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  audioButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  audioButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginBottom: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  summaryCard: {
    backgroundColor: COLORS.background,
    padding: 0,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 24,
    color: COLORS.text,
    fontWeight: '300',
  },
  transcriptCard: {
    backgroundColor: COLORS.background,
    padding: 0,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 24,
    color: COLORS.text,
    fontWeight: '300',
  },
  messageContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  messageRole: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 8,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  userMessage: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    paddingLeft: 15,
  },
  assistantMessage: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
    paddingLeft: 15,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 24,
    color: COLORS.text,
    fontWeight: '300',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 100,
    fontWeight: '300',
  },
  deleteButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 1,
  },
});
