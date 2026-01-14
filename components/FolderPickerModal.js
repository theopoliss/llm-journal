import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS } from '../utils/constants';

export default function FolderPickerModal({
  visible,
  onClose,
  folders,
  selectedFolderIds,
  onToggleFolder,
  onCreateFolder,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleClose = () => {
    setIsCreating(false);
    setNewFolderName('');
    onClose();
  };

  const handleCreateFolder = () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }
    onCreateFolder(trimmedName);
    setNewFolderName('');
    setIsCreating(false);
  };

  const isSelected = (folderId) => selectedFolderIds.includes(folderId);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Add to Folder</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.folderList}>
            {folders.length === 0 && !isCreating && (
              <Text style={styles.emptyText}>No folders yet</Text>
            )}

            {folders.map((folder) => (
              <TouchableOpacity
                key={folder.id}
                style={styles.folderItem}
                onPress={() => onToggleFolder(folder.id)}
              >
                <Text style={styles.folderName}>{folder.name}</Text>
                <Text style={styles.checkbox}>
                  {isSelected(folder.id) ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}

            {isCreating ? (
              <View style={styles.createInputContainer}>
                <TextInput
                  style={styles.input}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Folder name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoFocus
                  onSubmitEditing={handleCreateFolder}
                  returnKeyType="done"
                />
                <View style={styles.createActions}>
                  <TouchableOpacity onPress={() => {
                    setIsCreating(false);
                    setNewFolderName('');
                  }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCreateFolder}>
                    <Text style={styles.createText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.createFolderButton}
                onPress={() => setIsCreating(true)}
              >
                <Text style={styles.createFolderText}>+ New Folder</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    width: '80%',
    maxWidth: 400,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 1,
  },
  closeButton: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 1,
  },
  folderList: {
    padding: 10,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '300',
  },
  folderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '300',
    color: COLORS.text,
    flex: 1,
  },
  checkbox: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    width: 24,
    textAlign: 'center',
  },
  createFolderButton: {
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  createFolderText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  createInputContainer: {
    padding: 10,
    gap: 12,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '300',
    borderRadius: 8,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  cancelText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '400',
    letterSpacing: 1,
  },
  createText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    letterSpacing: 1,
  },
});
