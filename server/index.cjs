const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3005;

// Cache per i downloadUrl (scadono dopo 1 ora)
const urlCache = new Map();
const URL_TTL = 1000 * 60 * 55; // 55 minuti per sicurezza

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
            
            // Verifica se abbiamo un URL fresco in cache
            const cached = urlCache.get(fileId);
            if (cached && (Date.now() - cached.timestamp < URL_TTL)) {
                return res.redirect(cached.url);
            }

            try {
                const client = await onedrive.getClient();
                // Recuperiamo solo i metadati, incluso il downloadUrl
                const fileMetadata = await client.api(`/me/drive/items/${fileId}`).get();
                const downloadUrl = fileMetadata['@microsoft.graph.downloadUrl'];

                if (!downloadUrl) throw new Error('Download URL non trovato');

                // Salviamo in cache
                urlCache.set(fileId, {
                    url: downloadUrl,
                    timestamp: Date.now()
                });

                // Reindirizziamo il browser direttamente alla sorgente Microsoft
                res.redirect(downloadUrl);
            } catch (error) {
                console.error(`Errore redirect file ${fileId}:`, error.message);
                res.status(500).send('Errore nel recupero del file');
            }
        });

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

        app.listen(port, '0.0.0.0', () => {
            console.log(`PRETTY STUDIO BACKEND ONLINE - Speed Mode Active 🚀`);
        });

    } catch (err) {
        process.exit(1);
    }
}

startServer();
