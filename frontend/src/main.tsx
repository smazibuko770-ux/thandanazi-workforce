import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './shared/offline/syncQueue';

// Do not register a service worker during deployment testing. Old cached service workers caused blank screens.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => registrations.forEach((registration) => registration.unregister())).catch(() => {});
}

const root = document.getElementById('root');
if (!root) throw new Error('App root element was not found');
createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
