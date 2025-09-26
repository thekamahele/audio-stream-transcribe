// ABOUTME: Example server implementation using audio-stream-transcribe
// ABOUTME: Shows how to set up WebSocket server with Deepgram transcription and LLM processing

const WebSocket = require('ws');
const { AudioStreamServer, DeepgramProvider } = require('audio-stream-transcribe');

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Initialize audio stream server
const audioServer = new AudioStreamServer({
  transcriptionProvider: new DeepgramProvider({
    apiKey: process.env.DEEPGRAM_API_KEY,
    model: 'nova-3',
    language: 'en-US',
    diarize: true,
    smartFormat: true
  }),
  enableLLMProcessing: true,
  pingInterval: 30000,
  pongTimeout: 5000
});

// Set up LLM handler (example with OpenAI)
audioServer.setLLMHandler(async (request) => {
  console.log(`Processing LLM request for session ${request.sessionId}`);
  
  // Example: Send transcript to OpenAI
  if (request.transcript) {
    // const response = await openai.createCompletion({
    //   model: "text-davinci-003",
    //   prompt: `Summarize this conversation: ${request.transcript}`,
    //   max_tokens: 150
    // });
    
    return {
      sessionId: request.sessionId,
      response: { summary: 'Conversation summary would go here' },
      processingTime: 0
    };
  }
  
  return {
    sessionId: request.sessionId,
    response: null,
    processingTime: 0
  };
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  // Extract session info from request
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || generateSessionId();
  const userId = url.searchParams.get('userId');
  const token = url.searchParams.get('token');
  
  // Validate token if needed
  // if (!validateToken(token)) {
  //   ws.close(1008, 'Invalid token');
  //   return;
  // }
  
  // Handle connection
  audioServer.handleConnection({
    websocket: ws,
    sessionId,
    userId,
    metadata: {
      clientIp: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    }
  });
});

// Listen to server events
audioServer.on('connection', ({ sessionId, userId }) => {
  console.log(`Client connected: ${sessionId} (user: ${userId || 'anonymous'})`);
});

audioServer.on('disconnection', ({ sessionId, userId, reason }) => {
  console.log(`Client disconnected: ${sessionId} (reason: ${reason || 'unknown'})`);
});

audioServer.on('transcription', ({ sessionId, transcript, speaker, confidence }) => {
  console.log(`[Session ${sessionId}] Speaker ${speaker}: ${transcript}`);
  
  // You can store transcriptions in a database here
  // await saveTranscription({ sessionId, transcript, speaker, confidence });
});

audioServer.on('audio-chunk', (chunk) => {
  // Handle raw audio chunks if needed
  console.log(`Received audio chunk for session ${chunk.sessionId}`);
});

audioServer.on('error', ({ sessionId, error }) => {
  console.error(`Error in session ${sessionId}:`, error);
});

// LLM processing events
audioServer.on('llm-request', (request) => {
  console.log(`LLM request for session ${request.sessionId}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await audioServer.cleanup();
  wss.close();
  process.exit(0);
});

// Helper function
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

console.log('Audio streaming server started on port 8080');