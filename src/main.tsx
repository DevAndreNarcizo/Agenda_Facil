import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/react-query'
// Fontes empacotadas no build (woff2 locais): funcionam sem acesso ao Google Fonts.
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.tsx'

// Aplicar tema salvo antes do primeiro render (evita flash de tema errado)
const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
