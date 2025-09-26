"use strict";
// ABOUTME: Client-side exports for the audio-stream-transcribe module
// ABOUTME: Provides access to browser-based audio recording and streaming
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingState = exports.ConnectionState = exports.AudioStreamClient = void 0;
var AudioStreamClient_1 = require("./AudioStreamClient");
Object.defineProperty(exports, "AudioStreamClient", { enumerable: true, get: function () { return AudioStreamClient_1.AudioStreamClient; } });
// Re-export common types needed by clients
var types_1 = require("../common/types");
Object.defineProperty(exports, "ConnectionState", { enumerable: true, get: function () { return types_1.ConnectionState; } });
Object.defineProperty(exports, "RecordingState", { enumerable: true, get: function () { return types_1.RecordingState; } });
//# sourceMappingURL=index.js.map