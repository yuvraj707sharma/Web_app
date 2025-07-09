const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const webpush = require('web-push');
const cors = require('cors');

const app = express();

// Middleware setup
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve static files from ./public

// In-memory storage for push subscriptions
const subscriptions = [];

// Generate VAPID keys for web push (in production, store these securely)
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Create self-signed certificate for HTTPS (dev only)
const createSelfSignedCert = () => {
  const { execSync } = require('child_process');
  try {
    // Generate private key and certificate
    execSync('openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Org/CN=localhost"', { stdio: 'ignore' });
  } catch (error) {
    console.log('OpenSSL not available, creating basic cert files');
    // Fallback: create dummy cert files (won't work for real HTTPS)
    fs.writeFileSync('key.pem', 'dummy-key');
    fs.writeFileSync('cert.pem', 'dummy-cert');
  }
};

// Ensure certificates exist
if (!fs.existsSync('key.pem') || !fs.existsSync('cert.pem')) {
  createSelfSignedCert();
}

// API endpoint to accept push subscriptions
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  console.log('New subscription added:', subscription.endpoint);
  res.json({ success: true, vapidPublicKey: vapidKeys.publicKey });
});

// Create HTTPS server
const http = require('http');
const server = http.createServer(app);

// WebSocket server setup
const wss = new WebSocket.Server({ 
  server,
  path: '/socket'
});

// Track connected WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });
});

// Simulate health data and broadcast every 10 seconds
const broadcastHealthData = () => {
  const healthData = {
    steps: Math.floor(Math.random() * 10000) + 1000,
    heartRate: Math.floor(Math.random() * 60) + 60,
    fall: Math.random() < 0.1 // 10% chance of fall detection
  };
  
  console.log('Broadcasting health data:', healthData);
  
  // Send to all WebSocket clients
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(healthData));
    }
  });
  
  // Send push notification if fall detected
  if (healthData.fall) {
    sendFallAlert(healthData);
  }
};

// Send push notification for fall alerts
const sendFallAlert = async (healthData) => {
  const payload = JSON.stringify({
    title: 'Fall Detected!',
    body: `Emergency: Fall detected. Heart rate: ${healthData.heartRate} BPM`,
    data: healthData
  });
  
  console.log(`Sending fall alert to ${subscriptions.length} subscribers`);
  
  // Send to all stored subscriptions
  const promises = subscriptions.map(subscription => {
    return webpush.sendNotification(subscription, payload)
      .catch(error => {
        console.error('Push notification failed:', error.message);
        // Remove invalid subscriptions
        const index = subscriptions.indexOf(subscription);
        if (index > -1) subscriptions.splice(index, 1);
      });
  });
  
  await Promise.all(promises);
};

// Start broadcasting health data every 10 seconds
setInterval(broadcastHealthData, 10000);

// Start HTTPS server on port 443
// Start server on port 3000
server.listen(3000, () => {
  console.log('HTTP server running on port 3000');
  console.log('WebSocket available at ws://localhost:3000/socket');
});
