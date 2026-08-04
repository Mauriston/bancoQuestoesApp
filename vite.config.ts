// ==========================================
// ARQUIVO: vite.config.ts
// ==========================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Documentação: defineConfig exporta as configurações do Vite
export default defineConfig({
  // Documentação: Plugins essenciais do seu projeto
  plugins: [react(), tailwindcss()],
  
  // Documentação: [CORREÇÃO] A propriedade 'base' é OBRIGATÓRIA para o GitHub Pages.
  // Ela deve ter exatamente o nome do seu repositório entre barras.
  base: '/bancoQuestoesApp/', 
  
  // Documentação: Configurações do servidor de desenvolvimento local
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
}); // Documentação: [CORREÇÃO] Chaves de fechamento adicionadas aqui!
