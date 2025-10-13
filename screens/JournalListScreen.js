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
  getJournalEntriesSorted,
  getRecentEntries,
  deleteJournalEntry,
  getSetting,
  setSetting,
  getSmartFolders,
  getManualFolders,
  getFolderEntryCount,
} from '../services/databaseService';
import { deleteAudioFile } from '../services/audioService';
import { COLORS, JOURNAL_MODES, SORT_OPTIONS, LIBRARY_TABS } from '../utils/constants';

export default function JournalListScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(LIBRARY_TABS.ALL);
  const [entries, setEntries] = useState([]);
  const [smartFolders, setSmartFolders] = useState([]);
  const [manualFolders, setManualFolders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(null);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.DATE_DESC);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    loadSortPreference();
  }, []);

  useEffect(() => {
    loadData();

    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [navigation, sortBy, activeTab]);

  const loadSortPreference = async () => {
    try {
      const savedSort = await getSetting('sort_preference');
      if (savedSort && SORT_OPTIONS[savedSort.toUpperCase()]) {
        setSortBy(savedSort);
      }
    } catch (error) {
      console.error('Error loading sort preference:', error);
    }
  };

  const loadData = async () => {
    try {
      if (activeTab === LIBRARY_TABS.ALL) {
        const data = await getJournalEntriesSorted(sortBy);
        setEntries(data);
      } else if (activeTab === LIBRARY_TABS.RECENTS) {
        const data = await getRecentEntries(7);
        setEntries(data);
      } else if (activeTab === LIBRARY_TABS.SMART_FOLDERS) {
        const folders = await getSmartFolders();
        // Load entry counts for each folder
        const foldersWithCounts = await Promise.all(
          folders.map(async (folder) => {
            const count = await getFolderEntryCount(folder.id, 'smart');
            return { ...folder, entryCount: count };
          })
        );
        setSmartFolders(foldersWithCounts);
      } else if (activeTab === LIBRARY_TABS.MANUAL_FOLDERS) {
        const folders = await getManualFolders();
        const foldersWithCounts = await Promise.all(
          folders.map(async (folder) => {
            const count = await getFolderEntryCount(folder.id, 'manual');
            return { ...folder, entryCount: count };
          })
        );
        setManualFolders(foldersWithCounts);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const handleSortChange = async (newSort) => {
    setSortBy(newSort);
    setShowSortMenu(false);
    try {
      await setSetting('sort_preference', newSort);
      await loadData();
    } catch (error) {
      console.error('Error changing sort:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowSortMenu(false);
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
              loadEntries();
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

  const renderEntry = ({ item }) => (
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
                  item.mode === JOURNAL_MODES.CONVERSATIONAL && styles.modeBadgeConversational,
                ]}
              >
                <Text style={styles.modeBadgeText}>
                  {item.mode === JOURNAL_MODES.SOLO ? 'Solo' : 'Chat'}
                </Text>
              </View>
            </View>
          </View>
          {item.name && (
            <Text style={styles.entryName}>{item.name}</Text>
          )}
          {item.summary ? (
            <Text style={styles.entrySummary} numberOfLines={3}>
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

  const getSortLabel = (sort) => {
    return sort === SORT_OPTIONS.DATE_ASC ? 'Oldest First' : 'Newest First';
  };

  const renderFolder = ({ item }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => navigation.navigate('FolderDetail', {
        folderId: item.id,
        folderType: activeTab === LIBRARY_TABS.SMART_FOLDERS ? 'smart' : 'manual',
        folderName: item.name,
      })}
    >
      <View style={styles.folderHeader}>
        <Text style={styles.folderName}>{item.name}</Text>
        {item.type === 'cluster' && (
          <View style={styles.clusterBadge}>
            <Text style={styles.clusterBadgeText}>Auto</Text>
          </View>
        )}
      </View>
      <Text style={styles.folderCount}>
        {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
      </Text>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    if (activeTab === LIBRARY_TABS.ALL || activeTab === LIBRARY_TABS.RECENTS) {
      if (entries.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === LIBRARY_TABS.RECENTS
                ? 'No entries in the last 7 days'
                : 'No journal entries yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === LIBRARY_TABS.RECENTS
                ? 'Create an entry to see it here'
                : 'Start recording to create your first entry'}
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      );
    }

    if (activeTab === LIBRARY_TABS.SMART_FOLDERS) {
      if (smartFolders.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No smart folders yet</Text>
            <Text style={styles.emptySubtext}>
              Folders will be created automatically as you add more entries
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={smartFolders}
          renderItem={renderFolder}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      );
    }

    if (activeTab === LIBRARY_TABS.MANUAL_FOLDERS) {
      if (manualFolders.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No manual folders yet</Text>
            <Text style={styles.emptySubtext}>
              Create folders to organize your entries
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={manualFolders}
          renderItem={renderFolder}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Journal Entries</Text>
        <View style={styles.headerControls}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <Text style={styles.sortButtonText}>{getSortLabel(sortBy)}</Text>
            <Text style={styles.sortButtonIcon}>{showSortMenu ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showSortMenu && (
        <>
          <TouchableOpacity
            style={styles.sortMenuBackdrop}
            onPress={() => setShowSortMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.sortMenuDropdown}>
            {Object.values(SORT_OPTIONS).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.sortMenuItem,
                  sortBy === option && styles.sortMenuItemActive
                ]}
                onPress={() => handleSortChange(option)}
              >
                <Text style={[
                  styles.sortMenuItemText,
                  sortBy === option && styles.sortMenuItemTextActive
                ]}>
                  {getSortLabel(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {Object.entries({
          [LIBRARY_TABS.ALL]: 'All',
          [LIBRARY_TABS.RECENTS]: 'Recent',
          [LIBRARY_TABS.SMART_FOLDERS]: 'Smart',
          [LIBRARY_TABS.MANUAL_FOLDERS]: 'Folders',
        }).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => handleTabChange(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {renderTabContent()}
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
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: COLORS.text,
    marginBottom: 20,
    letterSpacing: 2,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  sortButtonText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  sortButtonIcon: {
    fontSize: 8,
    color: COLORS.text,
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
  sortMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  sortMenuDropdown: {
    position: 'absolute',
    top: 150,
    left: 40,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 140,
    zIndex: 1000,
  },
  sortMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sortMenuItemActive: {
    backgroundColor: COLORS.primary,
  },
  sortMenuItemText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  sortMenuItemTextActive: {
    color: COLORS.card,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '500',
  },
  folderCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 2,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 0.5,
    flex: 1,
  },
  clusterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clusterBadgeText: {
    fontSize: 9,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  folderCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  listContent: {
    padding: 40,
    paddingTop: 20,
    paddingBottom: 40,
  },
  entryWrapper: {
    marginBottom: 2,
    position: 'relative',
  },
  entryCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
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
