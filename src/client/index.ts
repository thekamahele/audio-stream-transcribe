// ABOUTME: Client-side exports for the audio-stream-transcribe module
// ABOUTME: Provides access to browser-based audio recording and streaming

export { AudioStreamClient } from './AudioStreamClient';

// Re-export common types needed by clients
export {
  ConnectionState,
  RecordingState,
  TranscriptionResult,
  ClientOptions,
  ClientEvents
} from '../common/types';