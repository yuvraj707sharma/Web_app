/* File: script.js */
// CONFIG: Add your free AI API key here (e.g., Hugging Face)
const AI_CONFIG = {
  apiKey: prompt('Enter your Hugging Face API key (or press Cancel to use demo mode):') || 'demo',
  endpoint: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium'
};

// EXISTING BLE VARIABLES
const connectBtn = document.getElementById('connect-btn');
let bleDevice;
let bleCharacteristic;

// CHATBOT: Global health data for AI context
let currentData = { heartRate: 0, steps: 0, fall: false };

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';
  try {
    // Request BLE device
    bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
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
    
    // Request notification permission up front after BLE connection
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission after BLE connect:', permission);
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
    
    // Demo mode fallback responses
    if (AI_CONFIG.apiKey === 'demo') {
      return getDemoResponse(context);
    }
    
    // Call Hugging Face API
    const prompt = `Health data: Heart rate ${context.heartRate} BPM, Steps: ${context.steps}. Question: ${context.question}. Provide a helpful health response.`;
    
    const response = await fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_length: 100, temperature: 0.7 }
      })
    });
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    return data[0]?.generated_text?.replace(prompt, '').trim() || 'I need more information to help you.';
  }
  
  function getDemoResponse({ heartRate, steps, question }) {
    const q = question.toLowerCase();
    
    if (q.includes('heart') || q.includes('bpm')) {
      if (heartRate === 'unknown') return 'Connect your device to see heart rate data!';
      if (heartRate < 60) return `Your heart rate of ${heartRate} BPM is quite low. Consider consulting a doctor if you feel unwell.`;
      if (heartRate > 100) return `Your heart rate of ${heartRate} BPM is elevated. Take a moment to rest and breathe deeply.`;
      return `Your heart rate of ${heartRate} BPM looks normal for your current activity level.`;
    }
    
    if (q.includes('step') || q.includes('walk')) {
      if (steps === 'unknown') return 'Connect your device to track your steps!';
      if (steps < 2000) return `You have ${steps} steps today. Try to reach 10,000 steps for optimal health!`;
      if (steps > 10000) return `Great job! ${steps} steps is excellent for your daily activity.`;
      return `You have ${steps} steps today. You're making good progress!`;
    }
    
    return 'I can help you understand your heart rate and step count data. What would you like to know?';
  }
  
  // Welcome message
  setTimeout(() => {
    addMessage('Hi! I\'m your health assistant. Ask me about your heart rate or step count!', 'bot');
  }, 1000);
});

