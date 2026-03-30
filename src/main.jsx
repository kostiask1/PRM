import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/scss/main.scss'; // Importing BEM styles

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js')
      .then(registration => console.log('SW registered: ', registration))
      .catch(registrationError => console.log('SW registration failed: ', registrationError));
  });
}