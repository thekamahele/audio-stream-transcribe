"use strict";
// ABOUTME: Client-side audio streaming implementation for browser environments
// ABOUTME: Handles audio recording, WebSocket communication, and event management
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStreamClient = void 0;
const eventemitter3_1 = require("eventemitter3");
const types_1 = require("../common/types");
class AudioStreamClient extends eventemitter3_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.ws = null;
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.connectionState = types_1.ConnectionState.DISCONNECTED;
        this.recordingState = types_1.RecordingState.IDLE;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.pongTimer = null;
        this.audioChunkTimer = null;
        this.recordedChunks = [];
    }
    async connect() {
        if (this.connectionState === types_1.ConnectionState.CONNECTED) {
            return;
        }
        this.setConnectionState(types_1.ConnectionState.CONNECTING);
        try {
            await this.establishConnection();
        }
        catch (error) {
            this.setConnectionState(types_1.ConnectionState.ERROR);
            throw error;
        }
    }
    async establishConnection() {
        return new Promise((resolve, reject) => {
            const url = new URL(this.options.websocketUrl);
            // Add auth token if provided
            if (this.options.authToken) {
                url.searchParams.set('token', this.options.authToken);
            }
            this.ws = new WebSocket(url.toString());
            this.ws.onopen = () => {
                this.setConnectionState(types_1.ConnectionState.CONNECTED);
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
                if (this.connectionState === types_1.ConnectionState.CONNECTING) {
                    reject(new Error('Failed to connect'));
                }
            };
            // Set connection timeout
            setTimeout(() => {
                if (this.connectionState === types_1.ConnectionState.CONNECTING) {
                    this.ws?.close();
                    reject(new Error('Connection timeout'));
                }
            }, 10000); // 10 second timeout
        });
    }
    handleMessage(data) {
        if (typeof data !== 'string')
            return;
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
        }
        catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
    handleTranscription(data) {
        this.emit('transcription', data);
    }
    handleDisconnection(reason) {
        this.stopPingInterval();
        this.setConnectionState(types_1.ConnectionState.DISCONNECTED);
        this.emit('disconnected', reason);
        // Stop recording if active
        if (this.recordingState !== types_1.RecordingState.IDLE) {
            this.stopRecording().catch(console.error);
        }
        // Attempt reconnection if enabled
        if (this.options.reconnect &&
            this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
            this.scheduleReconnection();
        }
    }
    scheduleReconnection() {
        if (this.reconnectTimer)
            return;
        this.setConnectionState(types_1.ConnectionState.RECONNECTING);
        const delay = Math.min((this.options.reconnectDelay || 1000) * Math.pow(2, this.reconnectAttempts), 30000 // Max 30 seconds
        );
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts++;
            this.connect().catch(console.error);
        }, delay);
    }
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.setConnectionState(types_1.ConnectionState.DISCONNECTED);
    }
    async startRecording() {
        if (this.recordingState !== types_1.RecordingState.IDLE) {
            throw new Error('Recording already in progress');
        }
        if (this.connectionState !== types_1.ConnectionState.CONNECTED) {
            throw new Error('Not connected to server');
        }
        this.setRecordingState(types_1.RecordingState.RECORDING);
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
        }
        catch (error) {
            this.setRecordingState(types_1.RecordingState.IDLE);
            throw error;
        }
    }
    async stopRecording() {
        if (this.recordingState === types_1.RecordingState.IDLE) {
            return null;
        }
        this.setRecordingState(types_1.RecordingState.STOPPING);
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
        this.setRecordingState(types_1.RecordingState.IDLE);
        return recordedBlob;
    }
    pauseRecording() {
        if (this.recordingState !== types_1.RecordingState.RECORDING) {
            throw new Error('Not currently recording');
        }
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            this.setRecordingState(types_1.RecordingState.PAUSED);
            this.sendMessage({ type: 'pause-recording' });
        }
    }
    resumeRecording() {
        if (this.recordingState !== types_1.RecordingState.PAUSED) {
            throw new Error('Recording not paused');
        }
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            this.setRecordingState(types_1.RecordingState.RECORDING);
            this.sendMessage({ type: 'resume-recording' });
        }
    }
    getSupportedMimeType() {
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
    sendAudioData(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Convert blob to ArrayBuffer and send
            data.arrayBuffer().then(buffer => {
                this.ws?.send(buffer);
            }).catch(error => {
                console.error('Failed to send audio data:', error);
            });
        }
    }
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    startPingInterval() {
        const interval = this.options.pingInterval || 30000; // 30 seconds
        this.pingTimer = setInterval(() => {
            this.sendPing();
        }, interval);
    }
    stopPingInterval() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }
    sendPing() {
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
    handlePong() {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }
    setConnectionState(state) {
        if (this.connectionState !== state) {
            this.connectionState = state;
            this.emit('connection-state', state);
        }
    }
    setRecordingState(state) {
        if (this.recordingState !== state) {
            this.recordingState = state;
            this.emit('recording-state', state);
        }
    }
    getConnectionState() {
        return this.connectionState;
    }
    getRecordingState() {
        return this.recordingState;
    }
    isConnected() {
        return this.connectionState === types_1.ConnectionState.CONNECTED;
    }
    isRecording() {
        return this.recordingState === types_1.RecordingState.RECORDING;
    }
}
exports.AudioStreamClient = AudioStreamClient;
//# sourceMappingURL=AudioStreamClient.js.map