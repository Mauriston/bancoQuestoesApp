import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Documentação: Configuração base do Vite. 
// O 'base: "/"' assegura que os caminhos dos arquivos gerados sejam encontrados pelo Firebase.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
  }
})
