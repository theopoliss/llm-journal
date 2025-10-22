import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  getEntriesInFolder,
  getEntriesMatchingRules,
  getSmartFolder,
  deleteJournalEntry,
  updateSmartFolder,
} from '../services/databaseService';
import { deleteAudioFile } from '../services/audioService';
import { COLORS, JOURNAL_MODES } from '../utils/constants';

export default function FolderDetailScreen({ route, navigation }) {
  const { folderId, folderType, folderName } = route.params;
  const [entries, setEntries] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(null);
  const [folder, setFolder] = useState(null);

  useEffect(() => {
    loadData();

    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [folderId, folderType]);

  const loadData = async () => {
    try {
      if (folderType === 'smart') {
        // Load folder details
        const folderData = await getSmartFolder(folderId);
        setFolder(folderData);

        // For rule-based folders, query dynamically
        if (folderData.type === 'rule' && folderData.rules) {
          const matchingEntries = await getEntriesMatchingRules(folderData.rules);
          setEntries(matchingEntries);
        } else if (folderData.type === 'cluster') {
          // For cluster folders, get entries with matching cluster_id
          const allEntries = await getEntriesInFolder(folderId, folderType);
          setEntries(allEntries);
        }
      } else {
        // Manual folders use junction table
        const folderEntries = await getEntriesInFolder(folderId, folderType);
        setEntries(folderEntries);
      }
    } catch (error) {
      console.error('Error loading folder entries:', error);
      Alert.alert('Error', 'Failed to load folder entries');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMenuPress = (entryId) => {
    setMenuVisible(entryId);
  };

  const handleDeleteEntry = (entry) => {
    setMenuVisible(null);
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry?',
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
              loadData();
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const handleEditFolderName = () => {
    if (folder && folder.type === 'cluster') {
      Alert.prompt(
        'Rename Folder',
        'Enter a new name for this folder',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (newName) => {
              if (newName && newName.trim()) {
                try {
                  await updateSmartFolder(folderId, { name: newName.trim() });
                  setFolder({ ...folder, name: newName.trim() });
                  navigation.setParams({ folderName: newName.trim() });
                } catch (error) {
                  console.error('Error renaming folder:', error);
                  Alert.alert('Error', 'Failed to rename folder');
                }
              }
            },
          },
        ],
        'plain-text',
        folder.name
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const renderEntry = ({ item, index }) => {
    const isLastItem = index === entries.length - 1;

    return (
      <View style={styles.entryWrapper}>
        <View style={styles.entryCard}>
          <TouchableOpacity
            style={styles.entryContent}
            onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })}
          >
            <View style={styles.entryHeader}>
              <View style={styles.entryHeaderLeft}>
                <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
                <View
                  style={[
                    styles.modeBadge,
                    item.mode === JOURNAL_MODES.SOLO ? styles.modeBadgeSolo : styles.modeBadgeConversational,
                  ]}
                >
                  <Text style={[
                    styles.modeBadgeText,
                    item.mode === JOURNAL_MODES.SOLO && styles.modeBadgeTextSolo,
                  ]}>
                    {item.mode === JOURNAL_MODES.SOLO ? 'Solo' : 'Chat'}
                  </Text>
                </View>
              </View>
            </View>
            {item.name && (
              <Text style={styles.entryName}>{item.name}</Text>
            )}
            {item.summary ? (
              <Text style={styles.entrySummary} numberOfLines={2}>
                {item.summary}
              </Text>
            ) : (
              <Text style={styles.entryNoSummary}>Processing...</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => handleMenuPress(item.id)}
          >
            <Text style={styles.menuButtonText}>⋯</Text>
          </TouchableOpacity>
        </View>
        {!isLastItem && <View style={styles.entrySeparator} />}
        {menuVisible === item.id && (
          <>
            <TouchableOpacity
              style={styles.menuBackdrop}
              onPress={() => setMenuVisible(null)}
              activeOpacity={1}
            />
            <View style={styles.menuDropdown}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleDeleteEntry(item)}
              >
                <Text style={styles.menuItemText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{folderName}</Text>
          {folder && folder.type === 'cluster' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditFolderName}
            >
              <Text style={styles.editButtonText}>Rename</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No entries in this folder</Text>
          <Text style={styles.emptySubtext}>
            Entries will appear here automatically
          </Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          <View style={styles.entriesGroupContainer}>
            <FlatList
              data={entries}
              renderItem={renderEntry}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              scrollEnabled={false}
            />
          </View>
        </View>
      )}
    </View>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: COLORS.text,
    letterSpacing: 2,
    flex: 1,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editButtonText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 0.5,
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
  listContent: {
    padding: 40,
    paddingTop: 20,
    paddingBottom: 40,
  },
  entriesGroupContainer: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  entryWrapper: {
    position: 'relative',
    backgroundColor: COLORS.background,
  },
  entryCard: {
    backgroundColor: COLORS.background,
    flexDirection: 'row',
  },
  entrySeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 20,
    marginRight: 20,
  },
  entryContent: {
    flex: 1,
    padding: 20,
    paddingRight: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBadgeSolo: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.primary,
  },
  modeBadgeConversational: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.border,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  modeBadgeTextSolo: {
    color: COLORS.primary,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  entrySummary: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    fontWeight: '300',
  },
  entryNoSummary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '300',
    color: COLORS.textSecondary,
    marginBottom: 10,
    letterSpacing: 1,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '300',
  },
  menuButton: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  menuButtonText: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '300',
    letterSpacing: 2,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  menuDropdown: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 120,
    zIndex: 1000,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
