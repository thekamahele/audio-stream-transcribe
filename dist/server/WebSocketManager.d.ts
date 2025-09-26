import { EventEmitter } from 'eventemitter3';
export interface WebSocketConnection {
    ws: any;
    sessionId: string;
    userId?: string;
    metadata?: Record<string, any>;
    isAlive: boolean;
    lastActivity: number;
}
export declare class WebSocketManager extends EventEmitter {
    private options;
    private connections;
    private userConnections;
    private pingInterval;
    constructor(options?: {
        pingInterval?: number;
        pongTimeout?: number;
        maxConnectionsPerUser?: number;
    });
    addConnection(params: {
        ws: any;
        sessionId: string;
        userId?: string;
        metadata?: Record<string, any>;
    }): boolean;
    removeConnection(sessionId: string): void;
    getConnection(sessionId: string): WebSocketConnection | undefined;
    getConnectionsByUser(userId: string): WebSocketConnection[];
    sendMessage(sessionId: string, message: any): boolean;
    broadcast(message: any, filter?: (conn: WebSocketConnection) => boolean): number;
    private startPingInterval;
    cleanup(): void;
}
//# sourceMappingURL=WebSocketManager.d.ts.map