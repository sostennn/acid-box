import { mount } from 'svelte';
import App from './ui/App.svelte';
import './ui/theme/base.css';

const target = document.getElementById('app');
if (target === null) {
  throw new Error('Élément #app introuvable');
}

mount(App, { target });
