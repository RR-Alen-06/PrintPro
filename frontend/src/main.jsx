import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App'
import { AppProvider } from './context/AppContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'PRINTPRO_REACT_QUERY_CACHE',
  serialize: (data) => JSON.stringify(data),
  deserialize: (str) => JSON.parse(str),
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>
)
