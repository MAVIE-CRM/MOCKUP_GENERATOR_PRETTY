require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const onedrive = require('./onedrive.cjs');

// Health Check fondamentale per Railway
app.get('/', (req, res) => {
    console.log('HEALTH CHECK RECEIVED! ✅');
    res.status(200).send('OK');
});

// Endpoint per ottenere la lista delle grafiche
app.get('/api/grafiche', async (req, res) => {
    try {
        if (process.env.ONEDRIVE_REFRESH_TOKEN) {
            const filesData = await onedrive.getGrafiche();
            return res.json(filesData);
        }
        res.json([]);
    } catch (error) {
        console.error('Errore grafiche:', error);
        res.status(500).json({ error: 'Failed to read graphics' });
    }
});

// Endpoint per ottenere la struttura dei prodotti
app.get('/api/products', async (req, res) => {
    try {
        if (process.env.ONEDRIVE_REFRESH_TOKEN) {
            const products = await onedrive.getProducts();
            return res.json(products);
        }
        res.json([]);
    } catch (error) {
        console.error('Errore prodotti:', error);
        res.status(500).json({ error: 'Failed to read products' });
    }
});

// Proxy per Flora AI
app.post('/api/flora/*', async (req, res) => {
    try {
        const floraPath = req.params[0];
        const response = await axios({
            method: 'POST',
            url: `https://api.flora.ai/v1/${floraPath}`,
            data: req.body,
            headers: {
                'Authorization': `Bearer ${process.env.VITE_FLORA_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Flora Error' });
    }
});

app.get('/api/flora/*', async (req, res) => {
    try {
        const floraPath = req.params[0];
        const response = await axios({
            method: 'GET',
            url: `https://api.flora.ai/v1/${floraPath}`,
            headers: {
                'Authorization': `Bearer ${process.env.VITE_FLORA_API_KEY}`
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Flora Error' });
    }
});

app.get('/api/onedrive/file/:id', async (req, res) => {
    try {
        const stream = await onedrive.getFileStream(req.params.id);
        if (stream.pipe) {
            stream.pipe(res);
        } else {
            const buffer = Buffer.from(await stream.arrayBuffer());
            res.send(buffer);
        }
    } catch (error) {
        res.status(500).send('OneDrive Proxy Error');
    }
});

// Mantieni il processo vivo
setInterval(() => {
    // Questo previene la chiusura prematura del processo in alcuni ambienti
}, 1000 * 60 * 60);

app.listen(port, () => {
  console.log(`Server is LIVE on port ${port}`);
});
