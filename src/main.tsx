import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastContextProvider } from '@/hooks/useToast';
import '@/index.css';
import { initializeOneSignal } from '@/lib/onesignal';

void initializeOneSignal().catch((error) => {
  console.error('Error al inicializar OneSignal:', error);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastContextProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastContextProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
