# Audio Stream Transcribe

A standalone module for real-time audio recording, streaming, transcription, and LLM processing.

## Features

- 🎤 Real-time audio recording from browser
- 🌊 WebSocket-based audio streaming
- 🎯 Pluggable transcription providers (Deepgram included)
- 🤖 LLM integration support for audio processing
- 📝 Event-based architecture for easy integration
- 🔌 Provider-agnostic design for easy switching

## Installation

```bash
npm install audio-stream-transcribe
```

## Quick Start

### Server Setup

```javascript
const { AudioStreamServer, DeepgramProvider } = require('audio-stream-transcribe');

// Create server with Deepgram transcription
const audioServer = new AudioStreamServer({
  transcriptionProvider: new DeepgramProvider({
    apiKey: process.env.DEEPGRAM_API_KEY,
    model: 'nova-3-medical',
    language: 'en-US',
    diarize: true,
  }),
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const sessionId = generateSessionId();
  
  audioServer.handleConnection({
    websocket: ws,
    sessionId,
    userId: req.userId,
    metadata: { /* any additional data */ }
  });
  
  // Listen to transcription events
  audioServer.on('transcription', ({ sessionId, transcript, speaker }) => {
    console.log(`[${speaker}]: ${transcript}`);
  });
  
  // Listen to audio chunks for LLM processing
  audioServer.on('audio-chunk', async ({ sessionId, audio, format }) => {
    // Process with your LLM
    const result = await processWithLLM(audio);
    audioServer.emit('llm-result', { sessionId, result });
  });
});
```

### Client Setup

```javascript
import { AudioStreamClient } from 'audio-stream-transcribe/client';

const audioClient = new AudioStreamClient({
  websocketUrl: 'wss://your-server.com/audio',
  reconnect: true,
  reconnectDelay: 1000,
});

// Connect and start recording
await audioClient.connect();
await audioClient.startRecording();

// Listen to events
audioClient.on('transcription', (data) => {
  console.log('Transcription:', data.transcript);
});

audioClient.on('connection-state', (state) => {
  console.log('Connection state:', state);
});

// Pause/Resume
await audioClient.pauseRecording();
await audioClient.resumeRecording();

// Stop and cleanup
await audioClient.stopRecording();
audioClient.disconnect();
```

## Custom Transcription Providers

You can easily add support for other transcription services:

```javascript
class OpenAIWhisperProvider extends TranscriptionProvider {
  async initialize() {
    // Setup OpenAI client
  }
  
  async processAudio(audioData, metadata) {
    // Send to Whisper API
    const result = await this.whisperClient.transcribe(audioData);
    return {
      transcript: result.text,
      speaker: result.speaker,
      confidence: result.confidence,
    };
  }
  
  async cleanup() {
    // Cleanup resources
  }
}

// Use it
const audioServer = new AudioStreamServer({
  transcriptionProvider: new OpenAIWhisperProvider({
    apiKey: process.env.OPENAI_API_KEY,
  }),
});
```

## React Hook

```jsx
import { useAudioStream } from 'audio-stream-transcribe/react';

function RecordingComponent() {
  const {
    isConnected,
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioStream({
    websocketUrl: 'wss://your-server.com/audio',
    onTranscription: (data) => {
      console.log('New transcription:', data);
    },
  });
  
  return (
    <div>
      <button onClick={startRecording} disabled={!isConnected || isRecording}>
        Start Recording
      </button>
      <div>{transcript}</div>
    </div>
  );
}
```

## API Reference

### AudioStreamServer

- `constructor(options)`: Create a new server instance
- `handleConnection(params)`: Handle a new WebSocket connection
- `on(event, callback)`: Listen to events
- `emit(event, data)`: Emit custom events

### AudioStreamClient

- `connect()`: Connect to the WebSocket server
- `disconnect()`: Disconnect from the server
- `startRecording()`: Start audio recording
- `stopRecording()`: Stop audio recording
- `pauseRecording()`: Pause recording
- `resumeRecording()`: Resume recording
- `on(event, callback)`: Listen to events

### Events

Server events:
- `connection`: New client connected
- `disconnection`: Client disconnected
- `transcription`: New transcription available
- `audio-chunk`: Raw audio chunk received
- `error`: Error occurred

Client events:
- `connected`: Connected to server
- `disconnected`: Disconnected from server
- `transcription`: New transcription received
- `error`: Error occurred
- `connection-state`: Connection state changed

## License

MIT