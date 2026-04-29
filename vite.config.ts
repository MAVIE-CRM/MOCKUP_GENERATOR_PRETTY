import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'internal-upload-api',
      configureServer(server) {
        server.middlewares.use('/api/internal/upload', async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const imageData = parsed.image; // Data-URL completo
                
                const form = new FormData();
                form.append('file', imageData);
                form.append('upload_preset', 'unsigned_sample'); // Preset pubblico di Cloudinary

                // Chiamata a Cloudinary (estremamente stabile e professionale)
                const uploadRes = await axios.post('https://api.cloudinary.com/v1_1/demo/image/upload', form, {
                  headers: { ...form.getHeaders() }
                });
                
                const publicUrl = uploadRes.data.secure_url;

                console.log('--- CLOUDINARY UPLOAD SUCCESS ---');
                console.log('URL:', publicUrl);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ url: publicUrl }));
              } catch (err: any) {
                console.error('SERVER UPLOAD ERROR:', err.response?.data || err.message);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: `Errore Cloudinary: ${err.message}` }));
              }
            });
          }
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api/flora': {
        target: 'https://app.flora.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/flora/, '/api/v1'),
      },
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
      '/grafiche-files': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
      '/product-files': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
    },
    port: 5173
  }
})
