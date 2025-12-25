import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, JOURNAL_MODES } from '../utils/constants';

export default function NameEntryModal({ visible, onSave, onSkip, mode }) {
  const isDark = mode === JOURNAL_MODES.CONVERSATIONAL;
  const [name, setName] = useState('');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  const handleSkip = () => {
    onSkip();
    setName('');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
          <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>Name this entry</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={name}
            onChangeText={setName}
            placeholder="Enter a name"
            placeholderTextColor={isDark ? '#888888' : COLORS.textSecondary}
            autoFocus={true}
            onSubmitEditing={handleSave}
            returnKeyType="done"
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton, isDark && styles.skipButtonDark]}
              onPress={handleSkip}
            >
              <Text style={[styles.skipButtonText, isDark && styles.skipButtonTextDark]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, isDark && styles.saveButtonDark]}
              onPress={handleSave}
            >
              <Text style={[styles.saveButtonText, isDark && styles.saveButtonTextDark]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    padding: 40,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  modalContentDark: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.text,
    marginBottom: 30,
    letterSpacing: 1,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '300',
    marginBottom: 30,
    borderRadius: 8,
  },
  inputDark: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
    color: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  skipButton: {
    backgroundColor: COLORS.background,
  },
  skipButtonDark: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: 1,
  },
  skipButtonTextDark: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.card,
    letterSpacing: 1,
  },
  saveButtonTextDark: {
    color: '#000000',
  },
});
