"use strict";
// ABOUTME: React hook for easy integration of audio streaming functionality
// ABOUTME: Provides a simple interface for audio recording and transcription in React apps
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAudioStream = useAudioStream;
const react_1 = require("react");
const AudioStreamClient_1 = require("../client/AudioStreamClient");
const types_1 = require("../common/types");
function useAudioStream(options) {
    const clientRef = (0, react_1.useRef)(null);
    const [connectionState, setConnectionState] = (0, react_1.useState)(types_1.ConnectionState.DISCONNECTED);
    const [recordingState, setRecordingState] = (0, react_1.useState)(types_1.RecordingState.IDLE);
    const [connectionError, setConnectionError] = (0, react_1.useState)(null);
    const [recordingError, setRecordingError] = (0, react_1.useState)(null);
    const [transcript, setTranscript] = (0, react_1.useState)('');
    const [lastTranscription, setLastTranscription] = (0, react_1.useState)(null);
    // Initialize client
    (0, react_1.useEffect)(() => {
        const client = new AudioStreamClient_1.AudioStreamClient({
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
            setTranscript((prev) => {
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
    const connect = (0, react_1.useCallback)(async () => {
        if (!clientRef.current)
            return;
        try {
            setConnectionError(null);
            await clientRef.current.connect();
        }
        catch (error) {
            setConnectionError(error);
            throw error;
        }
    }, []);
    const disconnect = (0, react_1.useCallback)(() => {
        clientRef.current?.disconnect();
    }, []);
    const startRecording = (0, react_1.useCallback)(async () => {
        if (!clientRef.current)
            return;
        try {
            setRecordingError(null);
            await clientRef.current.startRecording();
        }
        catch (error) {
            const err = error;
            setRecordingError(err);
            throw err;
        }
    }, []);
    const stopRecording = (0, react_1.useCallback)(async () => {
        if (!clientRef.current)
            return null;
        try {
            return await clientRef.current.stopRecording();
        }
        catch (error) {
            const err = error;
            setRecordingError(err);
            throw err;
        }
    }, []);
    const pauseRecording = (0, react_1.useCallback)(() => {
        if (!clientRef.current)
            return;
        try {
            clientRef.current.pauseRecording();
        }
        catch (error) {
            const err = error;
            setRecordingError(err);
            throw err;
        }
    }, []);
    const resumeRecording = (0, react_1.useCallback)(() => {
        if (!clientRef.current)
            return;
        try {
            clientRef.current.resumeRecording();
        }
        catch (error) {
            const err = error;
            setRecordingError(err);
            throw err;
        }
    }, []);
    const clearTranscript = (0, react_1.useCallback)(() => {
        setTranscript('');
        setLastTranscription(null);
    }, []);
    return {
        // Connection state
        isConnected: connectionState === types_1.ConnectionState.CONNECTED,
        isConnecting: connectionState === types_1.ConnectionState.CONNECTING,
        connectionState,
        connectionError,
        // Recording state
        isRecording: recordingState === types_1.RecordingState.RECORDING,
        isPaused: recordingState === types_1.RecordingState.PAUSED,
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
//# sourceMappingURL=useAudioStream.js.map