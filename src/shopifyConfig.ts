/**
 * Configurazione Prodotti Shopify & Template Mapping
 * Pretty Studio Hub 2026
 */

export const SHOPIFY_TEMPLATES = {
  PLS: { id: "10566012895571", name: "PROFUMATORE", images: 2 },
  PLL: { id: "10411831165267", name: "LAMPADA", images: 2 },
  PLM: { id: "10435538780499", name: "MINISCENT", images: 1 },
  PLC: { id: "10566012895571", name: "CANDELA 220", images: 1 }, // ID placeholder
  PLC450: { id: "10566012895571", name: "CANDELA 450", images: 1 }, // ID placeholder
  PLV: { id: "10566012895571", name: "VASO", images: 2 } // ID placeholder
};

/**
 * Parsa il nome file per estrarre categoria, colore e grafica
 * Formato: PREFISSO_COLORE_NOMEGRAFICA_VARIANTE.jpg
 * Esempio: PLS_VERDE_A_CRESCERE_L.jpg
 */
export const parseProductName = (filename: string) => {
  if (!filename) return null;
  
  const cleanName = filename.replace(/\..+$/, '');
  const parts = cleanName.split('_');
  
  const prefix = parts[0]?.toUpperCase() || 'PLS';
  const template = SHOPIFY_TEMPLATES[prefix as keyof typeof SHOPIFY_TEMPLATES] || SHOPIFY_TEMPLATES.PLM;
  
  const formatCategory = (name: string) => {
    const n = name.toUpperCase();
    if (n === 'MINISCENT') return 'Mini Scent';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const variant = parts[parts.length - 1]?.toUpperCase();
  const hasExplicitVariant = ['L', 'A'].includes(variant);
  
  // LOGICA ROBUSTA: 
  // Se la seconda parte (parts[1]) è un colore noto, assumiamo che la grafica parta dalla 3a.
  // Altrimenti, se parts[1] non è un colore, partiamo dalla 2a.
  const commonColors = ['ARANCIO', 'VERDE', 'BLU', 'ROSSO', 'GIALLO', 'NERO', 'BIANCO', 'ORO', 'ARGENTO', 'LEGNO', 'TRASPARENTE'];
  const startIdx = commonColors.includes(parts[1]?.toUpperCase()) ? 2 : 1;
  const graphicParts = hasExplicitVariant ? parts.slice(startIdx, -1) : parts.slice(startIdx);
  
  const categoryLabel = formatCategory(template.name);
  const formattedGraphic = graphicParts.map(p => {
    if (!p) return '';
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(' ') || `${categoryLabel} Design`;

  const fullTitle = `${categoryLabel} - "${formattedGraphic}"`;

  return {
    prefix,
    categoryName: template.name,
    categoryLabel: categoryLabel,
    templateId: template.id,
    color: parts[1]?.toUpperCase() || 'DEFAULT',
    graphicName: formattedGraphic,
    expectedImages: template.images,
    fullTitle: fullTitle
  };
};
