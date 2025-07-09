# Health Monitor Backend

A Node.js backend with WebSocket and push notification support.

## Features

- **HTTPS Server**: Runs on port 443 with self-signed certificates
- **Static Files**: Serves files from `./public` directory
- **WebSocket**: Available at `/socket` endpoint
- **Push Notifications**: Uses web-push with VAPID keys
- **Health Data**: Broadcasts simulated data every 10 seconds
- **Fall Detection**: Sends push notifications when fall is detected
- **CORS**: Enabled for all origins

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Access the application:
   - HTTPS: `https://localhost:443`
   - WebSocket: `wss://localhost:443/socket`

## API Endpoints

- `POST /api/subscribe` - Accept push notification subscriptions
- Static files served from `/public`

## Data Format

WebSocket broadcasts JSON every 10 seconds:
```json
{
  "steps": 5432,
  "heartRate": 78,
  "fall": false
}
```

When `fall: true`, push notifications are sent to all subscribers.