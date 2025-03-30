/**
 * Creates a WebSocket connection to the server
 * Used for real-time updates of drone locations and mission statuses
 */
export function createWebSocketConnection(): WebSocket {
  // Determine the correct WebSocket protocol based on current connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  // Create WebSocket connection
  const socket = new WebSocket(wsUrl);
  
  // Connection opened handler
  socket.addEventListener('open', () => {
    console.log('WebSocket connection established');
  });
  
  // Connection error handler
  socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  // Connection closed handler
  socket.addEventListener('close', (event) => {
    console.log(`WebSocket connection closed with code ${event.code}`);
    
    // Attempt to reconnect after a delay if the connection was closed unexpectedly
    if (event.code !== 1000) { // 1000 is normal closure
      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        createWebSocketConnection();
      }, 5000);
    }
  });
  
  return socket;
}

/**
 * Sends a drone location update through the WebSocket
 * @param socket The WebSocket connection
 * @param droneId The ID of the drone
 * @param location The new location of the drone
 */
export function sendDroneLocationUpdate(
  socket: WebSocket, 
  droneId: number, 
  location: { lat: number, lng: number }
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket is not open. Cannot send drone location update.');
    return;
  }
  
  const message = {
    type: 'drone-location-update',
    droneId,
    location
  };
  
  socket.send(JSON.stringify(message));
}

/**
 * Type definition for WebSocket message handlers
 */
export interface WebSocketMessageHandlers {
  'drone-location-update'?: (data: any) => void;
  'mission-launched'?: (data: any) => void;
  'connected'?: (data: any) => void;
  [key: string]: ((data: any) => void) | undefined;
}

/**
 * Listens for all types of WebSocket messages and routes them to appropriate handlers
 * @param socket The WebSocket connection
 * @param handlers Object with handlers for different message types
 */
export function listenForWebSocketMessages(
  socket: WebSocket,
  handlers: WebSocketMessageHandlers
): () => void {
  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const messageType = data.type;
      
      if (messageType && handlers[messageType]) {
        handlers[messageType]!(data);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  };
  
  socket.addEventListener('message', handleMessage);
  
  // Return cleanup function
  return () => {
    socket.removeEventListener('message', handleMessage);
  };
}

/**
 * Listens for drone location updates from the WebSocket
 * @param socket The WebSocket connection
 * @param onDroneUpdate Callback function to handle drone updates
 */
export function listenForDroneUpdates(
  socket: WebSocket,
  onDroneUpdate: (data: any) => void
): () => void {
  return listenForWebSocketMessages(socket, {
    'drone-location-update': onDroneUpdate
  });
}

/**
 * Listens for mission launched events from the WebSocket
 * @param socket The WebSocket connection
 * @param onMissionLaunched Callback function to handle mission launched events
 */
export function listenForMissionLaunched(
  socket: WebSocket,
  onMissionLaunched: (data: any) => void
): () => void {
  return listenForWebSocketMessages(socket, {
    'mission-launched': onMissionLaunched
  });
}
