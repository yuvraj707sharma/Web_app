/* File: script.js */
// CONFIG: Hugging Face API configuration
const AI_CONFIG = {
  apiKey: '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',
  endpoint: 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1'
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
    if (data.fall) {
      // Trigger prominent notification for fall detection
      notifyUser('EMERGENCY: Fall detected!');
      // Also show an alert for immediate attention
      alert('⚠️ FALL DETECTED! ⚠️\n\nEmergency assistance may be needed.');
    }
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
    
    try {
    
    // Call Hugging Face Mixtral API with optimized prompt
    const prompt = `<s>[INST] You are a health assistant. Current data: Heart rate ${context.heartRate} BPM, Steps taken: ${context.steps}. User question: "${context.question}". Provide a brief, helpful response about their health metrics. [/INST]`;
    
    const response = await fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { 
          max_new_tokens: 150, 
          temperature: 0.3,
          return_full_text: false
        }
      })
    });
    
    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    return data[0]?.generated_text?.trim() || 'I need more information to help you.';
    } catch (error) {
      console.warn('Using demo mode due to API error:', error);
      return getDemoResponse(context);
    }
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

