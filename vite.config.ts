import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // هام جداً لـ GitHub Pages لضمان تحميل الملفات (CSS/JS) بشكل صحيح
  base: './', 
  server: {
    port: 3000,
    open: true
  }
});