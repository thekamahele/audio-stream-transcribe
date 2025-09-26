// ABOUTME: Type definitions for the audio-stream-transcribe module
// ABOUTME: Provides common interfaces and types used across the package

export interface TranscriptionResult {
  transcript: string;
  speaker?: string | number;
  confidence?: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface AudioChunk {
  data: Buffer | ArrayBuffer;
  timestamp: number;
  format: AudioFormat;
  sessionId: string;
  sequenceNumber?: number;
}

export interface AudioFormat {
  mimeType: string;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface ConnectionParams {
  websocket: any;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ServerOptions {
  transcriptionProvider: TranscriptionProvider;
  enableLLMProcessing?: boolean;
  maxConnectionsPerUser?: number;
  connectionTimeout?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

export interface ClientOptions {
  websocketUrl: string;
  authToken?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  audioFormat?: Partial<AudioFormat>;
  pingInterval?: number;
  pongTimeout?: number;
}

export abstract class TranscriptionProvider {
  abstract initialize(): Promise<void>;
  abstract processAudio(audioData: Buffer | ArrayBuffer, metadata?: any): Promise<TranscriptionResult>;
  abstract cleanup(): Promise<void>;
  
  // Optional methods
  updateConfiguration?(config: any): Promise<void>;
  getStats?(): any;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  STOPPING = 'stopping'
}

export interface ServerEvents {
  connection: (params: { sessionId: string; userId?: string }) => void;
  disconnection: (params: { sessionId: string; userId?: string; reason?: string }) => void;
  transcription: (params: TranscriptionResult & { sessionId: string }) => void;
  'audio-chunk': (chunk: AudioChunk) => void;
  error: (params: { sessionId: string; error: Error }) => void;
  'llm-request': (params: { sessionId: string; audio?: Buffer; metadata?: any }) => void;
}

export interface ClientEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  transcription: (result: TranscriptionResult) => void;
  error: (error: Error) => void;
  'connection-state': (state: ConnectionState) => void;
  'recording-state': (state: RecordingState) => void;
}