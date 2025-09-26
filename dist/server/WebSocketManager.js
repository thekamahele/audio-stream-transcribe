"use strict";
// ABOUTME: WebSocket connection manager for the audio streaming server
// ABOUTME: Handles multiple client connections and message routing
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const eventemitter3_1 = require("eventemitter3");
class WebSocketManager extends eventemitter3_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.connections = new Map();
        this.userConnections = new Map();
        this.pingInterval = null;
        this.startPingInterval();
    }
    addConnection(params) {
        const { ws, sessionId, userId, metadata } = params;
        // Check max connections per user
        if (userId && this.options.maxConnectionsPerUser) {
            const userSessions = this.userConnections.get(userId);
            if (userSessions && userSessions.size >= this.options.maxConnectionsPerUser) {
                return false;
            }
        }
        const connection = {
            ws,
            sessionId,
            userId,
            metadata,
            isAlive: true,
            lastActivity: Date.now()
        };
        this.connections.set(sessionId, connection);
        if (userId) {
            if (!this.userConnections.has(userId)) {
                this.userConnections.set(userId, new Set());
            }
            this.userConnections.get(userId).add(sessionId);
        }
        // Setup ping/pong handlers
        ws.on('pong', () => {
            connection.isAlive = true;
            connection.lastActivity = Date.now();
        });
        ws.on('close', () => {
            this.removeConnection(sessionId);
        });
        this.emit('connection-added', { sessionId, userId });
        return true;
    }
    removeConnection(sessionId) {
        const connection = this.connections.get(sessionId);
        if (!connection)
            return;
        this.connections.delete(sessionId);
        if (connection.userId) {
            const userSessions = this.userConnections.get(connection.userId);
            if (userSessions) {
                userSessions.delete(sessionId);
                if (userSessions.size === 0) {
                    this.userConnections.delete(connection.userId);
                }
            }
        }
        this.emit('connection-removed', { sessionId, userId: connection.userId });
    }
    getConnection(sessionId) {
        return this.connections.get(sessionId);
    }
    getConnectionsByUser(userId) {
        const sessionIds = this.userConnections.get(userId);
        if (!sessionIds)
            return [];
        return Array.from(sessionIds)
            .map(sessionId => this.connections.get(sessionId))
            .filter((conn) => conn !== undefined);
    }
    sendMessage(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection || connection.ws.readyState !== 1) { // WebSocket.OPEN = 1
            return false;
        }
        try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            connection.ws.send(messageStr);
            connection.lastActivity = Date.now();
            return true;
        }
        catch (error) {
            console.error(`Failed to send message to session ${sessionId}:`, error);
            return false;
        }
    }
    broadcast(message, filter) {
        let sent = 0;
        for (const connection of this.connections.values()) {
            if (!filter || filter(connection)) {
                if (this.sendMessage(connection.sessionId, message)) {
                    sent++;
                }
            }
        }
        return sent;
    }
    startPingInterval() {
        const interval = this.options.pingInterval || 30000; // 30 seconds
        const pongTimeout = this.options.pongTimeout || 5000; // 5 seconds
        this.pingInterval = setInterval(() => {
            for (const [sessionId, connection] of this.connections.entries()) {
                if (!connection.isAlive) {
                    // Connection failed to respond to previous ping
                    connection.ws.terminate();
                    this.removeConnection(sessionId);
                    continue;
                }
                connection.isAlive = false;
                connection.ws.ping();
                // Set timeout for pong response
                setTimeout(() => {
                    if (!connection.isAlive) {
                        connection.ws.terminate();
                        this.removeConnection(sessionId);
                    }
                }, pongTimeout);
            }
        }, interval);
    }
    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        // Close all connections
        for (const connection of this.connections.values()) {
            connection.ws.close();
        }
        this.connections.clear();
        this.userConnections.clear();
        this.removeAllListeners();
    }
}
exports.WebSocketManager = WebSocketManager;
//# sourceMappingURL=WebSocketManager.js.map