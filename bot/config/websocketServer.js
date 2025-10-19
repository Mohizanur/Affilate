const WebSocket = require('ws');
const http = require('http');
const logger = require("../../utils/logger");

/**
 * 🚀 WEBSOCKET REAL-TIME SERVER
 * 
 * This system provides real-time bidirectional communication
 * for ultra-fast data streaming and live updates.
 */

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.server = null;
    this.clients = new Map();
    this.rooms = new Map();
    this.isRunning = false;
    
    // Performance metrics
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      avgLatency: 0,
      peakConnections: 0
    };
    
    this.startTime = Date.now();
  }

  /**
   * Initialize WebSocket server
   */
  async initialize(port = 8080) {
    try {
      // Create HTTP server
      this.server = http.createServer();
      
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        server: this.server,
        perMessageDeflate: {
          zlibDeflateOptions: {
            level: 3,
            memLevel: 7,
            threshold: 1024,
            concurrencyLimit: 10,
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024
          },
          threshold: 1024,
          concurrencyLimit: 10,
        },
        maxPayload: 16 * 1024 * 1024, // 16MB
        verifyClient: this.verifyClient.bind(this)
      });

      // WebSocket event handlers
      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleError.bind(this));

      // Start server
      this.server.listen(port, () => {
        this.isRunning = true;
        logger.info(`🚀 WebSocket server running on port ${port}`);
      });

      // Start performance monitoring
      this.startPerformanceMonitoring();
      
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Verify client connection
   */
  verifyClient(info) {
    // Add authentication logic here
    const token = info.req.url.split('token=')[1];
    
    if (!token) {
      logger.warn('WebSocket connection rejected: No token provided');
      return false;
    }
    
    // Validate token (implement your validation logic)
    return this.validateToken(token);
  }

  /**
   * Validate authentication token
   */
  validateToken(token) {
    // Implement your token validation logic
    // For now, accept all tokens
    return true;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      rooms: new Set(),
      metadata: this.extractMetadata(req)
    };

    this.clients.set(clientId, clientInfo);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;
    this.metrics.peakConnections = Math.max(this.metrics.peakConnections, this.metrics.activeConnections);

    // Set up client event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId: clientId,
      timestamp: Date.now(),
      serverInfo: {
        version: '1.0.0',
        uptime: Date.now() - this.startTime
      }
    });

    logger.info(`🔌 WebSocket client connected: ${clientId}`);
  }

  /**
   * Handle WebSocket message
   */
  handleMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      client.lastActivity = Date.now();
      this.metrics.messagesReceived++;
      this.metrics.bytesTransferred += data.length;

      const message = JSON.parse(data.toString());
      
      // Handle different message types
      switch (message.type) {
        case 'join_room':
          this.handleJoinRoom(clientId, message.room);
          break;
        case 'leave_room':
          this.handleLeaveRoom(clientId, message.room);
          break;
        case 'broadcast':
          this.handleBroadcast(clientId, message);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        case 'subscribe':
          this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message);
          break;
        default:
          this.handleCustomMessage(clientId, message);
      }
    } catch (error) {
      logger.error(`Error handling message from client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const room of client.rooms) {
      this.removeFromRoom(clientId, room);
    }

    this.clients.delete(clientId);
    this.metrics.activeConnections--;

    logger.info(`🔌 WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    logger.error(`WebSocket client error for ${clientId}:`, error);
    this.handleDisconnection(clientId);
  }

  /**
   * Handle ping from client
   */
  handlePing(clientId) {
    this.sendToClient(clientId, {
      type: 'pong',
      timestamp: Date.now()
    });
  }

  /**
   * Handle pong from client
   */
  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  /**
   * Handle join room request
   */
  handleJoinRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }

    this.rooms.get(roomName).add(clientId);
    client.rooms.add(roomName);

    this.sendToClient(clientId, {
      type: 'room_joined',
      room: roomName,
      timestamp: Date.now()
    });

    // Notify room members
    this.broadcastToRoom(roomName, {
      type: 'user_joined',
      clientId: clientId,
      room: roomName,
      timestamp: Date.now()
    }, clientId);

    logger.info(`Client ${clientId} joined room ${roomName}`);
  }

  /**
   * Handle leave room request
   */
  handleLeaveRoom(clientId, roomName) {
    this.removeFromRoom(clientId, roomName);
    
    this.sendToClient(clientId, {
      type: 'room_left',
      room: roomName,
      timestamp: Date.now()
    });

    // Notify room members
    this.broadcastToRoom(roomName, {
      type: 'user_left',
      clientId: clientId,
      room: roomName,
      timestamp: Date.now()
    });

    logger.info(`Client ${clientId} left room ${roomName}`);
  }

  /**
   * Remove client from room
   */
  removeFromRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const room = this.rooms.get(roomName);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(roomName);
      }
    }

    client.rooms.delete(roomName);
  }

  /**
   * Handle broadcast message
   */
  handleBroadcast(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Broadcast to all rooms the client is in
    for (const room of client.rooms) {
      this.broadcastToRoom(room, {
        type: 'broadcast',
        from: clientId,
        data: message.data,
        timestamp: Date.now()
      }, clientId);
    }
  }

  /**
   * Handle subscription request
   */
  handleSubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Add subscription logic here
    this.sendToClient(clientId, {
      type: 'subscribed',
      topic: message.topic,
      timestamp: Date.now()
    });
  }

  /**
   * Handle unsubscription request
   */
  handleUnsubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Add unsubscription logic here
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      topic: message.topic,
      timestamp: Date.now()
    });
  }

  /**
   * Handle custom message
   */
  handleCustomMessage(clientId, message) {
    // Handle custom message types
    logger.info(`Custom message from ${clientId}:`, message);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return false;

    try {
      const data = JSON.stringify(message);
      client.ws.send(data);
      this.metrics.messagesSent++;
      this.metrics.bytesTransferred += data.length;
      return true;
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message, excludeClientId = null) {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients) {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }
    
    return sentCount;
  }

  /**
   * Broadcast message to specific room
   */
  broadcastToRoom(roomName, message, excludeClientId = null) {
    const room = this.rooms.get(roomName);
    if (!room) return 0;

    let sentCount = 0;
    
    for (const clientId of room) {
      if (clientId !== excludeClientId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }
    
    return sentCount;
  }

  /**
   * Send message to multiple clients
   */
  sendToClients(clientIds, message) {
    let sentCount = 0;
    
    for (const clientId of clientIds) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }

  /**
   * Get client information
   */
  getClientInfo(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;

    return {
      id: client.id,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      rooms: Array.from(client.rooms),
      metadata: client.metadata,
      isConnected: client.ws.readyState === WebSocket.OPEN
    };
  }

  /**
   * Get room information
   */
  getRoomInfo(roomName) {
    const room = this.rooms.get(roomName);
    if (!room) return null;

    return {
      name: roomName,
      memberCount: room.size,
      members: Array.from(room)
    };
  }

  /**
   * Get server statistics
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    const avgLatency = this.metrics.totalConnections > 0 
      ? this.metrics.avgLatency 
      : 0;

    return {
      isRunning: this.isRunning,
      uptime: Math.floor(uptime / 1000),
      connections: {
        total: this.metrics.totalConnections,
        active: this.metrics.activeConnections,
        peak: this.metrics.peakConnections
      },
      messages: {
        sent: this.metrics.messagesSent,
        received: this.metrics.messagesReceived,
        bytesTransferred: this.metrics.bytesTransferred
      },
      performance: {
        avgLatency: `${avgLatency.toFixed(2)}ms`
      },
      rooms: this.rooms.size,
      clients: this.clients.size
    };
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // EMERGENCY: Disable websocket monitoring to stop quota leak
    // setInterval(() => {
    //   this.performHealthCheck();
    // }, 30000);

    // setInterval(() => {
    //   this.cleanupInactiveConnections();
    // }, 300000);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [clientId, client] of this.clients) {
      if (now - client.lastActivity > inactiveThreshold) {
        logger.warn(`Closing inactive connection: ${clientId}`);
        client.ws.close();
      }
    }
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const cleanupThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [clientId, client] of this.clients) {
      if (now - client.lastActivity > cleanupThreshold) {
        this.handleDisconnection(clientId);
      }
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract metadata from request
   */
  extractMetadata(req) {
    return {
      userAgent: req.headers['user-agent'],
      ip: req.connection.remoteAddress,
      origin: req.headers.origin
    };
  }

  /**
   * Handle server error
   */
  handleError(error) {
    logger.error('WebSocket server error:', error);
  }

  /**
   * Close WebSocket server
   */
  async close() {
    try {
      // Close all client connections
      for (const [clientId, client] of this.clients) {
        client.ws.close();
      }

      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
      }

      // Close HTTP server
      if (this.server) {
        this.server.close();
      }

      this.isRunning = false;
      logger.info('🔌 WebSocket server closed');
    } catch (error) {
      logger.error('Error closing WebSocket server:', error);
    }
  }
}

// Export singleton instance
const webSocketServer = new WebSocketServer();
module.exports = webSocketServer;


