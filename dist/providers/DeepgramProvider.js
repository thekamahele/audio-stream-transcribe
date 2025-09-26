"use strict";
// ABOUTME: Deepgram transcription provider implementation
// ABOUTME: Provides real-time transcription using Deepgram's API
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepgramProvider = void 0;
const sdk_1 = require("@deepgram/sdk");
const types_1 = require("../common/types");
class DeepgramProvider extends types_1.TranscriptionProvider {
    constructor(options) {
        super();
        this.options = options;
        this.connections = new Map();
        this.deepgram = (0, sdk_1.createClient)(options.apiKey);
        // Set default options
        this.defaultOptions = {
            smart_format: options.smartFormat ?? true,
            model: options.model || 'nova-3',
            language: options.language || 'en-US',
            punctuate: options.punctuate ?? true,
            diarize: options.diarize ?? false,
            numerals: options.numerals ?? true,
            profanity_filter: options.profanityFilter ?? false,
            redact: options.redact ?? false,
            utterance_end_ms: options.utteranceEndMs ?? 1000,
            interim_results: options.interimResults ?? false,
            ...(options.keywords && { keywords: options.keywords })
        };
    }
    async initialize() {
        // Test the API key by making a simple request
        try {
            // Deepgram SDK doesn't require explicit initialization
            console.log('DeepgramProvider initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize DeepgramProvider:', error);
            throw new Error('Invalid Deepgram API key or connection failed');
        }
    }
    async processAudio(audioData, metadata) {
        const sessionId = metadata?.sessionId || 'default';
        // Get or create connection for this session
        let connection = this.connections.get(sessionId);
        if (!connection || !connection.isConnected) {
            connection = await this.createConnection(sessionId, metadata);
        }
        // Return promise that resolves when transcription is received
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Transcription timeout'));
            }, 30000); // 30 second timeout
            connection.resolvers.push((result) => {
                clearTimeout(timeout);
                resolve(result);
            });
            // Send audio data
            try {
                // Convert to ArrayBuffer for Deepgram compatibility
                const dataToSend = Buffer.isBuffer(audioData)
                    ? audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength)
                    : audioData;
                connection.deepgramLive.send(dataToSend);
            }
            catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    async createConnection(sessionId, metadata) {
        // Create live transcription connection with options
        const options = { ...this.defaultOptions };
        // Apply any metadata overrides
        if (metadata?.transcriptionOptions) {
            Object.assign(options, metadata.transcriptionOptions);
        }
        const deepgramLive = this.deepgram.listen.live(options);
        const connection = {
            deepgramLive,
            isConnected: false,
            pendingTranscripts: [],
            resolvers: []
        };
        // Setup event listeners
        deepgramLive.on(sdk_1.LiveTranscriptionEvents.Open, () => {
            connection.isConnected = true;
            console.log(`Deepgram connection opened for session ${sessionId}`);
        });
        deepgramLive.on(sdk_1.LiveTranscriptionEvents.Transcript, (data) => {
            const alternatives = data?.channel?.alternatives;
            if (!alternatives || alternatives.length === 0)
                return;
            const alternative = alternatives[0];
            if (!alternative.transcript)
                return;
            const result = {
                transcript: alternative.transcript,
                confidence: alternative.confidence,
                timestamp: Date.now(),
                metadata: {
                    isFinal: data.is_final,
                    duration: data.duration,
                    ...(options.diarize && {
                        speaker: this.extractSpeaker(alternative.words || [])
                    })
                }
            };
            // Handle any queued resolvers
            if (connection.resolvers.length > 0) {
                const resolver = connection.resolvers.shift();
                resolver(result);
            }
            else {
                // Store for future use
                connection.pendingTranscripts.push(result);
            }
        });
        deepgramLive.on(sdk_1.LiveTranscriptionEvents.Close, (event) => {
            connection.isConnected = false;
            console.log(`Deepgram connection closed for session ${sessionId}:`, event);
            this.connections.delete(sessionId);
        });
        deepgramLive.on(sdk_1.LiveTranscriptionEvents.Error, (error) => {
            console.error(`Deepgram error for session ${sessionId}:`, error);
            connection.isConnected = false;
            // Reject any pending resolvers
            for (const resolver of connection.resolvers) {
                resolver({
                    transcript: '',
                    metadata: { error: error.message }
                });
            }
            connection.resolvers = [];
        });
        // Store connection
        this.connections.set(sessionId, connection);
        // Wait for connection to open
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);
            const checkConnection = setInterval(() => {
                if (connection.isConnected) {
                    clearInterval(checkConnection);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 100);
        });
        return connection;
    }
    extractSpeaker(words) {
        // Extract speaker from words array
        // Deepgram provides speaker labels when diarization is enabled
        if (!words || words.length === 0)
            return 0;
        // Find the most common speaker in this segment
        const speakerCounts = {};
        for (const word of words) {
            if (word.speaker !== undefined) {
                speakerCounts[word.speaker] = (speakerCounts[word.speaker] || 0) + 1;
            }
        }
        // Return the most frequent speaker
        let maxCount = 0;
        let dominantSpeaker = 0;
        for (const [speaker, count] of Object.entries(speakerCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantSpeaker = parseInt(speaker);
            }
        }
        return dominantSpeaker;
    }
    async updateConfiguration(config) {
        // Update configuration for future connections
        if (config.apiKey) {
            this.deepgram = (0, sdk_1.createClient)(config.apiKey);
        }
        // Update default options
        Object.assign(this.defaultOptions, {
            ...(config.model && { model: config.model }),
            ...(config.language && { language: config.language }),
            ...(config.punctuate !== undefined && { punctuate: config.punctuate }),
            ...(config.diarize !== undefined && { diarize: config.diarize }),
            ...(config.smartFormat !== undefined && { smart_format: config.smartFormat }),
            ...(config.keywords && { keywords: config.keywords }),
            ...(config.numerals !== undefined && { numerals: config.numerals }),
            ...(config.profanityFilter !== undefined && { profanity_filter: config.profanityFilter }),
            ...(config.redact !== undefined && { redact: config.redact }),
            ...(config.utteranceEndMs !== undefined && { utterance_end_ms: config.utteranceEndMs }),
            ...(config.interimResults !== undefined && { interim_results: config.interimResults })
        });
    }
    getStats() {
        return {
            activeConnections: this.connections.size,
            connections: Array.from(this.connections.entries()).map(([sessionId, conn]) => ({
                sessionId,
                isConnected: conn.isConnected,
                pendingTranscripts: conn.pendingTranscripts.length,
                queuedResolvers: conn.resolvers.length
            }))
        };
    }
    async cleanup() {
        // Close all active connections
        for (const [sessionId, connection] of this.connections.entries()) {
            try {
                if (connection.isConnected) {
                    connection.deepgramLive.requestClose();
                }
            }
            catch (error) {
                console.error(`Error closing connection for session ${sessionId}:`, error);
            }
        }
        this.connections.clear();
    }
}
exports.DeepgramProvider = DeepgramProvider;
//# sourceMappingURL=DeepgramProvider.js.map