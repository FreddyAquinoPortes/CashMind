import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { addCollection } from '@iconify/react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import tablerData from '@iconify-json/tabler/icons.json';
import App from './App';
import './index.css';
// Register Tabler icons locally so they render without CDN
addCollection(tablerData);
const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, staleTime: 30_000 },
    },
});
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsx(App, {}) }) }) }));
