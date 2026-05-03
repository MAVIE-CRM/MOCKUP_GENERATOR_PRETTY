const express = require('express');
const cors = require('cors'); // Force Vercel Redeploy - 2026-05-03
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3005;

// Cache per i downloadUrl (scadono dopo 1 ora)
const urlCache = new Map();
const URL_TTL = 1000 * 60 * 55; // 55 minuti per sicurezza

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Middleware di Autenticazione
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'pretty2024';
const authMiddleware = (req, res, next) => {
    if (req.path === '/' || req.path === '/api/health') return next();
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
    res.status(200).send('OK - SERVER IS ALIVE. Go to /auth/shopify to authenticate with Shopify.');
});

// --- SHOPIFY OAUTH FLOW ---
app.get('/auth/shopify', (req, res) => {
    const shop = process.env.SHOPIFY_STORE || 'prettylittle-it.myshopify.com';
    const clientId = process.env.SHOPIFY_CLIENT_ID || '0e5d2e4d3cefc2e675b9aef9122e7027';
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI || (process.env.NODE_ENV === 'production' ? 'https://studio.prettylittle.it/auth/callback' : `http://localhost:${port}/auth/callback`);
    const scopes = 'read_products,write_products,read_files,write_files,read_product_listings,write_product_listings';
    const state = 'prettystudio2026';

    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
    console.log(`🔗 Redirecting to Shopify Auth: ${authUrl}`);
    res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
    const { shop, code, state } = req.query;
    const clientId = process.env.SHOPIFY_CLIENT_ID || '0e5d2e4d3cefc2e675b9aef9122e7027';
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!code) return res.status(400).send('Missing code parameter');

    try {
        console.log(`🔄 Exchanging code for token for shop: ${shop}...`);
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: clientId,
            client_secret: clientSecret,
            code
        });

        const accessToken = response.data.access_token;
        
        res.send(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #2c3e50;">✅ Autenticazione Shopify Completata!</h1>
                <p style="font-size: 18px; color: #7f8c8d;">Copia il seguente token e aggiungilo alle variabili d'ambiente (SHOPIFY_ACCESS_TOKEN):</p>
                <div style="background: #f4f7f6; padding: 20px; border-radius: 12px; border: 2px dashed #bdc3c7; font-family: monospace; font-size: 24px; margin: 20px 0; word-break: break-all;">
                    ${accessToken}
                </div>
                <p style="color: #e74c3c; font-weight: bold;">⚠️ Non condividere questo token con nessuno.</p>
                <button onclick="navigator.clipboard.writeText('${accessToken}')" style="background: #27ae60; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold;">Copia negli Appunti</button>
            </div>
        `);
    } catch (error) {
        console.error("❌ Errore scambio token:", error.response?.data || error.message);
        res.status(500).json(error.response?.data || { error: error.message });
    }
});
// --- END OAUTH FLOW ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
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
        const response = await axios({ method: 'get', url: downloadUrl, responseType: 'stream' });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('Errore nel recupero del file');
    }
});

let shopifyTokenCache = { token: null, expires: 0 };
async function getShopifyToken() {
    // SCANSIONE TOTALE: Cerchiamo in tutte le variabili d'ambiente un valore che sembri un token Shopify
    let directToken = process.env.SHOPIFY_ACCESS_TOKEN || 
                      process.env.SHOPIFY_CLIENT_SECRET || 
                      process.env.VITE_SHOPIFY_ACCESS_TOKEN ||
                      process.env.VITE_SHOPIFY_CLIENT_SECRET;

    if (!directToken) {
        // Ultima spiaggia: cerchiamo in TUTTE le variabili se ne esiste una che inizia con shpat o shpss
        const allKeys = Object.keys(process.env);
        for (const key of allKeys) {
            const val = process.env[key];
            if (val && (val.startsWith('shpat_') || val.startsWith('shpss_'))) {
                directToken = val;
                console.log(`✅ Token trovato automaticamente nella variabile: ${key}`);
                break;
            }
        }
    }

    if (directToken && (directToken.startsWith('shpat_') || directToken.startsWith('shpss_'))) {
        return directToken;
    }

    const now = Date.now();
    if (shopifyTokenCache.token && now < shopifyTokenCache.expires) return shopifyTokenCache.token;

    const shop = process.env.SHOPIFY_STORE || 'prettylittle-it.myshopify.com';
    const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.VITE_SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.VITE_SHOPIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(`Credenziali Shopify mancanti. Assicurati di avere SHOPIFY_ACCESS_TOKEN o (CLIENT_ID e SECRET) su Railway. Variabili trovate: ${Object.keys(process.env).filter(k => k.includes('SHOPIFY')).join(', ')}`);
    }

    console.log(`🔑 Richiesta nuovo token Shopify via OAuth per ${shop}...`);
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
    });
    shopifyTokenCache = { token: response.data.access_token, expires: now + (1000 * 60 * 60 * 23) };
    return shopifyTokenCache.token;
}

app.post('/api/shopify-publish', async (req, res) => {
    const { action, data } = req.body;
    const shop = process.env.SHOPIFY_STORE || 'prettylittle-it.myshopify.com';
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
            const response = await axios.put(`${baseUrl}/products/${data.productId}.json`, { product: data.product }, { headers });
            return res.json(response.data);
        }
        if (action === 'upload-image') {
            const response = await axios.post(`${baseUrl}/products/${data.productId}/images.json`, {
                image: { attachment: data.attachment, filename: data.filename, alt: data.alt, position: data.position }
            }, { headers });
            return res.json(response.data);
        }
        if (action === 'set-metafields') {
            for (const mf of data.metafields) {
                await axios.post(`${baseUrl}/products/${data.productId}/metafields.json`, { metafield: mf }, { headers });
            }
            return res.json({ success: true });
        }
        res.status(400).json({ error: 'Azione non valida' });
    } catch (error) {
        res.status(500).json(error.response?.data || { error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(port, '0.0.0.0', () => {
        console.log(`PRETTY STUDIO BACKEND ONLINE - Port: ${port} 🚀`);
    });
}

module.exports = app;
