/**
 * Shopify Service 2026 - Proxy Mode
 * Gestisce la comunicazione con lo Shopify Store tramite il backend locale
 */

import { parseProductName } from './shopifyConfig';
import { config } from './config';

interface PublishData {
  title: string;
  description: string;
  tags: string;
  color: string;
  images: { base64: string, filename: string, alt: string }[];
  svgFilename: string;
  podWidth?: number;
  podHeight?: number;
  getBase64FromOneDrive: (filename: string) => Promise<string>;
}

const API_PATH = `${config.apiUrl}/api/shopify-publish`;

/**
 * Funzione principale per la creazione del prodotto su Shopify
 */
export const createProductFromMockup = async (data: PublishData, logCallback: (msg: string) => void) => {
  const authPass = localStorage.getItem('pretty_auth') || '';
  const headers = { 
    'Content-Type': 'application/json',
    'x-api-key': authPass
  };

  try {
    logCallback("🚀 Inizio processo di pubblicazione (Proxy Mode)...");

    // 0. Parsing Naming per Categoria e Template
    const parsed = parseProductName(data.images[0]?.filename);
    if (!parsed) throw new Error("Impossibile parsare il nome file per identificare il prodotto");
    
    logCallback(`📦 Categoria rilevata: ${parsed.categoryName}`);

    // 1. Duplicazione Template
    logCallback(`📄 Duplicazione prodotto template (${parsed.templateId})...`);
    const dupRes = await fetch(API_PATH, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'duplicate',
        data: { templateId: parsed.templateId, title: data.title }
      })
    });
    
    const dupResult = await dupRes.json();
    if (!dupRes.ok) throw new Error(`Duplicazione fallita: ${JSON.stringify(dupResult)}`);
    
    const productId = dupResult.product.id;
    logCallback(`✅ Prodotto creato come BOZZA (ID: ${productId})`);

    // 1.5 Aggiornamento Descrizione (Se modificata o caricata dal template)
    if (data.description) {
      logCallback(`📝 Aggiornamento descrizione prodotto...`);
      await fetch(API_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'update-product',
          data: { 
            productId, 
            product: { body_html: data.description } 
          }
        })
      });
    }

    // 2. Caricamento Immagini
    // Filtriamo le immagini in base alla categoria
    const imagesToUpload = data.images.slice(0, parsed.expectedImages);
    logCallback(`🖼️ Caricamento ${imagesToUpload.length} immagini mockup...`);
    
    for (let i = 0; i < imagesToUpload.length; i++) {
      const img = imagesToUpload[i];
      logCallback(`   - Upload: ${img.filename} (Pos: ${i + 1})...`);
      
      const imgRes = await fetch(API_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'upload-image',
          data: {
            productId,
            attachment: img.base64.split(',')[1],
            filename: img.filename,
            alt: img.alt,
            position: i + 1
          }
        })
      });
      if (!imgRes.ok) logCallback(`   ⚠️ Errore upload ${img.filename}, salto...`);
    }

    // 3. Gestione Metafield & SVG
    logCallback(`🧬 Configurazione Metafield POD & Upload SVG...`);
    
    let svgUrl = "";
    try {
      logCallback(`   - Recupero SVG da OneDrive...`);
      const svgBase64Full = await data.getBase64FromOneDrive(data.svgFilename);
      const svgBase64 = svgBase64Full.split(',')[1];
      
      logCallback(`   - Upload SVG su Shopify CDN...`);
      const svgRes = await fetch(API_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'upload-file',
          data: {
            filename: data.svgFilename,
            attachment: svgBase64
          }
        })
      });
      const svgResult = await svgRes.json();
      if (svgResult.success && svgResult.file && svgResult.file.url) {
        svgUrl = svgResult.file.url;
        logCallback(`   ✅ SVG Caricato: ${svgUrl}`);
      } else {
        logCallback(`   ⚠️ Upload SVG fallito, procedo senza URL...`);
      }
    } catch (e: any) {
      logCallback(`   ⚠️ Errore durante gestione SVG: ${e.message}`);
    }

    const metafields = [
      { namespace: "custom", key: "pod_color", value: data.color, type: "single_line_text_field" },
      { namespace: "custom", key: "pod_svg_name", value: data.svgFilename, type: "single_line_text_field" },
      { namespace: "custom", key: "pod_width_mm", value: (data.podWidth || 666).toString(), type: "number_integer" },
      { namespace: "custom", key: "pod_height_mm", value: (data.podHeight || 666).toString(), type: "number_integer" }
    ];

    if (svgUrl) {
      metafields.push({ namespace: "custom", key: "pod_svg_url", value: svgUrl, type: "url" });
    }

    const mfRes = await fetch(API_PATH, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'set-metafields',
        data: { productId, metafields }
      })
    });
    if (mfRes.ok) logCallback(`✅ Metafield aggiornati correttamente`);

    logCallback(`🎉 PRODOTTO PRONTO!`);
    
    const storeName = (import.meta.env.VITE_SHOPIFY_STORE || 'prettylittle-it.myshopify.com').split('.')[0];
    return {
      success: true,
      productId,
      adminUrl: `https://admin.shopify.com/store/${storeName}/products/${productId}`
    };

  } catch (error: any) {
    logCallback(`❌ ERRORE: ${error.message}`);
    return { success: false, error: error.message };
  }
};
