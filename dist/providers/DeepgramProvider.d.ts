import { TranscriptionProvider, TranscriptionResult } from '../common/types';
export interface DeepgramProviderOptions {
    apiKey: string;
    model?: string;
    language?: string;
    punctuate?: boolean;
    diarize?: boolean;
    smartFormat?: boolean;
    keywords?: string[];
    numerals?: boolean;
    profanityFilter?: boolean;
    redact?: boolean;
    utteranceEndMs?: number;
    interimResults?: boolean;
}
export declare class DeepgramProvider extends TranscriptionProvider {
    private options;
    private deepgram;
    private connections;
    private defaultOptions;
    constructor(options: DeepgramProviderOptions);
    initialize(): Promise<void>;
    processAudio(audioData: Buffer | ArrayBuffer, metadata?: any): Promise<TranscriptionResult>;
    private createConnection;
    private extractSpeaker;
    updateConfiguration(config: Partial<DeepgramProviderOptions>): Promise<void>;
    getStats(): any;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=DeepgramProvider.d.ts.map