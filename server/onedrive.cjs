const { Client } = require('@microsoft/microsoft-graph-client');
const axios = require('axios');

class OneDriveService {
    constructor() {
        this.client = null;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.rootId = null;
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        const client_id = process.env.ONEDRIVE_CLIENT_ID;
        const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;
        const refresh_token = process.env.ONEDRIVE_REFRESH_TOKEN;

        if (!client_id || !client_secret || !refresh_token) {
            throw new Error('Credenziali OneDrive mancanti');
        }

        const tenant_id = 'common';
        
        try {
            const response = await axios.post(`https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`, 
                new URLSearchParams({
                    client_id,
                    client_secret,
                    refresh_token,
                    grant_type: 'refresh_token',
                    scope: 'offline_access Files.Read.All'
                }).toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            return this.accessToken;
        } catch (error) {
            console.error('Errore rinnovo token:', error.response?.data || error.message);
            throw new Error('Impossibile ottenere l\'access token');
        }
    }

    async getClient() {
        const token = await this.getAccessToken();
        return Client.init({
            authProvider: (done) => done(null, token)
        });
    }

    async findRootId() {
        if (this.rootId) return this.rootId;
        
        const client = await this.getClient();
        console.log('Ricerca globale della cartella MOCKUP...');
        
        const searchResult = await client.api('/me/drive/root/search(q=\'MOCKUP\')').get();
        const folder = searchResult.value.find(item => item.folder);

        if (!folder) {
            console.error('ERRORE: Nessuna cartella MOCKUP trovata!');
            throw new Error('Cartella principale non trovata');
        }

        this.rootId = folder.id;
        console.log(`Cartella identificata: ${folder.name} (ID: ${folder.id})`);
        return this.rootId;
    }

    async walkFolder(folderPath) {
        const client = await this.getClient();
        const rootId = await this.findRootId();
        try {
            // Proviamo a cercare la cartella in modo case-insensitive
            const parentItems = await client.api(`/me/drive/items/${rootId}/children`).get();
            const targetFolder = parentItems.value.find(item => 
                item.folder && item.name.toUpperCase() === folderPath.toUpperCase()
            );

            if (!targetFolder) {
                console.warn(`Cartella ${folderPath} non trovata in questo percorso.`);
                return [];
            }

            return await this._recursiveWalk(targetFolder.id, '');
        } catch (error) {
            console.error(`ERROR walkFolder ${folderPath}:`, error.message);
            return [];
        }
    }

    async _recursiveWalk(itemId, currentPath) {
        const client = await this.getClient();
        const results = [];
        try {
            const items = await client.api(`/me/drive/items/${itemId}/children`).get();
            for (const item of items.value) {
                if (item.folder) {
                    const subResults = await this._recursiveWalk(item.id, currentPath ? `${currentPath}/${item.name}` : item.name);
                    results.push(...subResults);
                } else if (item.file) {
                    const name = item.name.toLowerCase();
                    if (name.includes('principale')) continue;
                    
                    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg')) {
                        results.push({
                            id: item.id,
                            name: item.name,
                            path: item.id, // Usiamo l'ID per il fetch
                            fullPath: `/api/onedrive/file/${item.id}`,
                            folder: currentPath.split('/').pop() || 'Principale'
                        });
                    }
                }
            }
            return results;
        } catch (e) {
            return [];
        }
    }

    async getProducts() {
        const client = await this.getClient();
        const rootId = await this.findRootId();
        try {
            const products = [];
            const subItems = await client.api(`/me/drive/items/${rootId}/children`).get();

            for (const item of subItems.value) {
                if (item.folder && item.name.toUpperCase() !== 'GRAFICHE') {
                    const components = {};
                    const compItems = await client.api(`/me/drive/items/${item.id}/children`).get();
                    for (const cDir of compItems.value) {
                        if (cDir.folder) {
                            const assets = await this._recursiveWalk(cDir.id, cDir.name);
                            if (assets.length > 0) {
                                components[cDir.name] = assets;
                            }
                        }
                    }
                    if (Object.keys(components).length > 0) {
                        products.push({ id: item.name, name: item.name.toUpperCase(), components });
                    }
                }
            }
            return products;
        } catch (error) {
            console.error('ERROR getProducts:', error.message);
            throw error;
        }
    }

    async getGrafiche() {
        return await this.walkFolder('GRAFICHE');
    }

    async getFileStream(fileId) {
        const client = await this.getClient();
        const response = await client.api(`/me/drive/items/${fileId}/content`).get();
        return response;
    }
}

module.exports = new OneDriveService();
