/* File: script.js */
const connectBtn = document.getElementById('connect-btn');
let socket;

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';
  try {
    // Open WebSocket to your server
    socket = new WebSocket('wss://your-domain.com/socket');
    socket.onopen = () => {
      connectBtn.textContent = 'Connected';
    };
    socket.onmessage = msg => {
      const data = JSON.parse(msg.data);
      updateDashboard(data);
      if (data.fall) notifyUser('Fall detected!');
    };
    socket.onerror = err => console.error('Socket error', err);

    // Subscribe to push notifications
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY')
    });
    // Send subscription to server
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
  } catch (e) {
    console.error(e);
    connectBtn.textContent = 'Connect Device';
    connectBtn.disabled = false;
  }
});

function updateDashboard({ steps, heartRate, fall }) {
  document.getElementById('steps').textContent = `Steps: ${steps}`;
  document.getElementById('heart-rate').textContent = `BPM: ${heartRate}`;
  document.getElementById('fall-alert').textContent = fall ? 'Fall detected!' : 'All good';
}

function notifyUser(message) {
  if (Notification.permission === 'granted') {
    new Notification('GetFit Alert', { body: message });
  }
}

// Utility to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}