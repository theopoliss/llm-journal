import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

let recording = null;
let sound = null;

export const requestAudioPermissions = async () => {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting audio permissions:', error);
    return false;
  }
};

export const startRecording = async () => {
  try {
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) {
      throw new Error('Audio permission not granted');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();

    console.log('Recording started');
    return recording;
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
};

export const stopRecording = async () => {
  try {
    if (!recording) {
      throw new Error('No recording in progress');
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    // Save to permanent location
    const fileName = `recording_${Date.now()}.m4a`;
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: uri,
      to: newUri,
    });

    console.log('Recording stopped and saved:', newUri);
    recording = null;

    return newUri;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    throw error;
  }
};

export const playAudio = async (uri) => {
  try {
    if (sound) {
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );

    sound = newSound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        sound = null;
      }
    });

    console.log('Playing audio:', uri);
    return sound;
  } catch (error) {
    console.error('Failed to play audio:', error);
    throw error;
  }
};

export const pauseAudio = async () => {
  try {
    if (sound) {
      await sound.pauseAsync();
    }
  } catch (error) {
    console.error('Failed to pause audio:', error);
    throw error;
  }
};

export const resumeAudio = async () => {
  try {
    if (sound) {
      await sound.playAsync();
    }
  } catch (error) {
    console.error('Failed to resume audio:', error);
    throw error;
  }
};

export const stopAudio = async () => {
  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      sound = null;
    }
  } catch (error) {
    console.error('Failed to stop audio:', error);
    throw error;
  }
};

export const deleteAudioFile = async (uri) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
      console.log('Audio file deleted:', uri);
    }
  } catch (error) {
    console.error('Failed to delete audio file:', error);
    throw error;
  }
};

export const getAudioDuration = async (uri) => {
  try {
    const { sound: tempSound } = await Audio.Sound.createAsync({ uri });
    const status = await tempSound.getStatusAsync();
    await tempSound.unloadAsync();
    return status.durationMillis;
  } catch (error) {
    console.error('Failed to get audio duration:', error);
    return 0;
  }
};
