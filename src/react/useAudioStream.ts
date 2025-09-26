// ABOUTME: React hook for easy integration of audio streaming functionality
// ABOUTME: Provides a simple interface for audio recording and transcription in React apps

import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioStreamClient } from '../client/AudioStreamClient';
import { 
  ConnectionState, 
  RecordingState, 
  TranscriptionResult,
  ClientOptions 
} from '../common/types';

export interface UseAudioStreamOptions extends Partial<ClientOptions> {
  websocketUrl: string;
  autoConnect?: boolean;
  onTranscription?: (result: TranscriptionResult) => void;
  onError?: (error: Error) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onRecordingStateChange?: (state: RecordingState) => void;
}

export interface UseAudioStreamResult {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: ConnectionState;
  connectionError: Error | null;
  
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  recordingState: RecordingState;
  recordingError: Error | null;
  
  // Transcription
  transcript: string;
  lastTranscription: TranscriptionResult | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearTranscript: () => void;
}

export function useAudioStream(options: UseAudioStreamOptions): UseAudioStreamResult {
  const clientRef = useRef<AudioStreamClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [recordingError, setRecordingError] = useState<Error | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [lastTranscription, setLastTranscription] = useState<TranscriptionResult | null>(null);
  
  // Initialize client
  useEffect(() => {
    const client = new AudioStreamClient({
      ...options,
      websocketUrl: options.websocketUrl,
      authToken: options.authToken,
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      pingInterval: options.pingInterval,
      pongTimeout: options.pongTimeout,
      audioFormat: options.audioFormat
    });
    
    // Setup event listeners
    client.on('connected', () => {
      setConnectionError(null);
    });
    
    client.on('disconnected', (reason) => {
      if (reason && reason !== 'Client disconnect') {
        setConnectionError(new Error(`Disconnected: ${reason}`));
      }
    });
    
    client.on('transcription', (result) => {
      setLastTranscription(result);
      setTranscript(prev => {
        if (result.transcript) {
          return prev ? `${prev} ${result.transcript}` : result.transcript;
        }
        return prev;
      });
      
      // Call custom handler if provided
      options.onTranscription?.(result);
    });
    
    client.on('error', (error) => {
      console.error('Audio stream error:', error);
      setConnectionError(error);
      options.onError?.(error);
    });
    
    client.on('connection-state', (state) => {
      setConnectionState(state);
      options.onConnectionStateChange?.(state);
    });
    
    client.on('recording-state', (state) => {
      setRecordingState(state);
      setRecordingError(null);
      options.onRecordingStateChange?.(state);
    });
    
    clientRef.current = client;
    
    // Auto-connect if enabled
    if (options.autoConnect !== false) {
      client.connect().catch(error => {
        setConnectionError(error);
      });
    }
    
    // Cleanup
    return () => {
      client.disconnect();
      client.removeAllListeners();
    };
  }, [options.websocketUrl, options.authToken]); // Only re-initialize on URL or auth change
  
  // Actions
  const connect = useCallback(async () => {
    if (!clientRef.current) return;
    
    try {
      setConnectionError(null);
      await clientRef.current.connect();
    } catch (error) {
      setConnectionError(error as Error);
      throw error;
    }
  }, []);
  
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);
  
  const startRecording = useCallback(async () => {
    if (!clientRef.current) return;
    
    try {
      setRecordingError(null);
      await clientRef.current.startRecording();
    } catch (error) {
      const err = error as Error;
      setRecordingError(err);
      throw err;
    }
  }, []);
  
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!clientRef.current) return null;
    
    try {
      return await clientRef.current.stopRecording();
    } catch (error) {
      const err = error as Error;
      setRecordingError(err);
      throw err;
    }
  }, []);
  
  const pauseRecording = useCallback(() => {
    if (!clientRef.current) return;
    
    try {
      clientRef.current.pauseRecording();
    } catch (error) {
      const err = error as Error;
      setRecordingError(err);
      throw err;
    }
  }, []);
  
  const resumeRecording = useCallback(() => {
    if (!clientRef.current) return;
    
    try {
      clientRef.current.resumeRecording();
    } catch (error) {
      const err = error as Error;
      setRecordingError(err);
      throw err;
    }
  }, []);
  
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setLastTranscription(null);
  }, []);
  
  return {
    // Connection state
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting: connectionState === ConnectionState.CONNECTING,
    connectionState,
    connectionError,
    
    // Recording state
    isRecording: recordingState === RecordingState.RECORDING,
    isPaused: recordingState === RecordingState.PAUSED,
    recordingState,
    recordingError,
    
    // Transcription
    transcript,
    lastTranscription,
    
    // Actions
    connect,
    disconnect,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscript
  };
}