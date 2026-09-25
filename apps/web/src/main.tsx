import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/app';
import { createQueryClient } from './app/query-client';
import './styles/index.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('index.html içinde #root öğesi bulunamadı.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
