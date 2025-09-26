// ABOUTME: React example using the useAudioStream hook
// ABOUTME: Shows how to integrate audio streaming in a React application

import React from 'react';
import { useAudioStream } from 'audio-stream-transcribe/react';

function AudioRecorderComponent() {
  const {
    // Connection state
    isConnected,
    isConnecting,
    connectionState,
    connectionError,
    
    // Recording state
    isRecording,
    isPaused,
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
  } = useAudioStream({
    websocketUrl: 'wss://your-server.com/audio',
    authToken: 'your-auth-token', // Optional
    autoConnect: true,
    onTranscription: (result) => {
      console.log('New transcription:', result);
      // You can handle transcriptions here (e.g., save to state, send to analytics)
    },
    onError: (error) => {
      console.error('Audio stream error:', error);
      // Handle errors (e.g., show notification)
    }
  });
  
  const handleDownloadRecording = async () => {
    try {
      const recordingBlob = await stopRecording();
      if (recordingBlob) {
        // Create download link
        const url = URL.createObjectURL(recordingBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download recording:', error);
    }
  };
  
  return (
    <div className="audio-recorder">
      <h2>Audio Transcription Demo</h2>
      
      {/* Connection Status */}
      <div className={`status ${connectionState}`}>
        {isConnecting && 'Connecting...'}
        {isConnected && 'Connected'}
        {!isConnected && !isConnecting && 'Disconnected'}
        {connectionError && ` - Error: ${connectionError.message}`}
      </div>
      
      {/* Controls */}
      <div className="controls">
        {!isConnected ? (
          <button onClick={connect} disabled={isConnecting}>
            Connect
          </button>
        ) : (
          <button onClick={disconnect}>
            Disconnect
          </button>
        )}
        
        <button 
          onClick={startRecording} 
          disabled={!isConnected || isRecording}
        >
          Start Recording
        </button>
        
        {isRecording && !isPaused && (
          <button onClick={pauseRecording}>
            Pause
          </button>
        )}
        
        {isRecording && isPaused && (
          <button onClick={resumeRecording}>
            Resume
          </button>
        )}
        
        {isRecording && (
          <button onClick={handleDownloadRecording}>
            Stop & Download
          </button>
        )}
        
        <button onClick={clearTranscript} disabled={!transcript}>
          Clear Transcript
        </button>
      </div>
      
      {/* Recording Status */}
      {isRecording && (
        <div className="recording-status">
          <span className="recording-indicator">●</span>
          {isPaused ? 'Paused' : 'Recording...'}
        </div>
      )}
      
      {/* Error Display */}
      {recordingError && (
        <div className="error">
          Recording Error: {recordingError.message}
        </div>
      )}
      
      {/* Transcript Display */}
      <div className="transcript-section">
        <h3>Transcript:</h3>
        <div className="transcript">
          {transcript || 'No transcript yet...'}
        </div>
        
        {lastTranscription && (
          <div className="last-transcription">
            <small>
              Last: "{lastTranscription.transcript}" 
              (confidence: {(lastTranscription.confidence * 100).toFixed(1)}%)
            </small>
          </div>
        )}
      </div>
      
      {/* Style */}
      <style jsx>{`
        .audio-recorder {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        
        .status {
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
          text-align: center;
        }
        
        .status.connected {
          background-color: #d4edda;
          color: #155724;
        }
        
        .status.disconnected {
          background-color: #f8d7da;
          color: #721c24;
        }
        
        .status.connecting,
        .status.reconnecting {
          background-color: #fff3cd;
          color: #856404;
        }
        
        .controls {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        
        button {
          padding: 10px 20px;
          font-size: 16px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          background-color: #007bff;
          color: white;
          transition: background-color 0.3s;
        }
        
        button:hover:not(:disabled) {
          background-color: #0056b3;
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .recording-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
          font-weight: bold;
        }
        
        .recording-indicator {
          color: red;
          font-size: 20px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .error {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
        }
        
        .transcript-section {
          margin-top: 30px;
        }
        
        .transcript {
          border: 1px solid #ddd;
          padding: 15px;
          min-height: 150px;
          background-color: #f9f9f9;
          border-radius: 5px;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .last-transcription {
          margin-top: 10px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

// Example usage in your app
function App() {
  return (
    <div className="app">
      <h1>My Audio Transcription App</h1>
      <AudioRecorderComponent />
    </div>
  );
}

export default App;