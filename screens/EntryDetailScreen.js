import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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
  updateJournalEntry,
  getManualFolders,
  getFoldersForEntry,
  addEntryToFolder,
  removeEntryFromFolder,
  createManualFolder,
} from '../services/databaseService';
import FolderPickerModal from '../components/FolderPickerModal';
import { stopAudio, deleteAudioFile } from '../services/audioService';
import { COLORS, JOURNAL_MODES } from '../utils/constants'
import AudioPlayer from '../components/AudioPlayer';

export default function EntryDetailScreen({ route, navigation }) {
  const { entryId } = route.params;
  const [entry, setEntry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [manualFolders, setManualFolders] = useState([]);
  const [entryFolderIds, setEntryFolderIds] = useState([]);

  useEffect(() => {
    loadEntry();

    return () => {
      stopAudio();
    };
  }, [entryId]);

  // Auto-refresh while entry is processing
  useEffect(() => {
    if (entry && !entry.summary) {
      const timer = setTimeout(() => {
        loadEntry();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [entry]);

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
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const handleStartEditingName = () => {
    setEditingName(entry.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    try {
      const trimmedName = editingName.trim();
      await updateJournalEntry(entryId, { name: trimmedName || null });
      setIsEditingName(false);
      loadEntry();
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const handleCancelEditingName = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  const handleOpenFolderPicker = async () => {
    try {
      const [folders, folderIds] = await Promise.all([
        getManualFolders(),
        getFoldersForEntry(entryId),
      ]);
      setManualFolders(folders);
      setEntryFolderIds(folderIds);
      setFolderPickerVisible(true);
    } catch (error) {
      console.error('Error loading folders:', error);
      Alert.alert('Error', 'Failed to load folders');
    }
  };

  const handleToggleFolder = async (folderId) => {
    try {
      if (entryFolderIds.includes(folderId)) {
        await removeEntryFromFolder(folderId, entryId, 'manual');
        setEntryFolderIds(entryFolderIds.filter(id => id !== folderId));
      } else {
        await addEntryToFolder(folderId, entryId, 'manual');
        setEntryFolderIds([...entryFolderIds, folderId]);
      }
    } catch (error) {
      console.error('Error toggling folder:', error);
      Alert.alert('Error', 'Failed to update folder');
    }
  };

  const handleCreateFolderFromPicker = async (name) => {
    try {
      await createManualFolder(name);
      const folders = await getManualFolders();
      setManualFolders(folders);
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder');
    }
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

  // Entry is still processing
  if (!entry.summary) {
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
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.processingText}>Transcribing and summarizing...</Text>
          <Text style={styles.processingHint}>This usually takes 10-20 seconds</Text>
        </View>
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleOpenFolderPicker}
          >
            <Text style={styles.headerActionText}>folder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleDeleteEntry}
          >
            <Text style={styles.headerActionText}>delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Entry Name */}
        <View style={styles.nameContainer}>
          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                style={styles.nameInput}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="Enter a name"
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
              />
              <View style={styles.nameEditActions}>
                <TouchableOpacity onPress={handleCancelEditingName}>
                  <Text style={styles.nameEditCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveName}>
                  <Text style={styles.nameEditSave}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.nameDisplayContainer}>
              <Text style={styles.entryName}>
                {entry.name || 'Untitled Entry'}
              </Text>
              <TouchableOpacity
                style={styles.editNameButton}
                onPress={handleStartEditingName}
              >
                <Text style={styles.editNameIcon}>edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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
        {entry.mode === JOURNAL_MODES.SOLO ? (
          // Solo mode: single audio player
          entry.audio_path && <AudioPlayer audioUri={entry.audio_path} />
        ) : (
          // Conversational mode: player with message selector
          (() => {
            const userMessagesWithAudio = messages.filter(
              (msg) => msg.role === 'user' && msg.audio_path
            );
            if (userMessagesWithAudio.length === 0) return null;

            const selectedAudio = userMessagesWithAudio[selectedAudioIndex];
            return (
              <View style={styles.audioSection}>
                <AudioPlayer
                  key={selectedAudio?.audio_path}
                  audioUri={selectedAudio?.audio_path}
                />
                {userMessagesWithAudio.length > 1 && (
                  <View style={styles.audioSelector}>
                    <TouchableOpacity
                      style={[
                        styles.audioNavButton,
                        selectedAudioIndex === 0 && styles.audioNavButtonDisabled,
                      ]}
                      onPress={() => {
                        if (selectedAudioIndex > 0) {
                          stopAudio();
                          setSelectedAudioIndex(selectedAudioIndex - 1);
                        }
                      }}
                      disabled={selectedAudioIndex === 0}
                    >
                      <Text
                        style={[
                          styles.audioNavButtonText,
                          selectedAudioIndex === 0 && styles.audioNavButtonTextDisabled,
                        ]}
                      >
                        ◀
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.audioCounter}>
                      {selectedAudioIndex + 1} of {userMessagesWithAudio.length}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.audioNavButton,
                        selectedAudioIndex === userMessagesWithAudio.length - 1 && styles.audioNavButtonDisabled,
                      ]}
                      onPress={() => {
                        if (selectedAudioIndex < userMessagesWithAudio.length - 1) {
                          stopAudio();
                          setSelectedAudioIndex(selectedAudioIndex + 1);
                        }
                      }}
                      disabled={selectedAudioIndex === userMessagesWithAudio.length - 1}
                    >
                      <Text
                        style={[
                          styles.audioNavButtonText,
                          selectedAudioIndex === userMessagesWithAudio.length - 1 && styles.audioNavButtonTextDisabled,
                        ]}
                      >
                        ▶
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()
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

        {/* Transcript */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {entry.mode === JOURNAL_MODES.CONVERSATIONAL
              ? 'Conversation'
              : 'Transcript'}
          </Text>
          <View style={styles.transcriptCard}>
            {entry.mode === JOURNAL_MODES.CONVERSATIONAL && messages.length > 0 ? (
              // Conversational mode: show messages with truncation
              <>
                {(showFullTranscript ? messages : messages.slice(0, 3)).map((msg, index) => (
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
                ))}
                {messages.length > 3 && (
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => setShowFullTranscript(!showFullTranscript)}
                  >
                    <Text style={styles.showAllButtonText}>
                      {showFullTranscript ? 'Show less' : `Show all (${messages.length} messages)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // Solo mode: show transcript with line truncation
              <>
                <Text
                  style={styles.transcriptText}
                  numberOfLines={showFullTranscript ? undefined : 5}
                >
                  {entry.transcript || 'No transcript available'}
                </Text>
                {entry.transcript && entry.transcript.length > 300 && (
                  <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => setShowFullTranscript(!showFullTranscript)}
                  >
                    <Text style={styles.showAllButtonText}>
                      {showFullTranscript ? 'Show less' : 'Show all'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Folder Picker Modal */}
      <FolderPickerModal
        visible={folderPickerVisible}
        onClose={() => setFolderPickerVisible(false)}
        folders={manualFolders}
        selectedFolderIds={entryFolderIds}
        onToggleFolder={handleToggleFolder}
        onCreateFolder={handleCreateFolderFromPicker}
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    paddingBottom: 25,
    backgroundColor: COLORS.background,
  },
  backButton: {},
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerActionButton: {},
  headerActionText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '400',
    letterSpacing: 1,
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
  nameDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryName: {
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 0.5,
    flex: 1,
  },
  editNameButton: {
    padding: 4,
  },
  editNameIcon: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '400',
    letterSpacing: 1,
  },
  nameEditContainer: {
    gap: 12,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
  },
  nameEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  nameEditCancel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '400',
    letterSpacing: 1,
  },
  nameEditSave: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    letterSpacing: 1,
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
  audioSection: {
    marginBottom: 40,
  },
  audioSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    marginBottom: 10,
    gap: 16,
  },
  audioNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioNavButtonDisabled: {
    opacity: 0.3,
  },
  audioNavButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.text,
  },
  audioNavButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  audioCounter: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 0.5,
    minWidth: 60,
    textAlign: 'center',
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
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  processingText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '400',
    marginTop: 20,
    letterSpacing: 0.5,
  },
  processingHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '300',
    marginTop: 8,
  },
  showAllButton: {
    paddingVertical: 12,
    marginTop: 10,
  },
  showAllButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
});
