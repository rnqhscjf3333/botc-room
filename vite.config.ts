import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' → GitHub Pages(하위 경로)에서도 그대로 동작
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '시계탑에 흐른 피 – 파티룸',
        short_name: '시계피',
        description: '파티룸용 시계탑에 흐른 피 보조 도구',
        lang: 'ko',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0e0e14',
        theme_color: '#0e0e14',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'] },
    }),
  ],
})
