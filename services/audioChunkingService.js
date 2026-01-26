import { FFmpegKit, FFprobeKit, ReturnCode } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Maximum chunk duration in seconds (10 minutes)
const MAX_CHUNK_DURATION_SECONDS = 600;

/**
 * Get the duration of an audio file in seconds
 * @param {string} uri - File URI
 * @returns {Promise<number>} Duration in seconds
 */
export const getAudioDuration = async (uri) => {
  try {
    // Convert file:// URI to path for FFmpeg
    const filePath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;

    const session = await FFprobeKit.execute(
      `-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );

    const returnCode = await session.getReturnCode();

    if (ReturnCode.isSuccess(returnCode)) {
      const output = await session.getOutput();
      const duration = parseFloat(output.trim());

      if (isNaN(duration)) {
        throw new Error('Could not parse audio duration');
      }

      console.log(`Audio duration: ${duration} seconds`);
      return duration;
    } else {
      const logs = await session.getAllLogsAsString();
      throw new Error(`FFprobe failed: ${logs}`);
    }
  } catch (error) {
    console.error('Error getting audio duration:', error);
    throw error;
  }
};

/**
 * Split an audio file into chunks of maximum duration
 * @param {string} uri - Input file URI
 * @param {number} maxDurationSeconds - Maximum chunk duration (default: 600 seconds / 10 minutes)
 * @returns {Promise<string[]>} Array of chunk file URIs
 */
export const splitAudioIntoChunks = async (uri, maxDurationSeconds = MAX_CHUNK_DURATION_SECONDS) => {
  try {
    const duration = await getAudioDuration(uri);

    // If audio is short enough, no splitting needed
    if (duration <= maxDurationSeconds) {
      console.log('Audio is short enough, no chunking needed');
      return [uri];
    }

    const numChunks = Math.ceil(duration / maxDurationSeconds);
    console.log(`Splitting audio into ${numChunks} chunks...`);

    const chunkUris = [];
    const inputPath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
    const baseDir = FileSystem.documentDirectory;
    const timestamp = Date.now();

    for (let i = 0; i < numChunks; i++) {
      const startTime = i * maxDurationSeconds;
      const chunkFileName = `chunk_${timestamp}_${i}.m4a`;
      const chunkPath = `${baseDir}${chunkFileName}`;
      const chunkUri = `file://${chunkPath}`;

      console.log(`Creating chunk ${i + 1}/${numChunks} starting at ${startTime}s...`);

      // Use -c copy to avoid re-encoding (faster and maintains quality)
      const command = `-i "${inputPath}" -ss ${startTime} -t ${maxDurationSeconds} -c copy "${chunkPath}"`;

      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        // Verify chunk was created
        const fileInfo = await FileSystem.getInfoAsync(chunkUri);
        if (fileInfo.exists && fileInfo.size > 0) {
          chunkUris.push(chunkUri);
          console.log(`Chunk ${i + 1} created: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`);
        } else {
          throw new Error(`Chunk ${i + 1} was not created properly`);
        }
      } else {
        const logs = await session.getAllLogsAsString();
        throw new Error(`FFmpeg failed on chunk ${i + 1}: ${logs}`);
      }
    }

    console.log(`Successfully created ${chunkUris.length} chunks`);
    return chunkUris;
  } catch (error) {
    console.error('Error splitting audio:', error);
    throw error;
  }
};

/**
 * Delete temporary chunk files
 * @param {string[]} chunkUris - Array of chunk file URIs to delete
 * @param {string} originalUri - Original file URI to NOT delete
 */
export const cleanupChunks = async (chunkUris, originalUri) => {
  for (const chunkUri of chunkUris) {
    // Don't delete the original file if it was returned as-is
    if (chunkUri === originalUri) {
      continue;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(chunkUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(chunkUri, { idempotent: true });
        console.log(`Deleted chunk: ${chunkUri}`);
      }
    } catch (error) {
      console.warn(`Failed to delete chunk ${chunkUri}:`, error);
      // Don't throw - cleanup failures shouldn't break the flow
    }
  }
};

/**
 * Check if an audio file needs to be chunked based on file size
 * @param {string} uri - File URI
 * @param {number} maxSizeMB - Maximum size in MB before chunking (default: 20)
 * @returns {Promise<boolean>} True if file needs chunking
 */
export const needsChunking = async (uri, maxSizeMB = 20) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File not found');
    }

    const fileSizeMB = fileInfo.size / (1024 * 1024);
    const result = fileSizeMB > maxSizeMB;

    if (result) {
      console.log(`File size ${fileSizeMB.toFixed(1)}MB exceeds ${maxSizeMB}MB, chunking required`);
    }

    return result;
  } catch (error) {
    console.error('Error checking file size:', error);
    throw error;
  }
};
