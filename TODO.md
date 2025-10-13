# TODO - Smart Folders Implementation

## ✅ Completed

- [x] Database schema with 6 tables (smart_folders, manual_folders, folder_entries, etc.)
- [x] Embeddings service (OpenAI text-embedding-3-small integration)
- [x] Clustering service (k-means algorithm, auto-regeneration)
- [x] Topic extraction from entries
- [x] Tabbed UI in JournalListScreen (All/Recents/Smart/Folders)
- [x] Sorting functionality (Newest/Oldest)
- [x] FolderDetailScreen component
- [x] Background processing for embeddings/topics/clustering
- [x] Automatic cluster folder generation
- [x] Cluster folder renaming
- [x] Navigation integration
- [x] Updated CLAUDE.md documentation

## 🚧 In Progress / Not Yet Implemented

### High Priority

- [ ] **Rule-based folder editor UI**
  - Modal/screen to create rule-based smart folders
  - UI for date range picker
  - Mode selector (Solo/Conversational)
  - Text contains input
  - Topics contains input
  - Preview of matching entries count
  - Save/cancel buttons

- [ ] **Manual folder creation**
  - "New Folder" button in Manual Folders tab
  - Create folder modal
  - Add/remove entries to manual folders
  - Folder management (rename, delete)

- [ ] **Settings page additions**
  - "Smart Folders" section
  - "Number of Clusters" slider (5-15, default 5)
  - "Clustering Threshold" input (default 10)
  - "Regenerate Clusters" button with loading state
  - "Enable Smart Folders" toggle

### Medium Priority

- [ ] **UI polish**
  - Loading states for clustering
  - Empty state improvements
  - Error handling for API failures
  - Offline mode handling

- [ ] **Cluster management**
  - Merge small clusters (< 3 entries)
  - Delete individual cluster folders
  - Manual cluster assignment override

- [ ] **Rule-based folder improvements**
  - Edit existing rule folders
  - Delete rule folders
  - More filter options (word count, sentiment, etc.)

### Low Priority / Future Enhancements

- [ ] **Search functionality**
  - Global search across all entries
  - Search within folders
  - Search by topics

- [ ] **Batch operations**
  - Multi-select entries
  - Bulk add to manual folders
  - Bulk delete

- [ ] **Export/sharing**
  - Export entries as text/PDF
  - Share individual entries
  - Backup database

- [ ] **Analytics**
  - Entry count over time
  - Topics trending
  - Most active clusters

## 🐛 Known Issues

- [ ] FolderDetailScreen for cluster folders loads from junction table (should use cluster_id) - **FIXED**
- [ ] Entry count for cluster folders incorrect - **FIXED**
- [ ] No error handling if clustering fails silently

## 📝 Technical Debt

- [ ] Add retry logic for embedding generation failures
- [ ] Optimize clustering performance for large datasets (>1000 entries)
- [ ] Add database indexes for faster queries (cluster_id, created_at)
- [ ] Consider web worker for clustering on larger datasets
- [ ] Add telemetry/logging for debugging clustering issues

## 🧪 Testing Needed

- [ ] Test with 100+ entries to verify clustering performance
- [ ] Test offline behavior (embeddings should queue)
- [ ] Test API key invalid/expired scenarios
- [ ] Test database migration on fresh install vs upgrade
- [ ] Test memory usage with large embedding arrays

## 💡 Architecture Decisions to Document

- Why k-means over hierarchical clustering? (Performance + simplicity)
- Why store embeddings in SQLite vs separate vector DB? (Simplicity, acceptable for <1000 entries)
- Why background processing vs foreground? (UX - don't block user)
- Why threshold-based clustering trigger vs time-based? (Quality over frequency)

---

## Quick Start for Next Session

1. **Test existing implementation:**
   ```bash
   npm start
   # Create 5-10 entries, verify clustering works
   ```

2. **Next feature to build: Rule-based folder editor**
   - Create `components/RuleFolderEditor.js` modal
   - Add "New Rule Folder" button to Smart tab
   - Wire up to `createSmartFolder()` in databaseService

3. **Or: Settings page enhancements**
   - Add Smart Folders section to SettingsScreen
   - Add clustering controls
   - Test regeneration manually
