try {
    require('dotenv').config();
    const express = require('express');
    const cors = require('cors');
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    console.log('--- DEBUG CONFIG ---');
    console.log('Current Dir:', process.cwd());
    console.log('.env path:', path.join(process.cwd(), '.env'));
    console.log('OneDrive Token exists:', !!process.env.ONEDRIVE_REFRESH_TOKEN);
    console.log('---------------------');

    const app = express();
    const port = process.env.PORT || 4000;

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // Middleware per bypassare l'avviso di Ngrok sulle chiamate API
    app.use((req, res, next) => {
        res.setHeader('ngrok-skip-browser-warning', 'true');
        next();
    });

    const onedrive = require('./onedrive.cjs');

    // Health Check fondamentale per Railway
    app.get('/', (req, res) => {
        console.log('HEALTH CHECK RECEIVED! ✅');
        res.status(200).send('OK - SERVER IS ALIVE');
    });

    app.get('/api/grafiche', async (req, res) => {
        try {
            if (process.env.ONEDRIVE_REFRESH_TOKEN) {
                const filesData = await onedrive.getGrafiche();
                return res.json(filesData);
            }
            res.json([]);
        } catch (error) {
            console.error('Errore grafiche:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/products', async (req, res) => {
        try {
            if (process.env.ONEDRIVE_REFRESH_TOKEN) {
                const products = await onedrive.getProducts();
                return res.json(products);
            }
            res.json([]);
        } catch (error) {
            console.error('Errore prodotti:', error);
            res.status(500).json({ error: error.message });
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
            console.error('OneDrive Proxy Error:', error);
            res.status(500).send('OneDrive Proxy Error');
        }
    });

    // Battito cardiaco per confermare che il server non è congelato
    setInterval(() => {
        console.log(`Server Heartbeat: ${new Date().toLocaleTimeString()} - Still alive! ❤️`);
    }, 5000);

    const host = process.env.RAILWAY_STATIC_URL ? '0.0.0.0' : 'localhost';

    app.listen(port, '0.0.0.0', () => {
      console.log('-----------------------------------------');
      console.log(`PRETTY STUDIO BACKEND IS ONLINE`);
      console.log(`Port: ${port}`);
      console.log(`Host: 0.0.0.0`);
      console.log(`Time: ${new Date().toISOString()}`);
      console.log('-----------------------------------------');
    });

} catch (globalError) {
    console.error('CRITICAL STARTUP ERROR:', globalError);
    process.exit(1);
}
