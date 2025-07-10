/* File: script.js */
const connectBtn = document.getElementById('connect-btn');
let bleDevice;
let bleCharacteristic;

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';
  try {
    // Request BLE device
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'GetFit BLE' }],
      optionalServices: ['e267751a-ae76-11eb-8529-0242ac130003']
    });

    // Connect to GATT server
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService('e267751a-ae76-11eb-8529-0242ac130003');
    bleCharacteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

    // Subscribe to notifications
    await bleCharacteristic.startNotifications();
    bleCharacteristic.addEventListener('characteristicvaluechanged', handleBLEData);

    // Handle disconnect
    bleDevice.addEventListener('gattserverdisconnected', handleDisconnect);

    connectBtn.textContent = 'Connected';
    
    // Request notification permission
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch (e) {
    console.error('BLE connection failed:', e);
    connectBtn.textContent = 'Connect Device';
    connectBtn.disabled = false;
  }
});

function handleBLEData(event) {
  const value = new TextDecoder().decode(event.target.value);
  try {
    const data = JSON.parse(value);
    updateDashboard(data);
    if (data.fall) notifyUser('Fall detected!');
  } catch (e) {
    console.error('Failed to parse BLE data:', e);
  }
}

function handleDisconnect() {
  console.log('BLE device disconnected');
  connectBtn.textContent = 'Connect Device';
  connectBtn.disabled = false;
  bleDevice = null;
  bleCharacteristic = null;
}

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

