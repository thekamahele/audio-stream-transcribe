// ABOUTME: LLM processor for handling audio and transcription data
// ABOUTME: Provides hooks for sending audio/transcripts to language models

import { EventEmitter } from 'eventemitter3';
import { TranscriptionResult, AudioChunk } from '../common/types';

export interface LLMProcessorOptions {
  batchTimeout?: number; // Time to wait before processing a batch
  maxBatchSize?: number; // Maximum number of items in a batch
  includeAudio?: boolean; // Whether to include raw audio in LLM requests
  includeTranscript?: boolean; // Whether to include transcripts in LLM requests
}

export interface LLMRequest {
  sessionId: string;
  timestamp: number;
  audio?: Buffer;
  transcript?: string;
  transcriptionResults?: TranscriptionResult[];
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  sessionId: string;
  response: any;
  processingTime: number;
  metadata?: Record<string, any>;
}

export type LLMHandler = (request: LLMRequest) => Promise<LLMResponse>;

export interface LLMProcessorEvents {
  'llm-request': (request: LLMRequest) => void;
  'llm-response': (response: LLMResponse) => void;
  'llm-error': (error: { sessionId: string; error: Error }) => void;
}

export class LLMProcessor extends EventEmitter<LLMProcessorEvents> {
  private batchMap: Map<string, {
    audio: Buffer[];
    transcripts: TranscriptionResult[];
    metadata?: Record<string, any>;
    timer?: NodeJS.Timeout;
  }> = new Map();
  
  private llmHandler: LLMHandler | null = null;
  
  constructor(private options: LLMProcessorOptions = {}) {
    super();
    
    // Set defaults
    this.options.batchTimeout = options.batchTimeout ?? 5000; // 5 seconds
    this.options.maxBatchSize = options.maxBatchSize ?? 10;
    this.options.includeAudio = options.includeAudio ?? false;
    this.options.includeTranscript = options.includeTranscript ?? true;
  }
  
  setLLMHandler(handler: LLMHandler): void {
    this.llmHandler = handler;
  }
  
  async processAudioChunk(chunk: AudioChunk): Promise<void> {
    if (!this.options.includeAudio) return;
    
    const batch = this.getOrCreateBatch(chunk.sessionId);
    batch.audio.push(chunk.data as Buffer);
    
    this.checkBatchSize(chunk.sessionId);
  }
  
  async processTranscription(sessionId: string, result: TranscriptionResult): Promise<void> {
    if (!this.options.includeTranscript) return;
    
    const batch = this.getOrCreateBatch(sessionId);
    batch.transcripts.push(result);
    
    this.checkBatchSize(sessionId);
  }
  
  private getOrCreateBatch(sessionId: string) {
    if (!this.batchMap.has(sessionId)) {
      const batch = {
        audio: [],
        transcripts: [],
        metadata: {}
      };
      
      // Set batch timeout
      const timer = setTimeout(() => {
        this.processBatch(sessionId);
      }, this.options.batchTimeout);
      
      this.batchMap.set(sessionId, { ...batch, timer });
    }
    
    return this.batchMap.get(sessionId)!;
  }
  
  private checkBatchSize(sessionId: string): void {
    const batch = this.batchMap.get(sessionId);
    if (!batch) return;
    
    const totalItems = batch.audio.length + batch.transcripts.length;
    if (totalItems >= this.options.maxBatchSize!) {
      this.processBatch(sessionId);
    }
  }
  
  private async processBatch(sessionId: string): Promise<void> {
    const batch = this.batchMap.get(sessionId);
    if (!batch) return;
    
    // Clear timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }
    
    // Remove from map
    this.batchMap.delete(sessionId);
    
    // Skip if batch is empty
    if (batch.audio.length === 0 && batch.transcripts.length === 0) {
      return;
    }
    
    // Create LLM request
    const request: LLMRequest = {
      sessionId,
      timestamp: Date.now(),
      metadata: batch.metadata
    };
    
    if (batch.audio.length > 0) {
      request.audio = Buffer.concat(batch.audio);
    }
    
    if (batch.transcripts.length > 0) {
      request.transcript = batch.transcripts
        .map(t => t.transcript)
        .filter(Boolean)
        .join(' ');
      request.transcriptionResults = batch.transcripts;
    }
    
    // Emit request event
    this.emit('llm-request', request);
    
    // Process with handler if available
    if (this.llmHandler) {
      const startTime = Date.now();
      
      try {
        const response = await this.llmHandler(request);
        response.processingTime = Date.now() - startTime;
        this.emit('llm-response', response);
      } catch (error) {
        console.error(`LLM processing error for session ${sessionId}:`, error);
        this.emit('llm-error', { sessionId, error: error as Error });
      }
    }
  }
  
  async flushSession(sessionId: string): Promise<void> {
    await this.processBatch(sessionId);
  }
  
  async flushAll(): Promise<void> {
    const sessions = Array.from(this.batchMap.keys());
    await Promise.all(sessions.map(sessionId => this.processBatch(sessionId)));
  }
  
  updateMetadata(sessionId: string, metadata: Record<string, any>): void {
    const batch = this.getOrCreateBatch(sessionId);
    batch.metadata = { ...batch.metadata, ...metadata };
  }
  
  cleanup(): void {
    // Clear all timers
    for (const batch of this.batchMap.values()) {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
    }
    
    this.batchMap.clear();
    this.removeAllListeners();
  }
}