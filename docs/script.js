/* File: script.js */
// CONFIG: AI chatbot in demo mode (no API key required)
const AI_CONFIG = {
  demoMode: true
};

// BLE VARIABLES
const connectBtn = document.getElementById('connect-btn');
let bleDevice = null;
let bleCharacteristic = null;

// CHATBOT: Global health data for AI context
let currentData = { heartRate: 0, steps: 0, fall: false, lat: null, lng: null };

// CAREGIVER: Emergency contact data
let caregiverData = JSON.parse(localStorage.getItem('caregiverData')) || null;

// BLE Configuration
const BLE_SERVICE_UUID = 'e267751a-ae76-11eb-8529-0242ac130003';
const BLE_CHARACTERISTIC_UUID = 'e267751b-ae76-11eb-8529-0242ac130003';

// Connect to BLE device
async function connectToBLE() {
  try {
    console.log('Requesting Bluetooth Device...');
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'GetFit BLE' }],
      optionalServices: [BLE_SERVICE_UUID]
    });
    
    console.log('Connecting to GATT Server...');
    const server = await bleDevice.gatt.connect();
    
    console.log('Getting Service...');
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    
    console.log('Getting Characteristic...');
    bleCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
    
    // Start notifications
    await bleCharacteristic.startNotifications();
    bleCharacteristic.addEventListener('characteristicvaluechanged', handleBLEData);
    
    // Update UI
    connectBtn.innerHTML = '<span class="btn-icon">✓</span> Connected';
    connectBtn.disabled = true;
    
    // Handle disconnection
    bleDevice.addEventListener('gattserverdisconnected', () => {
      console.log('Device disconnected');
      connectBtn.innerHTML = '<span class="btn-icon">🔗</span> Connect Device';
      connectBtn.disabled = false;
      bleDevice = null;
      bleCharacteristic = null;
    });
    
  } catch (error) {
    console.error('BLE connection failed:', error);
    alert('Failed to connect to device. Make sure Bluetooth is enabled and the device is nearby.');
  }
}

// Handle incoming BLE data
function handleBLEData(event) {
  const value = new TextDecoder().decode(event.target.value);
  try {
    const data = JSON.parse(value);
    console.log('Received BLE data:', data);
    updateDashboard(data);
    
    if (data.fall) {
      notifyUser('EMERGENCY: Fall detected!');
      handleEmergency();
    }
  } catch (error) {
    console.error('Failed to parse BLE data:', error);
  }
}

// Connect button handler
connectBtn.addEventListener('click', connectToBLE);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeCaregiverSettings();
  
  // Check if Web Bluetooth is supported
  if (!navigator.bluetooth) {
    connectBtn.textContent = 'Bluetooth not supported';
    connectBtn.disabled = true;
    alert('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Safari.');
  }
});

// CAREGIVER SETTINGS FUNCTIONALITY
function initializeCaregiverSettings() {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const caregiverForm = document.getElementById('caregiver-form');
  
  if (!settingsBtn) {
    console.error('Settings button not found');
    return;
  }
  
  // Load existing caregiver data
  if (caregiverData) {
    const nameInput = document.getElementById('caregiver-name');
    const phoneInput = document.getElementById('caregiver-phone');
    const emailInput = document.getElementById('caregiver-email');
    
    if (nameInput) nameInput.value = caregiverData.name || '';
    if (phoneInput) phoneInput.value = caregiverData.phone || '';
    if (emailInput) emailInput.value = caregiverData.email || '';
  }
  
  settingsBtn.addEventListener('click', () => {
    console.log('Settings button clicked');
    if (settingsModal) {
      settingsModal.classList.remove('hidden');
    }
  });
  
  if (settingsClose) {
    settingsClose.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
  }
  
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.add('hidden');
      }
    });
  }
  
  if (caregiverForm) {
    caregiverForm.addEventListener('submit', (e) => {
      e.preventDefault();
      caregiverData = {
        name: document.getElementById('caregiver-name').value,
        phone: document.getElementById('caregiver-phone').value,
        email: document.getElementById('caregiver-email').value
      };
      localStorage.setItem('caregiverData', JSON.stringify(caregiverData));
      settingsModal.classList.add('hidden');
      alert('Caregiver information saved!');
    });
  }
}

// STREAMLINED EMERGENCY HANDLING
async function handleEmergency() {
  const emergencyModal = document.getElementById('emergency-modal');
  const emergencyContent = document.getElementById('emergency-content');
  
  emergencyModal.classList.remove('hidden');
  
  if (!caregiverData) {
    emergencyContent.innerHTML = `
      <p>⚠️ No caregiver configured!</p>
      <button class="emergency-btn" onclick="document.getElementById('settings-modal').classList.remove('hidden'); document.getElementById('emergency-modal').classList.add('hidden');">Setup Caregiver</button>
    `;
    return;
  }
  
  // Get location data
  let locationText, mapsUrl;
  if (currentData.lat && currentData.lng) {
    locationText = `Lat: ${currentData.lat}, Lng: ${currentData.lng}`;
    mapsUrl = `https://maps.google.com/maps?q=${currentData.lat},${currentData.lng}`;
  } else {
    try {
      const position = await getCurrentLocation();
      locationText = `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`;
      mapsUrl = `https://maps.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
    } catch (error) {
      locationText = 'Location unavailable';
      mapsUrl = '';
    }
  }
  
  // Store for sequential sending
  window.emergencyData = { locationText, mapsUrl };
  
  // Show streamlined interface
  emergencyContent.innerHTML = `
    <p><strong>🚨 FALL DETECTED!</strong></p>
    <p>Caregiver: ${caregiverData.name}</p>
    <div class="location-info">
      <strong>Location:</strong> ${locationText}<br>
      ${mapsUrl ? `<a href="${mapsUrl}" target="_blank">View on Maps</a>` : ''}
    </div>
    <div class="emergency-actions">
      <button class="emergency-btn priority" onclick="sendSequentialAlerts();">📱 SEND EMERGENCY ALERT</button>
      <button class="emergency-btn" onclick="document.getElementById('emergency-modal').classList.add('hidden');">Cancel</button>
    </div>
    <p class="emergency-note">Click once to send SMS → WhatsApp → Email sequentially</p>
  `;
}

// SEQUENTIAL ALERT SENDING (ONE CLICK)
function sendSequentialAlerts() {
  const { locationText, mapsUrl } = window.emergencyData;
  const emergencyContent = document.getElementById('emergency-content');
  
  emergencyContent.innerHTML = `
    <p><strong>Sending alerts to ${caregiverData.name}...</strong></p>
    <div class="emergency-progress">
      <p id="step1">📱 Opening SMS...</p>
      <p id="step2" style="opacity:0.5">💬 Opening WhatsApp...</p>
      <p id="step3" style="opacity:0.5">📧 Opening Email...</p>
    </div>
    <button class="emergency-btn" onclick="document.getElementById('emergency-modal').classList.add('hidden');">Close</button>
  `;
  
  // Step 1: SMS (immediate)
  sendSMS(caregiverData.phone, locationText, mapsUrl);
  
  // Step 2: WhatsApp (after 3 seconds)
  setTimeout(() => {
    document.getElementById('step1').style.opacity = '0.5';
    document.getElementById('step2').style.opacity = '1';
    if (navigator.onLine) {
      sendWhatsApp(caregiverData.phone, locationText, mapsUrl);
    }
  }, 3000);
  
  // Step 3: Email (after 6 seconds)
  setTimeout(() => {
    document.getElementById('step2').style.opacity = '0.5';
    document.getElementById('step3').style.opacity = '1';
    if (navigator.onLine && caregiverData.email) {
      sendEmail(caregiverData.email, locationText, mapsUrl);
    }
  }, 6000);
}

// SMS FUNCTION (WORKS OFFLINE) - PRIORITY METHOD
function sendSMS(phone, location, mapsUrl) {
  const message = `🚨 EMERGENCY: Fall detected! Location: ${location} ${mapsUrl ? mapsUrl : 'Maps unavailable'}`;
  const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
  window.location.href = smsUrl; // Use location.href instead of window.open for better mobile support
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  });
}

function sendWhatsApp(phone, location, mapsUrl) {
  const message = `🚨 EMERGENCY ALERT 🚨\n\nFall detected!\n\nLocation: ${location}\n\nMaps: ${mapsUrl}`;
  const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

function sendEmail(email, location, mapsUrl) {
  if (!email) {
    alert('No email configured for caregiver');
    return;
  }
  const subject = '🚨 EMERGENCY: Fall Detected';
  const body = `EMERGENCY ALERT\n\nFall has been detected!\n\nLocation: ${location}\n\nView on Maps: ${mapsUrl}\n\nPlease check on the person immediately.`;
  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl);
}

function copyLocation(location, mapsUrl) {
  const text = `🚨 EMERGENCY: Fall detected!\n\nLocation: ${location}\n\nMaps: ${mapsUrl}`;
  navigator.clipboard.writeText(text).then(() => {
    alert('Location copied to clipboard! You can now paste it in any messaging app.');
  }).catch(() => {
    alert('Could not copy to clipboard. Please manually share the location shown above.');
  });
}

function updateDashboard({ steps, heartRate, fall, lat, lng }) {
  const stepsEl = document.getElementById('steps');
  const heartRateEl = document.getElementById('heart-rate');
  const fallAlertEl = document.getElementById('fall-alert');
  
  if (stepsEl) stepsEl.textContent = `Steps: ${steps || 0}`;
  if (heartRateEl) heartRateEl.textContent = `BPM: ${heartRate || 0}`;
  if (fallAlertEl) fallAlertEl.textContent = fall ? 'Fall detected!' : 'All good';
  
  // CHATBOT: Update global data for AI context
  currentData = { 
    heartRate: heartRate || 0, 
    steps: steps || 0, 
    fall: fall || false,
    lat: lat || null,
    lng: lng || null
  };
}

// Enhanced notification function with permission handling and debugging
async function notifyUser(message) {
  console.log("🔔 notifyUser:", message);
  
  // Request permission if not already granted
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
  }
  
  // Show notification immediately if permission granted
  if (Notification.permission === 'granted') {
    new Notification('Fitband Alert', { body: message });
  } else {
    console.warn('Notification permission denied');
  }
}

// CHATBOT FUNCTIONALITY: Smart health assistant
document.addEventListener('DOMContentLoaded', () => {
  const chatToggle = document.getElementById('chat-toggle');
  const chatWindow = document.getElementById('chat-window');
  const chatClose = document.getElementById('chat-close');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const chatMessages = document.getElementById('chat-messages');
  
  // Toggle chat window
  chatToggle.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
      chatInput.focus();
    }
  });
  
  chatClose.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });
  
  // Send message on Enter key
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  chatSend.addEventListener('click', sendMessage);
  
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    chatInput.value = '';
    
    // Show typing indicator
    addMessage('Thinking...', 'bot', true);
    
    try {
      const response = await getAIResponse(message);
      // Remove typing indicator and add real response
      chatMessages.removeChild(chatMessages.lastChild);
      addMessage(response, 'bot');
    } catch (error) {
      chatMessages.removeChild(chatMessages.lastChild);
      addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
      console.error('AI API error:', error);
    }
  }
  
  function addMessage(text, sender, isTyping = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    messageDiv.textContent = text;
    if (isTyping) messageDiv.style.opacity = '0.7';
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  async function getAIResponse(question) {
    // Create context with current health data
    const context = {
      heartRate: currentData.heartRate || 'unknown',
      steps: currentData.steps || 'unknown',
      question: question
    };
    
    // Always use demo mode (no API key required)
    return getDemoResponse(context);
  }
  
  function getDemoResponse({ heartRate, steps, question }) {
    const q = question.toLowerCase();
    
    if (q.includes('heart') || q.includes('bpm')) {
      if (heartRate === 'unknown') return 'Connect your device to see heart rate data!';
      if (heartRate < 60) return `Your heart rate of ${heartRate} BPM is quite low. This could be normal if you're very fit, but consider consulting a doctor if you feel unwell.`;
      if (heartRate > 100) return `Your heart rate of ${heartRate} BPM is elevated. After ${steps} steps, this might be normal during activity. Take a moment to rest if needed.`;
      return `Your heart rate of ${heartRate} BPM looks normal for someone who has walked ${steps} steps today.`;
    }
    
    if (q.includes('step') || q.includes('walk')) {
      if (steps === 'unknown') return 'Connect your device to track your steps!';
      if (steps < 2000) return `You have ${steps} steps today with a heart rate of ${heartRate} BPM. Try to reach 10,000 steps for optimal health!`;
      if (steps > 10000) return `Excellent! ${steps} steps with a heart rate of ${heartRate} BPM shows great activity levels.`;
      return `You have ${steps} steps today and your heart rate is ${heartRate} BPM. You're making good progress!`;
    }
    
    if (q.includes('health') || q.includes('how am i')) {
      return `Based on your current data: ${heartRate} BPM heart rate and ${steps} steps, you're doing well! Keep up the good work.`;
    }
    
    return 'I can help you understand your heart rate and step count data. What would you like to know?';
  }
  
  // Welcome message
  setTimeout(() => {
    addMessage('Hi! I\'m your health assistant. Ask me about your heart rate or step count!', 'bot');
  }, 1000);
});

