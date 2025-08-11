/* File: script.js */
// CONFIG: AI chatbot in demo mode (no API key required)
const AI_CONFIG = {
  demoMode: true
};

// WEBSOCKET VARIABLES
const connectBtn = document.getElementById('connect-btn');
let socket;

// CHATBOT: Global health data for AI context
let currentData = { heartRate: 0, steps: 0, fall: false };

// CAREGIVER: Emergency contact data
let caregiverData = JSON.parse(localStorage.getItem('caregiverData')) || null;

// Initialize Socket.IO connection
function initializeConnection() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to server');
    connectBtn.textContent = 'Connected (Live)';
    connectBtn.disabled = true;
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connectBtn.textContent = 'Disconnected';
    connectBtn.disabled = false;
  });
  
  socket.on('sensor-update', (data) => {
    console.log('Received sensor data:', data);
    updateDashboard(data);
    if (data.fall) {
      // Trigger prominent notification for fall detection
      notifyUser('EMERGENCY: Fall detected!');
      // Handle emergency with location sharing
      handleEmergency();
    }
  });
}

// Connect button handler
connectBtn.addEventListener('click', () => {
  if (!socket || !socket.connected) {
    initializeConnection();
  }
});

// Auto-connect on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeConnection();
  initializeCaregiverSettings();
});

// CAREGIVER SETTINGS FUNCTIONALITY
function initializeCaregiverSettings() {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const caregiverForm = document.getElementById('caregiver-form');
  
  // Load existing caregiver data
  if (caregiverData) {
    document.getElementById('caregiver-name').value = caregiverData.name || '';
    document.getElementById('caregiver-phone').value = caregiverData.phone || '';
    document.getElementById('caregiver-email').value = caregiverData.email || '';
  }
  
  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });
  
  settingsClose.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
  
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });
  
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

// EMERGENCY HANDLING WITH LOCATION
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
  
  try {
    const position = await getCurrentLocation();
    const locationText = `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`;
    const mapsUrl = `https://maps.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
    
    emergencyContent.innerHTML = `
      <p><strong>Caregiver:</strong> ${caregiverData.name}</p>
      <div class="location-info">
        <strong>Your Location:</strong><br>
        ${locationText}<br>
        <a href="${mapsUrl}" target="_blank">View on Maps</a>
      </div>
      <div class="emergency-actions">
        <button class="emergency-btn" onclick="sendWhatsApp('${caregiverData.phone}', '${locationText}', '${mapsUrl}');">📱 Send via WhatsApp</button>
        <button class="emergency-btn" onclick="sendEmail('${caregiverData.email}', '${locationText}', '${mapsUrl}');">📧 Send via Email</button>
        <button class="emergency-btn" onclick="copyLocation('${locationText}', '${mapsUrl}');">📋 Copy Location</button>
        <button class="emergency-btn" onclick="document.getElementById('emergency-modal').classList.add('hidden');">Close</button>
      </div>
    `;
  } catch (error) {
    emergencyContent.innerHTML = `
      <p>❌ Could not get location: ${error.message}</p>
      <div class="emergency-actions">
        <button class="emergency-btn" onclick="sendWhatsApp('${caregiverData.phone}', 'Location unavailable', '');">📱 Send Alert via WhatsApp</button>
        <button class="emergency-btn" onclick="sendEmail('${caregiverData.email}', 'Location unavailable', '');">📧 Send Alert via Email</button>
        <button class="emergency-btn" onclick="document.getElementById('emergency-modal').classList.add('hidden');">Close</button>
      </div>
    `;
  }
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

function updateDashboard({ steps, heartRate, fall }) {
  document.getElementById('steps').textContent = `Steps: ${steps}`;
  document.getElementById('heart-rate').textContent = `BPM: ${heartRate}`;
  document.getElementById('fall-alert').textContent = fall ? 'Fall detected!' : 'All good';
  
  // CHATBOT: Update global data for AI context
  currentData = { heartRate, steps, fall };
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

