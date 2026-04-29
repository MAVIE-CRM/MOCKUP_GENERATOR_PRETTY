const { Client } = require('@microsoft/microsoft-graph-client');
const axios = require('axios');
// Nota: In Node 18+ fetch è globale, non serve isomorphic-fetch

class OneDriveService {
    constructor() {
        this.client = null;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        const client_id = process.env.ONEDRIVE_CLIENT_ID;
        const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;
        const refresh_token = process.env.ONEDRIVE_REFRESH_TOKEN;

        if (!client_id || !client_secret || !refresh_token) {
            throw new Error('Credenziali OneDrive mancanti nel file .env');
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
            console.error('Errore durante il rinnovo del token OneDrive:', error.response?.data || error.message);
            throw new Error('Impossibile ottenere l\'access token di OneDrive');
        }
    }

    async getClient() {
        const token = await this.getAccessToken();
        return Client.init({
            authProvider: (done) => done(null, token)
        });
    }

    async walkFolder(folderPath) {
        const client = await this.getClient();
        try {
            const items = await client.api(`/me/drive/root:/APP_MOCKUP_ASSETS/${folderPath}:/children`).get();
            const results = [];
            for (const item of items.value) {
                if (item.folder) {
                    const subResults = await this.walkFolder(`${folderPath}/${item.name}`);
                    results.push(...subResults);
                } else if (item.file) {
                    const name = item.name.toLowerCase();
                    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg')) {
                        results.push({
                            id: item.id,
                            name: item.name,
                            path: item.id,
                            folder: folderPath.split('/').pop() || 'Principale',
                            downloadUrl: item['@microsoft.graph.downloadUrl']
                        });
                    }
                }
            }
            return results;
        } catch (error) {
            console.error(`ERROR walkFolder ${folderPath}:`, error.message);
            throw error;
        }
    }

    async getProducts() {
        const client = await this.getClient();
        try {
            const items = await client.api('/me/drive/root:/APP_MOCKUP_ASSETS:/children').get();
            const products = [];
            for (const item of items.value) {
                if (item.folder && item.name !== 'GRAFICHE') {
                    const components = {};
                    const compItems = await client.api(`/me/drive/root:/APP_MOCKUP_ASSETS/${item.name}:/children`).get();
                    for (const cDir of compItems.value) {
                        if (cDir.folder) {
                            const assets = await this.walkFolder(`${item.name}/${cDir.name}`);
                            components[cDir.name] = assets.map(asset => ({
                                ...asset,
                                fullPath: `/api/onedrive/file/${asset.id}`
                            }));
                        }
                    }
                    products.push({ id: item.name, name: item.name.toUpperCase(), components });
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
