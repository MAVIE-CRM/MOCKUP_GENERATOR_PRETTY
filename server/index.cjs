try {
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

    app.listen(port, '0.0.0.0', () => {
      console.log('-----------------------------------------');
      console.log(`PRETTY STUDIO BACKEND IS ONLINE`);
      console.log(`Port: ${port}`);
      console.log(`Time: ${new Date().toISOString()}`);
      console.log('-----------------------------------------');
    });

} catch (globalError) {
    console.error('CRITICAL STARTUP ERROR:', globalError);
    process.exit(1);
}
