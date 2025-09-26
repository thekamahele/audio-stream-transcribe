import { ConnectionState, RecordingState, TranscriptionResult, ClientOptions } from '../common/types';
export interface UseAudioStreamOptions extends Partial<ClientOptions> {
    websocketUrl: string;
    autoConnect?: boolean;
    onTranscription?: (result: TranscriptionResult) => void;
    onError?: (error: Error) => void;
    onConnectionStateChange?: (state: ConnectionState) => void;
    onRecordingStateChange?: (state: RecordingState) => void;
}
export interface UseAudioStreamResult {
    isConnected: boolean;
    isConnecting: boolean;
    connectionState: ConnectionState;
    connectionError: Error | null;
    isRecording: boolean;
    isPaused: boolean;
    recordingState: RecordingState;
    recordingError: Error | null;
    transcript: string;
    lastTranscription: TranscriptionResult | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    pauseRecording: () => void;
    resumeRecording: () => void;
    clearTranscript: () => void;
}
export declare function useAudioStream(options: UseAudioStreamOptions): UseAudioStreamResult;
//# sourceMappingURL=useAudioStream.d.ts.map