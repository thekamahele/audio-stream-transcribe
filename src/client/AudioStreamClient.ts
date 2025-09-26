// ABOUTME: Client-side audio streaming implementation for browser environments
// ABOUTME: Handles audio recording, WebSocket communication, and event management

import { EventEmitter } from 'eventemitter3';
import { 
  ClientOptions, 
  ConnectionState, 
  RecordingState,
  ClientEvents,
  TranscriptionResult 
} from '../common/types';

export class AudioStreamClient extends EventEmitter<ClientEvents> {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private recordingState: RecordingState = RecordingState.IDLE;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timer | null = null;
  private pingTimer: NodeJS.Timer | null = null;
  private pongTimer: NodeJS.Timer | null = null;
  private audioChunkTimer: NodeJS.Timer | null = null;
  private recordedChunks: Blob[] = [];
  
  constructor(private options: ClientOptions) {
    super();
  }
  
  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED) {
      return;
    }
    
    this.setConnectionState(ConnectionState.CONNECTING);
    
    try {
      await this.establishConnection();
    } catch (error) {
      this.setConnectionState(ConnectionState.ERROR);
      throw error;
    }
  }
  
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.options.websocketUrl);
      
      // Add auth token if provided
      if (this.options.authToken) {
        url.searchParams.set('token', this.options.authToken);
      }
      
      this.ws = new WebSocket(url.toString());
      
      this.ws.onopen = () => {
        this.setConnectionState(ConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.emit('connected');
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', new Error('WebSocket connection failed'));
      };
      
      this.ws.onclose = (event) => {
        this.handleDisconnection(event.reason);
        if (this.connectionState === ConnectionState.CONNECTING) {
          reject(new Error('Failed to connect'));
        }
      };
      
      // Set connection timeout
      setTimeout(() => {
        if (this.connectionState === ConnectionState.CONNECTING) {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }
  
  private handleMessage(data: string | Blob): void {
    if (typeof data !== 'string') return;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'pong':
          this.handlePong();
          break;
          
        case 'transcription':
          this.handleTranscription(message.data);
          break;
          
        case 'recording-started':
        case 'recording-stopped':
        case 'recording-paused':
        case 'recording-resumed':
          // Confirmation messages from server
          break;
          
        case 'error':
          this.emit('error', new Error(message.message || 'Server error'));
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }
  
  private handleTranscription(data: TranscriptionResult): void {
    this.emit('transcription', data);
  }
  
  private handleDisconnection(reason?: string): void {
    this.stopPingInterval();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.emit('disconnected', reason);
    
    // Stop recording if active
    if (this.recordingState !== RecordingState.IDLE) {
      this.stopRecording().catch(console.error);
    }
    
    // Attempt reconnection if enabled
    if (this.options.reconnect && 
        this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
      this.scheduleReconnection();
    }
  }
  
  private scheduleReconnection(): void {
    if (this.reconnectTimer) return;
    
    this.setConnectionState(ConnectionState.RECONNECTING);
    const delay = Math.min(
      (this.options.reconnectDelay || 1000) * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect().catch(console.error);
    }, delay);
  }
  
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState(ConnectionState.DISCONNECTED);
  }
  
  async startRecording(): Promise<void> {
    if (this.recordingState !== RecordingState.IDLE) {
      throw new Error('Recording already in progress');
    }
    
    if (this.connectionState !== ConnectionState.CONNECTED) {
      throw new Error('Not connected to server');
    }
    
    this.setRecordingState(RecordingState.RECORDING);
    
    try {
      // Get user media
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Determine supported mime types
      const mimeType = this.getSupportedMimeType();
      
      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      this.recordedChunks = [];
      
      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          this.sendAudioData(event.data);
        }
      };
      
      // Handle errors
      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        this.emit('error', new Error('Recording failed'));
        this.stopRecording().catch(console.error);
      };
      
      // Send start message
      this.sendMessage({ type: 'start-recording' });
      
      // Start recording with timeslice for streaming
      this.mediaRecorder.start(1000); // 1 second chunks
      
    } catch (error) {
      this.setRecordingState(RecordingState.IDLE);
      throw error;
    }
  }
  
  async stopRecording(): Promise<Blob | null> {
    if (this.recordingState === RecordingState.IDLE) {
      return null;
    }
    
    this.setRecordingState(RecordingState.STOPPING);
    
    // Send stop message
    this.sendMessage({ type: 'stop-recording' });
    
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Create blob from recorded chunks
    const recordedBlob = this.recordedChunks.length > 0 
      ? new Blob(this.recordedChunks, { type: this.recordedChunks[0].type })
      : null;
    
    this.recordedChunks = [];
    this.mediaRecorder = null;
    this.setRecordingState(RecordingState.IDLE);
    
    return recordedBlob;
  }
  
  pauseRecording(): void {
    if (this.recordingState !== RecordingState.RECORDING) {
      throw new Error('Not currently recording');
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.setRecordingState(RecordingState.PAUSED);
      this.sendMessage({ type: 'pause-recording' });
    }
  }
  
  resumeRecording(): void {
    if (this.recordingState !== RecordingState.PAUSED) {
      throw new Error('Recording not paused');
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.setRecordingState(RecordingState.RECORDING);
      this.sendMessage({ type: 'resume-recording' });
    }
  }
  
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    // Fallback to default
    return '';
  }
  
  private sendAudioData(data: Blob): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Convert blob to ArrayBuffer and send
      data.arrayBuffer().then(buffer => {
        this.ws?.send(buffer);
      }).catch(error => {
        console.error('Failed to send audio data:', error);
      });
    }
  }
  
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  private startPingInterval(): void {
    const interval = this.options.pingInterval || 30000; // 30 seconds
    
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, interval);
  }
  
  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
  
  private sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'ping' });
      
      // Set pong timeout
      const timeout = this.options.pongTimeout || 5000; // 5 seconds
      this.pongTimer = setTimeout(() => {
        console.warn('Pong not received, reconnecting...');
        this.ws?.close();
      }, timeout);
    }
  }
  
  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
  
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('connection-state', state);
    }
  }
  
  private setRecordingState(state: RecordingState): void {
    if (this.recordingState !== state) {
      this.recordingState = state;
      this.emit('recording-state', state);
    }
  }
  
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  getRecordingState(): RecordingState {
    return this.recordingState;
  }
  
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }
  
  isRecording(): boolean {
    return this.recordingState === RecordingState.RECORDING;
  }
}