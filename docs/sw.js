/* File: sw.js */
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = { body: data.body, icon: '/icons/alert-icon.png' };
  event.waitUntil(self.registration.showNotification('GetFit', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});