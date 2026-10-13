import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Identificador único de cada build. Vai embutido no bundle (__BUILD_ID__) e
// também publicado em /version.json, para o app instalado (PWA) descobrir que
// existe uma versão mais nova — ver src/utils/versionCheck.ts.
const BUILD_ID = Date.now().toString()

const emitVersionFile = (): Plugin => ({
  name: 'emit-version-json',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ buildId: BUILD_ID })
    })
  }
})

export default defineConfig({
  plugins: [react(), tailwindcss(), emitVersionFile()],
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID)
  },
  build: {
    outDir: 'dist',
  }
})
