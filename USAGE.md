# Audio Stream Transcribe - Usage Guide

This guide provides detailed instructions on how to use the audio-stream-transcribe module.

## Table of Contents
- [Installation](#installation)
- [Server Setup](#server-setup)
- [Client Setup](#client-setup)
- [React Integration](#react-integration)
- [LLM Integration](#llm-integration)
- [Custom Providers](#custom-providers)
- [Advanced Configuration](#advanced-configuration)

## Installation

```bash
npm install audio-stream-transcribe

# Install peer dependencies if needed
npm install ws @deepgram/sdk eventemitter3
```

## Server Setup

### Basic Server

```javascript
const { AudioStreamServer, DeepgramProvider } = require('audio-stream-transcribe');
const WebSocket = require('ws');

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Create audio server
const audioServer = new AudioStreamServer({
  transcriptionProvider: new DeepgramProvider({
    apiKey: process.env.DEEPGRAM_API_KEY,
    model: 'nova-3-medical', // Use medical model for healthcare
    language: 'en-US',
    diarize: true // Enable speaker detection
  })
});

// Handle connections
wss.on('connection', (ws, req) => {
  audioServer.handleConnection({
    websocket: ws,
    sessionId: generateSessionId(),
    userId: extractUserId(req),
    metadata: { /* custom data */ }
  });
});
```

### With Authentication

```javascript
wss.on('connection', async (ws, req) => {
  const token = extractToken(req);
  
  try {
    const user = await validateToken(token);
    
    audioServer.handleConnection({
      websocket: ws,
      sessionId: generateSessionId(),
      userId: user.id,
      metadata: { user }
    });
  } catch (error) {
    ws.close(1008, 'Authentication failed');
  }
});
```

### Event Handling

```javascript
// Connection events
audioServer.on('connection', ({ sessionId, userId }) => {
  console.log(`User ${userId} connected with session ${sessionId}`);
});

audioServer.on('disconnection', ({ sessionId, userId, reason }) => {
  console.log(`User ${userId} disconnected: ${reason}`);
});

// Transcription events
audioServer.on('transcription', async ({ sessionId, transcript, speaker, confidence }) => {
  // Save to database
  await db.transcriptions.create({
    sessionId,
    transcript,
    speaker,
    confidence,
    timestamp: new Date()
  });
  
  // Send to other connected clients if needed
  audioServer.sendToSession(sessionId, {
    type: 'transcription-saved',
    id: transcription.id
  });
});

// Error handling
audioServer.on('error', ({ sessionId, error }) => {
  console.error(`Error in session ${sessionId}:`, error);
  // Log to error tracking service
});
```

## Client Setup

### Vanilla JavaScript

```javascript
import { AudioStreamClient } from 'audio-stream-transcribe/client';

const client = new AudioStreamClient({
  websocketUrl: 'wss://api.example.com/audio',
  authToken: localStorage.getItem('authToken'),
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5
});

// Connect
await client.connect();

// Start recording
await client.startRecording();

// Listen to transcriptions
client.on('transcription', (result) => {
  console.log('Transcript:', result.transcript);
  updateUI(result);
});

// Handle connection state
client.on('connection-state', (state) => {
  updateConnectionStatus(state);
});

// Stop and get recording
const recordingBlob = await client.stopRecording();
```

### Error Handling

```javascript
client.on('error', (error) => {
  if (error.message.includes('microphone')) {
    showMicrophoneError();
  } else if (error.message.includes('connection')) {
    showConnectionError();
  } else {
    showGenericError(error);
  }
});
```

## React Integration

### Basic Hook Usage

```jsx
import { useAudioStream } from 'audio-stream-transcribe/react';

function TranscriptionComponent() {
  const {
    isConnected,
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    connectionError
  } = useAudioStream({
    websocketUrl: 'wss://api.example.com/audio',
    authToken: useAuthToken()
  });
  
  return (
    <div>
      <button 
        onClick={startRecording} 
        disabled={!isConnected || isRecording}
      >
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>
      
      {transcript && (
        <div className="transcript">{transcript}</div>
      )}
      
      {connectionError && (
        <div className="error">{connectionError.message}</div>
      )}
    </div>
  );
}
```

### Advanced React Usage

```jsx
function MedicalTranscription() {
  const [notes, setNotes] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  
  const {
    isRecording,
    lastTranscription,
    startRecording,
    stopRecording
  } = useAudioStream({
    websocketUrl: 'wss://api.medical.com/audio',
    onTranscription: (result) => {
      // Update notes with speaker information
      setNotes(prev => [...prev, {
        text: result.transcript,
        speaker: result.speaker || 'Unknown',
        timestamp: Date.now(),
        confidence: result.confidence
      }]);
      
      setCurrentSpeaker(result.speaker);
    }
  });
  
  const exportNotes = () => {
    const formatted = notes.map(note => 
      `[${note.speaker}]: ${note.text}`
    ).join('\n');
    
    downloadAsFile(formatted, 'medical-notes.txt');
  };
  
  return (
    <div>
      {/* UI components */}
    </div>
  );
}
```

## LLM Integration

### Basic LLM Setup

```javascript
const audioServer = new AudioStreamServer({
  transcriptionProvider: new DeepgramProvider({ /* ... */ }),
  enableLLMProcessing: true
});

// Set LLM handler
audioServer.setLLMHandler(async (request) => {
  const { sessionId, transcript, audio } = request;
  
  // Process with your LLM
  const summary = await yourLLM.summarize(transcript);
  const entities = await yourLLM.extractEntities(transcript);
  
  return {
    sessionId,
    response: { summary, entities },
    processingTime: Date.now() - request.timestamp
  };
});
```

### OpenAI Integration Example

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

audioServer.setLLMHandler(async (request) => {
  if (!request.transcript) return null;
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a medical scribe. Summarize the following conversation."
      },
      {
        role: "user",
        content: request.transcript
      }
    ]
  });
  
  return {
    sessionId: request.sessionId,
    response: {
      summary: completion.choices[0].message.content,
      model: "gpt-4",
      tokens: completion.usage.total_tokens
    },
    processingTime: 0
  };
});
```

### Custom LLM Processor

```javascript
const { LLMProcessor } = require('audio-stream-transcribe/server');

// Create custom processor
const llmProcessor = new LLMProcessor({
  batchTimeout: 10000, // Process batch every 10 seconds
  maxBatchSize: 20,    // Or when 20 items accumulate
  includeAudio: true,
  includeTranscript: true
});

// Handle batched requests
llmProcessor.on('llm-request', async (request) => {
  // Process multiple transcripts at once
  const results = await batchProcessWithLLM(request);
  
  // Send results back to clients
  results.forEach(result => {
    audioServer.sendToSession(result.sessionId, {
      type: 'llm-result',
      data: result
    });
  });
});
```

## Custom Providers

### Creating a Custom Provider

```javascript
const { TranscriptionProvider } = require('audio-stream-transcribe');

class WhisperProvider extends TranscriptionProvider {
  constructor(options) {
    super();
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;
  }
  
  async initialize() {
    // Test API connection
    const response = await fetch(`${this.apiUrl}/health`);
    if (!response.ok) {
      throw new Error('Whisper API is not available');
    }
  }
  
  async processAudio(audioData, metadata) {
    const formData = new FormData();
    formData.append('audio', new Blob([audioData]));
    formData.append('language', metadata?.language || 'en');
    
    const response = await fetch(`${this.apiUrl}/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    return {
      transcript: result.text,
      confidence: result.confidence,
      metadata: {
        language: result.language,
        duration: result.duration
      }
    };
  }
  
  async cleanup() {
    // Cleanup any resources
  }
}

// Use it
const audioServer = new AudioStreamServer({
  transcriptionProvider: new WhisperProvider({
    apiUrl: 'https://whisper-api.example.com',
    apiKey: process.env.WHISPER_API_KEY
  })
});
```

### Provider with Streaming Support

```javascript
class StreamingProvider extends TranscriptionProvider {
  constructor(options) {
    super();
    this.connections = new Map();
  }
  
  async processAudio(audioData, metadata) {
    const sessionId = metadata?.sessionId;
    
    // Get or create streaming connection
    let stream = this.connections.get(sessionId);
    if (!stream) {
      stream = await this.createStreamingConnection(sessionId);
      this.connections.set(sessionId, stream);
    }
    
    // Send audio chunk
    stream.write(audioData);
    
    // Return accumulated transcript
    return new Promise((resolve) => {
      stream.once('transcript', (transcript) => {
        resolve({
          transcript: transcript.text,
          confidence: transcript.confidence
        });
      });
    });
  }
  
  async createStreamingConnection(sessionId) {
    // Create your streaming connection
    // Return stream object
  }
}
```

## Advanced Configuration

### Connection Management

```javascript
const audioServer = new AudioStreamServer({
  transcriptionProvider: provider,
  maxConnectionsPerUser: 3,      // Limit connections per user
  connectionTimeout: 60000,       // 1 minute timeout
  pingInterval: 30000,           // Ping every 30 seconds
  pongTimeout: 5000              // Wait 5 seconds for pong
});

// Monitor connection health
audioServer.on('connection', ({ sessionId }) => {
  // Set up monitoring
  const monitor = setInterval(() => {
    const isActive = checkSessionActivity(sessionId);
    if (!isActive) {
      audioServer.sendToSession(sessionId, {
        type: 'idle-warning',
        message: 'Connection will close due to inactivity'
      });
    }
  }, 300000); // Check every 5 minutes
});
```

### Custom Audio Formats

```javascript
// Client-side
const client = new AudioStreamClient({
  websocketUrl: 'wss://api.example.com/audio',
  audioFormat: {
    mimeType: 'audio/webm;codecs=opus',
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16
  }
});

// Server-side handling
audioServer.on('audio-chunk', (chunk) => {
  if (chunk.format.mimeType === 'audio/webm;codecs=opus') {
    // Process Opus audio
  }
});
```

### Scaling Considerations

```javascript
// Use Redis for session management across multiple servers
const Redis = require('ioredis');
const redis = new Redis();

audioServer.on('connection', async ({ sessionId, userId }) => {
  // Store session info in Redis
  await redis.hset('audio-sessions', sessionId, JSON.stringify({
    userId,
    serverId: process.env.SERVER_ID,
    connectedAt: Date.now()
  }));
});

audioServer.on('disconnection', async ({ sessionId }) => {
  await redis.hdel('audio-sessions', sessionId);
});

// Broadcast to all servers
async function broadcastToUser(userId, message) {
  const sessions = await redis.hgetall('audio-sessions');
  
  for (const [sessionId, data] of Object.entries(sessions)) {
    const session = JSON.parse(data);
    if (session.userId === userId) {
      // Send via Redis pub/sub or message queue
      await redis.publish('audio-messages', JSON.stringify({
        serverId: session.serverId,
        sessionId,
        message
      }));
    }
  }
}
```

## Best Practices

1. **Always handle errors gracefully**
   - Provide fallback mechanisms
   - Log errors for debugging
   - Show user-friendly error messages

2. **Implement proper cleanup**
   - Stop recording on component unmount
   - Close connections when done
   - Clear timers and intervals

3. **Monitor performance**
   - Track transcription latency
   - Monitor WebSocket connection health
   - Log resource usage

4. **Security considerations**
   - Always use WSS (secure WebSocket) in production
   - Validate and sanitize all inputs
   - Implement rate limiting
   - Use proper authentication

5. **User experience**
   - Show clear recording indicators
   - Provide feedback for all actions
   - Handle network interruptions gracefully
   - Allow users to download recordings