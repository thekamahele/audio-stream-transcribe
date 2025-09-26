"use strict";
// ABOUTME: Main server class for audio streaming and transcription
// ABOUTME: Coordinates WebSocket connections, audio processing, and transcription
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStreamServer = void 0;
const eventemitter3_1 = require("eventemitter3");
const WebSocketManager_1 = require("./WebSocketManager");
const LLMProcessor_1 = require("./LLMProcessor");
class AudioStreamServer extends eventemitter3_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.llmProcessor = null;
        this.sessionBuffers = new Map();
        this.processingQueue = new Map();
        this.transcriptionProvider = options.transcriptionProvider;
        this.wsManager = new WebSocketManager_1.WebSocketManager({
            pingInterval: options.pingInterval,
            pongTimeout: options.pongTimeout,
            maxConnectionsPerUser: options.maxConnectionsPerUser
        });
        // Setup LLM processor if enabled
        if (options.enableLLMProcessing) {
            this.llmProcessor = new LLMProcessor_1.LLMProcessor({
                includeAudio: true,
                includeTranscript: true
            });
            // Forward LLM events
            this.llmProcessor.on('llm-request', (request) => {
                this.emit('llm-request', request);
            });
        }
        this.initialize();
    }
    async initialize() {
        try {
            await this.transcriptionProvider.initialize();
        }
        catch (error) {
            console.error('Failed to initialize transcription provider:', error);
            throw error;
        }
    }
    async handleConnection(params) {
        const { websocket, sessionId, userId, metadata } = params;
        // Add connection to manager
        const added = this.wsManager.addConnection({
            ws: websocket,
            sessionId,
            userId,
            metadata
        });
        if (!added) {
            websocket.close(1008, 'Max connections exceeded');
            return;
        }
        // Initialize session buffer
        this.sessionBuffers.set(sessionId, []);
        // Emit connection event
        this.emit('connection', { sessionId, userId });
        // Setup message handlers
        websocket.on('message', async (data) => {
            try {
                // Try to parse as JSON first
                if (typeof data === 'string' || (data instanceof Buffer && this.isJSON(data))) {
                    const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
                    await this.handleControlMessage(sessionId, message);
                }
                else {
                    // Handle as audio data
                    await this.handleAudioData(sessionId, data);
                }
            }
            catch (error) {
                console.error(`Error handling message for session ${sessionId}:`, error);
                this.emit('error', { sessionId, error: error });
            }
        });
        websocket.on('close', (code, reason) => {
            this.handleDisconnection(sessionId, reason.toString());
        });
        websocket.on('error', (error) => {
            console.error(`WebSocket error for session ${sessionId}:`, error);
            this.emit('error', { sessionId, error });
        });
    }
    isJSON(data) {
        try {
            JSON.parse(data.toString());
            return true;
        }
        catch {
            return false;
        }
    }
    async handleControlMessage(sessionId, message) {
        const connection = this.wsManager.getConnection(sessionId);
        if (!connection)
            return;
        switch (message.type) {
            case 'ping':
                this.wsManager.sendMessage(sessionId, { type: 'pong' });
                break;
            case 'start-recording':
                connection.metadata = { ...connection.metadata, isRecording: true };
                this.wsManager.sendMessage(sessionId, {
                    type: 'recording-started',
                    timestamp: Date.now()
                });
                break;
            case 'stop-recording':
                connection.metadata = { ...connection.metadata, isRecording: false };
                // Process any remaining buffered audio
                await this.processBufferedAudio(sessionId);
                this.wsManager.sendMessage(sessionId, {
                    type: 'recording-stopped',
                    timestamp: Date.now()
                });
                break;
            case 'pause-recording':
                connection.metadata = { ...connection.metadata, isPaused: true };
                this.wsManager.sendMessage(sessionId, {
                    type: 'recording-paused',
                    timestamp: Date.now()
                });
                break;
            case 'resume-recording':
                connection.metadata = { ...connection.metadata, isPaused: false };
                this.wsManager.sendMessage(sessionId, {
                    type: 'recording-resumed',
                    timestamp: Date.now()
                });
                break;
            default:
                console.warn(`Unknown control message type: ${message.type}`);
        }
    }
    async handleAudioData(sessionId, audioData) {
        const connection = this.wsManager.getConnection(sessionId);
        if (!connection || connection.metadata?.isPaused) {
            return;
        }
        // Add to buffer
        const buffer = this.sessionBuffers.get(sessionId);
        if (!buffer)
            return;
        buffer.push(audioData);
        // Emit audio chunk event
        const chunk = {
            data: audioData,
            timestamp: Date.now(),
            format: connection.metadata?.audioFormat || { mimeType: 'audio/webm' },
            sessionId
        };
        this.emit('audio-chunk', chunk);
        // Process with LLM if enabled
        if (this.llmProcessor) {
            this.llmProcessor.processAudioChunk(chunk).catch(console.error);
        }
        // Process audio if not already processing
        if (!this.processingQueue.has(sessionId)) {
            const processingPromise = this.processAudioBuffer(sessionId);
            this.processingQueue.set(sessionId, processingPromise);
            try {
                await processingPromise;
            }
            finally {
                this.processingQueue.delete(sessionId);
            }
        }
    }
    async processAudioBuffer(sessionId) {
        const buffer = this.sessionBuffers.get(sessionId);
        if (!buffer || buffer.length === 0)
            return;
        const connection = this.wsManager.getConnection(sessionId);
        if (!connection)
            return;
        // Get all buffered audio and clear buffer
        const audioChunks = buffer.splice(0, buffer.length);
        const combinedAudio = Buffer.concat(audioChunks);
        try {
            // Send to transcription provider
            const result = await this.transcriptionProvider.processAudio(combinedAudio, connection.metadata);
            if (result.transcript) {
                // Send transcription to client
                this.wsManager.sendMessage(sessionId, {
                    type: 'transcription',
                    data: result
                });
                // Emit transcription event
                this.emit('transcription', {
                    ...result,
                    sessionId
                });
                // Process with LLM if enabled
                if (this.llmProcessor) {
                    this.llmProcessor.processTranscription(sessionId, result).catch(console.error);
                }
            }
        }
        catch (error) {
            console.error(`Transcription error for session ${sessionId}:`, error);
            this.emit('error', { sessionId, error: error });
        }
    }
    async processBufferedAudio(sessionId) {
        // Wait for any ongoing processing
        const ongoingProcessing = this.processingQueue.get(sessionId);
        if (ongoingProcessing) {
            await ongoingProcessing;
        }
        // Process any remaining buffered audio
        await this.processAudioBuffer(sessionId);
    }
    handleDisconnection(sessionId, reason) {
        const connection = this.wsManager.getConnection(sessionId);
        if (!connection)
            return;
        // Flush any pending LLM batches
        if (this.llmProcessor) {
            this.llmProcessor.flushSession(sessionId).catch(console.error);
        }
        // Clean up session data
        this.sessionBuffers.delete(sessionId);
        this.processingQueue.delete(sessionId);
        // Remove from manager
        this.wsManager.removeConnection(sessionId);
        // Emit disconnection event
        this.emit('disconnection', {
            sessionId,
            userId: connection.userId,
            reason
        });
    }
    sendToSession(sessionId, message) {
        return this.wsManager.sendMessage(sessionId, message);
    }
    sendToUser(userId, message) {
        const connections = this.wsManager.getConnectionsByUser(userId);
        let sent = 0;
        for (const conn of connections) {
            if (this.wsManager.sendMessage(conn.sessionId, message)) {
                sent++;
            }
        }
        return sent;
    }
    broadcast(message) {
        return this.wsManager.broadcast(message);
    }
    setLLMHandler(handler) {
        if (!this.llmProcessor) {
            throw new Error('LLM processing is not enabled. Set enableLLMProcessing: true in options.');
        }
        this.llmProcessor.setLLMHandler(handler);
    }
    async cleanup() {
        // Flush any pending LLM batches
        if (this.llmProcessor) {
            await this.llmProcessor.flushAll();
            this.llmProcessor.cleanup();
        }
        // Clean up all connections
        this.wsManager.cleanup();
        // Clean up buffers
        this.sessionBuffers.clear();
        this.processingQueue.clear();
        // Clean up transcription provider
        await this.transcriptionProvider.cleanup();
        // Remove all event listeners
        this.removeAllListeners();
    }
}
exports.AudioStreamServer = AudioStreamServer;
//# sourceMappingURL=AudioStreamServer.js.map