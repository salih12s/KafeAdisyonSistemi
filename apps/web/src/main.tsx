import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ROUTER_FUTURE_FLAGS } from './config/router';
import { createQueryClient } from './lib/query-client';
import './styles/index.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('index.html içinde #root öğesi bulunamadı.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter future={ROUTER_FUTURE_FLAGS}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
