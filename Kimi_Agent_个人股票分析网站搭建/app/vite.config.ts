// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// GitHub Pages 部署配置
// 如果用用户页面 (username.github.io): base = '/'
// 如果用项目页面 (username.github.io/alphawave): base = '/alphawave/'
const BASE = process.env.GH_PAGES_BASE || '/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
