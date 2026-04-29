require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3005;

app.use(cors()); // In produzione potremo restringerlo all'URL di Vercel
app.use(express.json({ limit: '50mb' }));

const onedrive = require('./onedrive.cjs');

// Health Check per Railway
app.get('/', (req, res) => {
    res.send('Pretty Studio Backend is running! 🚀');
});

// Gestione errori globale per evitare crash improvvisi
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Funzione ricorsiva per leggere tutti i file nelle sottocartelle
function walkSync(dir, filelist = [], baseDir = dir) {
    if (!fs.existsSync(dir)) return filelist;
    const files = fs.readdirSync(dir);
    files.forEach(function(file) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            filelist = walkSync(filePath, filelist, baseDir);
        } else {
            const ext = file.toLowerCase();
            if (ext.endsWith('.svg') || ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
                const relativePath = path.relative(baseDir, filePath);
                const folderName = path.dirname(relativePath) === '.' ? 'Principale' : path.dirname(relativePath);
                filelist.push({
                    name: file,
                    path: relativePath,
                    folder: folderName
                });
            }
        }
    });
    return filelist;
}

const BASE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'Library',
  'CloudStorage',
  'OneDrive-Personale',
  'APP_MOCKUP_ASSETS'
);

const GRAFICHE_DIR = path.join(BASE_DIR, 'GRAFICHE');
const PRODOTTI_DIR = BASE_DIR;

// Endpoint per ottenere la lista delle grafiche
app.get('/api/grafiche', async (req, res) => {
    try {
        if (process.env.ONEDRIVE_REFRESH_TOKEN) {
            console.log('Fetching grafiche from OneDrive...');
            const filesData = await onedrive.getGrafiche();
            return res.json(filesData);
        }
        
        // Fallback locale
        const filesData = walkSync(GRAFICHE_DIR);
        filesData.sort((a, b) => {
            if (a.folder !== b.folder) return a.folder.localeCompare(b.folder);
            return a.name.localeCompare(b.name);
        });
        res.json(filesData);
    } catch (error) {
        console.error('Errore lettura grafiche:', error);
        res.status(500).json({ error: 'Failed to read graphics' });
    }
});

// Endpoint per ottenere la struttura dei prodotti
app.get('/api/products', async (req, res) => {
    try {
        if (process.env.ONEDRIVE_REFRESH_TOKEN) {
            console.log('Fetching products from OneDrive...');
            const products = await onedrive.getProducts();
            return res.json(products);
        }

        // Fallback locale
        if (!fs.existsSync(PRODOTTI_DIR)) return res.json([]);
        const products = [];
        const items = fs.readdirSync(PRODOTTI_DIR);
        for (const item of items) {
            const itemPath = path.join(PRODOTTI_DIR, item);
            if (item === 'GRAFICHE' || item.startsWith('.') || !fs.statSync(itemPath).isDirectory()) continue;
            const components = {};
            const componentDirs = fs.readdirSync(itemPath).filter(f => fs.statSync(path.join(itemPath, f)).isDirectory());
            for (const cDir of componentDirs) {
                const compPath = path.join(itemPath, cDir);
                components[cDir] = walkSync(compPath).map(asset => ({
                    ...asset,
                    fullPath: `/product-files/${item}/${cDir}/${asset.path}`
                }));
            }
            products.push({ id: item, name: item.toUpperCase(), components });
        }
        res.json(products);
    } catch (error) {
        console.error('Errore lettura prodotti:', error);
        res.status(500).json({ error: 'Failed to read products' });
    }
});

// Proxy per file OneDrive
// Proxy per Flora AI
app.post('/api/flora/*', async (req, res) => {
    try {
        const floraPath = req.params[0];
        const response = await axios({
            method: req.method,
            url: `https://api.flora.ai/v1/${floraPath}`,
            data: req.body,
            headers: {
                'Authorization': `Bearer ${process.env.VITE_FLORA_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Flora Proxy Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
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
        console.error('Flora Proxy Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'Internal Server Error' });
    }
});

app.get('/api/onedrive/file/:id', async (req, res) => {
    try {
        const stream = await onedrive.getFileStream(req.params.id);
        // Se lo stream è un Readable Stream (node-fetch)
        if (stream.pipe) {
            stream.pipe(res);
        } else {
            // Se è un Blob o altro (microsoft-graph-client può restituire diverse cose a seconda dell'ambiente)
            const buffer = Buffer.from(await stream.arrayBuffer());
            res.send(buffer);
        }
    } catch (error) {
        console.error('Errore proxy OneDrive:', error);
        res.status(500).send('Errore durante il recupero del file da OneDrive');
    }
});

if (fs.existsSync(GRAFICHE_DIR)) {
    app.use('/grafiche-files', express.static(GRAFICHE_DIR));
}
if (fs.existsSync(PRODOTTI_DIR)) {
    app.use('/product-files', express.static(PRODOTTI_DIR));
}

app.listen(port, '0.0.0.0', () => {
  console.log('-----------------------------------------');
  console.log(`PRETTY STUDIO SERVER STARTING...`);
  console.log(`Port: ${port}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`OneDrive Token: ${process.env.ONEDRIVE_REFRESH_TOKEN ? 'Present' : 'MISSING'}`);
  console.log(`Server listening at 0.0.0.0:${port}`);
  console.log('-----------------------------------------');
});
