import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

function copyDirPlugin(src, dest) {
  return {
    name: 'copy-addon-dir',
    closeBundle() {
      function copyRecursive(s, d) {
        fs.mkdirSync(d, { recursive: true })
        for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
          const sp = resolve(s, entry.name)
          const dp = resolve(d, entry.name)
          if (entry.isDirectory()) copyRecursive(sp, dp)
          else fs.copyFileSync(sp, dp)
        }
      }
      const srcPath = resolve(process.cwd(), src)
      const destPath = resolve(process.cwd(), 'dist', dest)
      if (fs.existsSync(srcPath)) copyRecursive(srcPath, destPath)
    }
  }
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5174
  },
  plugins: [copyDirPlugin('addon', 'addon')]
})
