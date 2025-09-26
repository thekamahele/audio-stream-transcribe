"use strict";
// ABOUTME: Type definitions for the audio-stream-transcribe module
// ABOUTME: Provides common interfaces and types used across the package
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingState = exports.ConnectionState = exports.TranscriptionProvider = void 0;
class TranscriptionProvider {
}
exports.TranscriptionProvider = TranscriptionProvider;
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["DISCONNECTED"] = "disconnected";
    ConnectionState["CONNECTING"] = "connecting";
    ConnectionState["CONNECTED"] = "connected";
    ConnectionState["RECONNECTING"] = "reconnecting";
    ConnectionState["ERROR"] = "error";
})(ConnectionState || (exports.ConnectionState = ConnectionState = {}));
var RecordingState;
(function (RecordingState) {
    RecordingState["IDLE"] = "idle";
    RecordingState["RECORDING"] = "recording";
    RecordingState["PAUSED"] = "paused";
    RecordingState["STOPPING"] = "stopping";
})(RecordingState || (exports.RecordingState = RecordingState = {}));
//# sourceMappingURL=types.js.map