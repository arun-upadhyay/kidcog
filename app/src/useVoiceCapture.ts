import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { transcribeAudio } from './api';
import { stopSpeaking } from './speech';

export type VoiceStage = 'idle' | 'recording' | 'working' | 'failed';

/** Longest we let anyone ramble before stopping for them. */
export const MAX_RECORD_SECONDS = 60;

/**
 * Record, upload, transcribe.
 *
 * Kept separate from the components so the same behaviour can drive both the
 * big microphone a five-year-old taps and the small one next to an older
 * child's text box. Only the presentation differs.
 */
export function useVoiceCapture(onTranscript: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [stage, setStage] = useState<VoiceStage>('idle');
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
  }, []);

  useEffect(() => clearTick, [clearTick]);

  const stop = useCallback(async () => {
    clearTick();
    setStage('working');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was captured.');

      const base64 = await readAsBase64(uri);
      const filename = uri.split('/').pop() || 'answer.m4a';
      const { text } = await transcribeAudio(base64, filename);

      if (!text.trim()) {
        setProblem("I couldn't make that out. Try again, or type it instead.");
        setStage('failed');
        return;
      }
      onTranscript(text.trim());
      setProblem(null);
      setStage('idle');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not understand the recording.');
      setStage('failed');
    }
  }, [recorder, onTranscript, clearTick]);

  const start = useCallback(async () => {
    setProblem(null);
    stopSpeaking(); // never record the question being read aloud
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setProblem('Microphone permission is needed to record an answer.');
        setStage('failed');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setStage('recording');
      tick.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not start recording.');
      setStage('failed');
    }
  }, [recorder]);

  // Stop for them at the cap rather than recording indefinitely.
  useEffect(() => {
    if (stage === 'recording' && seconds >= MAX_RECORD_SECONDS) {
      void stop();
    }
  }, [seconds, stage, stop]);

  const toggle = useCallback(() => {
    if (stage === 'recording') void stop();
    else if (stage !== 'working') void start();
  }, [stage, start, stop]);

  return { stage, seconds, problem, start, stop, toggle };
}

/**
 * Read the recording as base64.
 *
 * On native the file lives on disk; on web the recorder hands back a blob URL.
 * fetch handles both, which avoids a platform branch and an extra dependency.
 */
async function readAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
