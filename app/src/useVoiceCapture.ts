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

      const { base64, mimeType } = await readRecording(uri);
      // The format must come from the blob, not the URL. On web the recorder
      // hands back a blob: URL with no file extension at all, and OpenAI
      // rejects an upload whose format it cannot determine.
      const { text } = await transcribeAudio(base64, filenameFor(mimeType), mimeType);

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
 * Read the recording, returning both its bytes and its actual media type.
 *
 * On native the file lives on disk; on web the recorder hands back a blob URL.
 * fetch handles both, which avoids a platform branch and an extra dependency.
 *
 * The media type matters: OpenAI needs a recognisable audio format, and on web
 * the URL carries no extension to infer one from. The blob knows what it is, so
 * ask it rather than guessing from a filename.
 */
async function readRecording(uri: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();

  // Strip any codec parameters: "audio/webm;codecs=opus" -> "audio/webm".
  const declared = (blob.type || '').split(';')[0]?.trim() ?? '';
  const mimeType = declared || inferFromUri(uri);

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });

  return { base64, mimeType };
}

/** Fall back to the file extension when the blob does not declare a type. */
function inferFromUri(uri: string): string {
  const ext = uri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  const table: Record<string, string> = {
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    caf: 'audio/x-caf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
  };
  return table[ext] ?? 'audio/mp4';
}

/** A filename whose extension matches the media type, which is what OpenAI reads. */
function filenameFor(mimeType: string): string {
  const table: Record<string, string> = {
    'audio/mp4': 'answer.m4a',
    'audio/x-m4a': 'answer.m4a',
    'audio/mpeg': 'answer.mp3',
    'audio/wav': 'answer.wav',
    'audio/x-wav': 'answer.wav',
    'audio/webm': 'answer.webm',
    'audio/ogg': 'answer.ogg',
    'video/webm': 'answer.webm',
  };
  return table[mimeType] ?? 'answer.m4a';
}
