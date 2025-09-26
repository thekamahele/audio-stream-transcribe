import { EventEmitter } from 'eventemitter3';
import { LLMHandler } from './LLMProcessor';
import { ServerOptions, ConnectionParams, ServerEvents } from '../common/types';
export declare class AudioStreamServer extends EventEmitter<ServerEvents> {
    private options;
    private wsManager;
    private transcriptionProvider;
    private llmProcessor;
    private sessionBuffers;
    private processingQueue;
    constructor(options: ServerOptions);
    private initialize;
    handleConnection(params: ConnectionParams): Promise<void>;
    private isJSON;
    private handleControlMessage;
    private handleAudioData;
    private processAudioBuffer;
    private processBufferedAudio;
    private handleDisconnection;
    sendToSession(sessionId: string, message: any): boolean;
    sendToUser(userId: string, message: any): number;
    broadcast(message: any): number;
    setLLMHandler(handler: LLMHandler): void;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=AudioStreamServer.d.ts.map