import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import {
  playAudio,
  pauseAudio,
  resumeAudio,
  stopAudio,
  seekTo,
  getAudioDuration,
} from '../services/audioService';
import { COLORS } from '../utils/constants';

export default function AudioPlayer({ audioUri, onPlaybackEnd }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayPosition, setSeekDisplayPosition] = useState(0);

  // All refs for PanResponder to avoid stale closures
  const durationRef = useRef(0);
  const seekPositionRef = useRef(0);
  const soundLoadedRef = useRef(false);
  const progressBarLayout = useRef({ pageX: 0, width: 0 });
  const audioUriRef = useRef(audioUri);
  const handleStatusUpdateRef = useRef(null);
  const isSeekingRef = useRef(false);
  const progressBarRef = useRef(null);

  // Keep refs in sync
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    audioUriRef.current = audioUri;
  }, [audioUri]);

  useEffect(() => {
    // Load duration on mount
    loadDuration();

    return () => {
      // Stop audio on unmount, ignore errors (e.g., if seeking was interrupted)
      stopAudio().catch(() => {});
      soundLoadedRef.current = false;
    };
  }, [audioUri]);

  const loadDuration = async () => {
    try {
      const dur = await getAudioDuration(audioUri);
      setDuration(dur);
      durationRef.current = dur;
    } catch (error) {
      console.error('Error loading duration:', error);
    }
  };

  const handleStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      soundLoadedRef.current = true;
      setDuration(status.durationMillis || 0);
      durationRef.current = status.durationMillis || 0;

      // Only update position if not currently seeking
      if (!isSeekingRef.current) {
        setPosition(status.positionMillis || 0);
      }
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        soundLoadedRef.current = false;
        onPlaybackEnd?.();
      }
    }
  }, [onPlaybackEnd]);

  // Store callback in ref for PanResponder access
  useEffect(() => {
    handleStatusUpdateRef.current = handleStatusUpdate;
  }, [handleStatusUpdate]);

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await pauseAudio();
        setIsPlaying(false);
      } else {
        if (!soundLoadedRef.current || position >= duration) {
          await playAudio(audioUri, handleStatusUpdate);
          soundLoadedRef.current = true;
        } else {
          await resumeAudio();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setIsPlaying(false);
    }
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (isSeeking ? seekDisplayPosition : position) / duration : 0;

  const handleProgressBarLayout = () => {
    // Measure absolute position after layout
    if (progressBarRef.current) {
      progressBarRef.current.measure((x, y, width, height, pageX, pageY) => {
        progressBarLayout.current = { pageX, width };
      });
    }
  };

  // PanResponder - all logic uses refs to avoid stale closures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          isSeekingRef.current = true;
          setIsSeeking(true);

          // Re-measure on touch start for accuracy
          if (progressBarRef.current) {
            progressBarRef.current.measure((x, y, width, height, pageX, pageY) => {
              progressBarLayout.current = { pageX, width };

              const touchX = evt.nativeEvent.pageX;
              const padding = 8;
              const barStartX = pageX + padding;
              const effectiveWidth = width - (padding * 2);

              if (effectiveWidth > 0 && durationRef.current > 0) {
                const relativeX = touchX - barStartX;
                const ratio = Math.max(0, Math.min(1, relativeX / effectiveWidth));
                const newPos = ratio * durationRef.current;
                seekPositionRef.current = newPos;
                setSeekDisplayPosition(newPos);
              }
            });
          }
        },
        onPanResponderMove: (evt) => {
          const { pageX: barPageX, width } = progressBarLayout.current;
          const touchX = evt.nativeEvent.pageX;
          const padding = 8;
          const barStartX = barPageX + padding;
          const effectiveWidth = width - (padding * 2);

          if (effectiveWidth > 0 && durationRef.current > 0) {
            const relativeX = touchX - barStartX;
            const ratio = Math.max(0, Math.min(1, relativeX / effectiveWidth));
            const newPos = ratio * durationRef.current;
            seekPositionRef.current = newPos;
            setSeekDisplayPosition(newPos);
          }
        },
        onPanResponderRelease: async () => {
          const finalPosition = seekPositionRef.current;
          isSeekingRef.current = false;
          setIsSeeking(false);
          setPosition(finalPosition);

          try {
            if (!soundLoadedRef.current) {
              await playAudio(audioUriRef.current, handleStatusUpdateRef.current);
              soundLoadedRef.current = true;
              setIsPlaying(true);
            }
            await seekTo(finalPosition);
          } catch (error) {
            console.error('Error seeking:', error);
          }
        },
        onPanResponderTerminate: () => {
          isSeekingRef.current = false;
          setIsSeeking(false);
        },
      }),
    [] // No deps - everything uses refs
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
        <Text style={styles.playButtonText}>{isPlaying ? '❚❚' : '▶'}</Text>
      </TouchableOpacity>

      <View
        ref={progressBarRef}
        style={styles.progressBarContainer}
        onLayout={handleProgressBarLayout}
        {...panResponder.panHandlers}
      >
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.progressBarKnob, { left: `${progress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatTime(isSeeking ? seekDisplayPosition : position)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playButtonText: {
    color: COLORS.card,
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressBarKnob: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    marginLeft: -7,
  },
  timeContainer: {
    marginLeft: 12,
    minWidth: 80,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
