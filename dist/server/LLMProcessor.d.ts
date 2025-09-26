import { EventEmitter } from 'eventemitter3';
import { TranscriptionResult, AudioChunk } from '../common/types';
export interface LLMProcessorOptions {
    batchTimeout?: number;
    maxBatchSize?: number;
    includeAudio?: boolean;
    includeTranscript?: boolean;
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
    'llm-error': (error: {
        sessionId: string;
        error: Error;
    }) => void;
}
export declare class LLMProcessor extends EventEmitter<LLMProcessorEvents> {
    private options;
    private batchMap;
    private llmHandler;
    constructor(options?: LLMProcessorOptions);
    setLLMHandler(handler: LLMHandler): void;
    processAudioChunk(chunk: AudioChunk): Promise<void>;
    processTranscription(sessionId: string, result: TranscriptionResult): Promise<void>;
    private getOrCreateBatch;
    private checkBatchSize;
    private processBatch;
    flushSession(sessionId: string): Promise<void>;
    flushAll(): Promise<void>;
    updateMetadata(sessionId: string, metadata: Record<string, any>): void;
    cleanup(): void;
}
//# sourceMappingURL=LLMProcessor.d.ts.map