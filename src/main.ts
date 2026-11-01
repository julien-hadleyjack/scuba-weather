import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import './styles.css';

mount(App, { target: document.getElementById('app')! });

// Offline app shell (OFF-1). Updates are applied automatically.
if ('serviceWorker' in navigator) registerSW({ immediate: true });
