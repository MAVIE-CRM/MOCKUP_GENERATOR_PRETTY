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

        // Middleware di Autenticazione
        const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'pretty2024';
        
        const authMiddleware = (req, res, next) => {
            if (req.path === '/' || req.path === '/api/health') return next();
            
            // Accettiamo la password sia dall'header che dal parametro 'token' nell'URL (necessario per le immagini)
            const clientPass = req.headers['x-api-key'] || req.query.token;
            
            if (clientPass === AUTH_PASSWORD) {
                next();
            } else {
                res.status(401).json({ error: 'Accesso non autorizzato. Password errata o mancante.' });
            }
        };

        app.use((req, res, next) => {
            res.setHeader('ngrok-skip-browser-warning', 'true');
            next();
        });

        // Applichiamo il middleware a tutte le rotte /api
        app.use('/api', authMiddleware);

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
            
            try {
                // Recuperiamo il downloadUrl (usando la cache se disponibile)
                let downloadUrl;
                const cached = urlCache.get(fileId);
                if (cached && (Date.now() - cached.timestamp < URL_TTL)) {
                    downloadUrl = cached.url;
                } else {
                    const client = await onedrive.getClient();
                    const fileMetadata = await client.api(`/me/drive/items/${fileId}`).get();
                    downloadUrl = fileMetadata['@microsoft.graph.downloadUrl'];
                    if (!downloadUrl) throw new Error('Download URL non trovato');
                    urlCache.set(fileId, { url: downloadUrl, timestamp: Date.now() });
                }

                // Invece di redirect, facciamo un proxy dell'immagine per gestire CORS correttamente
                const response = await axios({
                    method: 'get',
                    url: downloadUrl,
                    responseType: 'stream'
                });

                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
                
                response.data.pipe(res);
            } catch (error) {
                console.error(`Errore proxy file ${fileId}:`, error.message);
                res.status(500).send('Errore nel recupero del file via proxy');
            }
        });

        // --- SHOPIFY OAUTH & PROXY ---
        
        let shopifyTokenCache = { token: null, expires: 0 };

        async function getShopifyToken() {
            // Se abbiamo un token diretto nell'env, usiamolo (es. shpss_ o shpat_)
            const directToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.VITE_SHOPIFY_CLIENT_SECRET;
            if (directToken && (directToken.startsWith('shpat_') || directToken.startsWith('shpss_'))) {
                return directToken;
            }

            const now = Date.now();
            if (shopifyTokenCache.token && now < shopifyTokenCache.expires) {
                return shopifyTokenCache.token;
            }

            const shop = process.env.SHOPIFY_STORE || process.env.VITE_SHOPIFY_STORE || 'prettylittle-it.myshopify.com';
            const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.VITE_SHOPIFY_CLIENT_ID;
            const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.VITE_SHOPIFY_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error("Credenziali Shopify mancanti (Client ID o Secret)");
            }

            console.log(`🔑 Richiesta nuovo token Shopify via OAuth per ${shop}...`);
            
            try {
                const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials'
                });

                shopifyTokenCache = {
                    token: response.data.access_token,
                    expires: now + (1000 * 60 * 60 * 23)
                };
                return shopifyTokenCache.token;
            } catch (err) {
                console.error("❌ Errore OAuth Shopify:", err.response?.data || err.message);
                throw new Error("Impossibile ottenere il token Shopify");
            }
        }

        app.post('/api/shopify-publish', async (req, res) => {
            const { action, data } = req.body;
            const shop = process.env.SHOPIFY_STORE || process.env.VITE_SHOPIFY_STORE || 'prettylittle-it.myshopify.com';
            
            try {
                const token = await getShopifyToken();
                const headers = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };
                const baseUrl = `https://${shop}/admin/api/2024-01`;

                if (action === 'duplicate') {
                    const response = await axios.post(`${baseUrl}/products/${data.templateId}/duplicate.json`, {
                        product: { title: data.title, status: 'draft' }
                    }, { headers });
                    return res.json(response.data);
                }

                if (action === 'get-product') {
                    const response = await axios.get(`${baseUrl}/products/${data.productId}.json`, { headers });
                    return res.json(response.data);
                }

                if (action === 'update-product') {
                    const response = await axios.put(`${baseUrl}/products/${data.productId}.json`, {
                        product: data.product
                    }, { headers });
                    return res.json(response.data);
                }

                if (action === 'upload-image') {
                    const response = await axios.post(`${baseUrl}/products/${data.productId}/images.json`, {
                        image: { attachment: data.attachment, filename: data.filename, alt: data.alt, position: data.position }
                    }, { headers });
                    return res.json(response.data);
                }

                if (action === 'check-file') {
                    // Cerca il file nella Media Library (GraphQL è meglio, ma usiamo REST per ora o cerchiamo per nome)
                    // In alternativa cerchiamo nei metafields o carichiamo sempre se non sicuro.
                    // Per ora implementiamo il caricamento come "file" (Stage-based upload in Shopify è complesso, usiamo il trucco dell'URL)
                    return res.json({ exists: false }); 
                }

                if (action === 'set-metafields') {
                    for (const mf of data.metafields) {
                        await axios.post(`${baseUrl}/products/${data.productId}/metafields.json`, {
                            metafield: mf
                        }, { headers });
                    }
                    return res.json({ success: true });
                }

                res.status(400).json({ error: 'Azione non valida' });
            } catch (error) {
                console.error(`Shopify Proxy Error (${action}):`, error.response?.data || error.message);
                res.status(500).json(error.response?.data || { error: error.message });
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
