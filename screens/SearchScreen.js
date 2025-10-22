import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { searchEntries, SEARCH_MODES, getSearchSuggestions } from '../services/searchService';
import { COLORS, JOURNAL_MODES } from '../utils/constants';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(SEARCH_MODES.HYBRID);
  const [suggestions, setSuggestions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else if (query.trim().length === 0) {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  const loadSuggestions = async () => {
    try {
      const suggestionList = await getSearchSuggestions();
      setSuggestions(suggestionList);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      const searchResults = await searchEntries(query, {
        mode: searchMode,
        maxResults: 50,
        minScore: 0.1,
      });
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion) => {
    setQuery(suggestion);
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
      return `Yesterday`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const getScoreColor = (score) => {
    if (score >= 0.7) return '#2ECC71';
    if (score >= 0.5) return '#F39C12';
    return '#95A5A6';
  };

  const getSearchModeLabel = (mode) => {
    switch (mode) {
      case SEARCH_MODES.SEMANTIC:
        return 'Semantic';
      case SEARCH_MODES.KEYWORD:
        return 'Keyword';
      case SEARCH_MODES.HYBRID:
      default:
        return 'Hybrid';
    }
  };

  const highlightText = (text, query) => {
    if (!text || !query) return text;
    // Simple highlighting - in production, might want to use more sophisticated approach
    return text;
  };

  const renderResult = ({ item }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => navigation.navigate('EntryDetail', { entryId: item.id })}
    >
      <View style={styles.resultHeader}>
        <View style={styles.resultHeaderLeft}>
          <Text style={styles.resultDate}>{formatDate(item.date)}</Text>
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
        <View style={styles.scoreContainer}>
          <View style={[styles.scoreBar, { width: `${item.combinedScore * 100}%`, backgroundColor: getScoreColor(item.combinedScore) }]} />
          <Text style={styles.scoreText}>{Math.round(item.combinedScore * 100)}%</Text>
        </View>
      </View>

      {item.name && (
        <Text style={styles.resultName}>{item.name}</Text>
      )}

      <Text style={styles.resultSummary} numberOfLines={3}>
        {item.summary || item.transcript?.substring(0, 150)}
      </Text>

      {item.matchTypes && (
        <View style={styles.matchTypesContainer}>
          {item.matchTypes.map((type, idx) => (
            <View key={idx} style={styles.matchTypeBadge}>
              <Text style={styles.matchTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (query.trim().length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Search your journal</Text>
          <Text style={styles.emptyText}>
            Enter at least 2 characters to search
          </Text>
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Popular topics:</Text>
              <View style={styles.suggestionsGrid}>
                {suggestions.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionChip}
                    onPress={() => handleSuggestionPress(suggestion)}
                  >
                    <Text style={styles.suggestionChipText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>Search tips:</Text>
            <Text style={styles.tipText}>• Hybrid mode combines semantic and keyword search</Text>
            <Text style={styles.tipText}>• Semantic finds similar concepts</Text>
            <Text style={styles.tipText}>• Keyword matches exact words</Text>
          </View>
        </View>
      );
    }

    if (query.trim().length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Enter at least 2 characters</Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptyText}>
            Try different keywords or switch search mode
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your journal entries..."
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Search Mode Selector */}
      <View style={styles.modeSelector}>
        {Object.values(SEARCH_MODES).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeButton,
              searchMode === mode && styles.modeButtonActive,
            ]}
            onPress={() => setSearchMode(mode)}
          >
            <Text
              style={[
                styles.modeButtonText,
                searchMode === mode && styles.modeButtonTextActive,
              ]}
            >
              {getSearchModeLabel(mode)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results Count */}
      {results.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </Text>
        </View>
      )}

      {/* Results List */}
      {results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        renderEmptyState()
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
    paddingBottom: 20,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: COLORS.text,
    letterSpacing: 2,
  },
  searchContainer: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    fontWeight: '300',
  },
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeButtonText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '400',
    letterSpacing: 1,
  },
  modeButtonTextActive: {
    color: COLORS.card,
  },
  resultsHeader: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
  },
  resultsCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '300',
    letterSpacing: 1,
  },
  listContent: {
    padding: 40,
    paddingTop: 0,
  },
  resultCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resultDate: {
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
  scoreContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  scoreBar: {
    height: 3,
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  resultName: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  resultSummary: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    fontWeight: '300',
    marginBottom: 8,
  },
  matchTypesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  matchTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  matchTypeText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '400',
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 10,
    letterSpacing: 1,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 30,
  },
  suggestionsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: 1,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  tipsContainer: {
    width: '100%',
    alignItems: 'flex-start',
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: 1,
  },
  tipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '300',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
});
