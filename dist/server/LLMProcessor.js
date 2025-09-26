"use strict";
// ABOUTME: LLM processor for handling audio and transcription data
// ABOUTME: Provides hooks for sending audio/transcripts to language models
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMProcessor = void 0;
const eventemitter3_1 = require("eventemitter3");
class LLMProcessor extends eventemitter3_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.batchMap = new Map();
        this.llmHandler = null;
        // Set defaults
        this.options.batchTimeout = options.batchTimeout ?? 5000; // 5 seconds
        this.options.maxBatchSize = options.maxBatchSize ?? 10;
        this.options.includeAudio = options.includeAudio ?? false;
        this.options.includeTranscript = options.includeTranscript ?? true;
    }
    setLLMHandler(handler) {
        this.llmHandler = handler;
    }
    async processAudioChunk(chunk) {
        if (!this.options.includeAudio)
            return;
        const batch = this.getOrCreateBatch(chunk.sessionId);
        batch.audio.push(chunk.data);
        this.checkBatchSize(chunk.sessionId);
    }
    async processTranscription(sessionId, result) {
        if (!this.options.includeTranscript)
            return;
        const batch = this.getOrCreateBatch(sessionId);
        batch.transcripts.push(result);
        this.checkBatchSize(sessionId);
    }
    getOrCreateBatch(sessionId) {
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
        return this.batchMap.get(sessionId);
    }
    checkBatchSize(sessionId) {
        const batch = this.batchMap.get(sessionId);
        if (!batch)
            return;
        const totalItems = batch.audio.length + batch.transcripts.length;
        if (totalItems >= this.options.maxBatchSize) {
            this.processBatch(sessionId);
        }
    }
    async processBatch(sessionId) {
        const batch = this.batchMap.get(sessionId);
        if (!batch)
            return;
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
        const request = {
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
            }
            catch (error) {
                console.error(`LLM processing error for session ${sessionId}:`, error);
                this.emit('llm-error', { sessionId, error: error });
            }
        }
    }
    async flushSession(sessionId) {
        await this.processBatch(sessionId);
    }
    async flushAll() {
        const sessions = Array.from(this.batchMap.keys());
        await Promise.all(sessions.map(sessionId => this.processBatch(sessionId)));
    }
    updateMetadata(sessionId, metadata) {
        const batch = this.getOrCreateBatch(sessionId);
        batch.metadata = { ...batch.metadata, ...metadata };
    }
    cleanup() {
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
exports.LLMProcessor = LLMProcessor;
//# sourceMappingURL=LLMProcessor.js.map