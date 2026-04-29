const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3005;

// Sistema di Cache in memoria per le immagini di OneDrive
const imageCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 ora

async function startServer() {
    try {
        require('dotenv').config();

        app.use(cors());
        app.use(express.json({ limit: '50mb' }));

        app.use((req, res, next) => {
            res.setHeader('ngrok-skip-browser-warning', 'true');
            next();
        });

        const onedrive = require('./onedrive.cjs');

        app.get('/', (req, res) => {
            console.log('HEALTH CHECK RECEIVED! ✅');
            res.status(200).send('OK - SERVER IS ALIVE');
        });

        app.get('/api/products', async (req, res) => {
            try {
                const products = await onedrive.getProducts();
                res.json(products);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.get('/api/grafiche', async (req, res) => {
            try {
                const grafiche = await onedrive.getGrafiche();
                res.json(grafiche);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.get('/api/onedrive/file/:id', async (req, res) => {
            const fileId = req.params.id;
            
            // Verifica Cache
            const cached = imageCache.get(fileId);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                res.setHeader('Content-Type', cached.contentType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                return res.send(cached.data);
            }

            try {
                const client = await onedrive.getClient();
                const response = await client.api(`/me/drive/items/${fileId}/content`).get();
                
                // Convertiamo in Buffer per la cache
                const buffer = Buffer.isBuffer(response) ? response : Buffer.from(await response.arrayBuffer());
                const contentType = 'image/png'; // Default per i nostri asset

                imageCache.set(fileId, {
                    data: buffer,
                    contentType: contentType,
                    timestamp: Date.now()
                });

                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.send(buffer);
            } catch (error) {
                console.error(`Errore proxy file ${fileId}:`, error.message);
                res.status(500).send('Errore nel recupero del file');
            }
        });

        // Proxy per Flora AI (per evitare CORS lato client)
        app.post('/api/flora/generate', async (req, res) => {
            try {
                const response = await axios.post('https://api.flora.ai/v1/generate', req.body, {
                    headers: { 'Authorization': `Bearer ${process.env.FLORA_API_KEY}` }
                });
                res.json(response.data);
            } catch (error) {
                res.status(500).json({ error: 'Errore Flora AI Proxy' });
            }
        });

        setInterval(() => {
            console.log(`Server Heartbeat: ${new Date().toLocaleTimeString()} - Cache Size: ${imageCache.size} items`);
        }, 10000);

        app.listen(port, '0.0.0.0', () => {
            console.log(`PRETTY STUDIO BACKEND ONLINE - Port: ${port}`);
        });

    } catch (err) {
        console.error('CRITICAL STARTUP ERROR:', err);
        process.exit(1);
    }
}

startServer();
