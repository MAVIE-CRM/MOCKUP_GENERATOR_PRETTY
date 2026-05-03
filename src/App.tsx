import { useState, useEffect, useMemo, useRef } from 'react';
import { Download, RefreshCcw, Video, Wand2, AlertCircle, CheckCircle2, Search, Folder, ChevronRight, ChevronDown, Lock, Unlock, ArrowRight, History, Ruler, Save, Eye, EyeOff, Layers, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import MockupCanvas from './components/MockupCanvas';
// I prodotti e le grafiche vengono ora caricati dinamicamente da OneDrive
import { floraService } from './services/flora.service';
import type { FloraResponse } from './services/flora.service';
import { config } from './config';
import PublishDashboard from "./components/PublishDashboard";
import { createProductFromMockup } from "./shopifyService";
import { parseProductName } from "./shopifyConfig";

interface GraphicAsset {
  name: string;
  path: string;
  folder: string;
  fullPath: string;
}

interface ComponentAsset extends GraphicAsset {
  fullPath: string;
}

interface Product {
  id: string;
  name: string;
  components: Record<string, ComponentAsset[]>;
}

interface DownloadHistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  productName: string;
  graphicName: string;
  thumbnail?: string;
}

const EXTENDED_MAP: Record<string, string> = {
  'BK': '#1A1A1A', 'BLACK': '#1A1A1A', 'NERO': '#1A1A1A', 'NER': '#1A1A1A',
  'RED': '#EF4444', 'ROSSO': '#EF4444', 'ROS': '#EF4444',
  'PNK': '#F472B6', 'PINK': '#F472B6', 'ROSA': '#F472B6',
  'BEI': '#D6D3D1', 'BEIGE': '#D6D3D1',
  'BLU': '#1D4ED8', 'BLUE': '#1D4ED8',
  'AZZ': '#60A5FA', 'AZZURRO': '#60A5FA',
  'VER': '#22C55E', 'VERDE': '#22C55E',
  'YW': '#EAB308', 'YELLOW': '#EAB308', 'GIALLO': '#EAB308', 'GIA': '#EAB308',
  'WH': '#FFFFFF', 'WHITE': '#FFFFFF', 'BIANCO': '#FFFFFF', 'BIA': '#FFFFFF',
  'ARG': '#94A3B8', 'SILVER': '#94A3B8', 'ARGENTO': '#94A3B8',
  'ORO': '#D4AF37', 'GOLD': '#D4AF37', 'ORA': '#D4AF37',
  'VIO': '#A855F7', 'VIOLA': '#A855F7',
  'COB': '#0047AB', 'ROY': '#4169E1', 'TIF': '#0ABAB5',
  'BOR': '#800020', 'CIL': '#D21F3C', 'GRA': '#4A4A4A', 'GRI': '#808080',
  'LIL': '#C8A2C8', 'MAG': '#C0007A', 'MAL': '#E0B0FF', 'MAN': '#FF8C00',
  'MEN': '#98FB98', 'NAV': '#000080', 'OLI': '#808000', 'OTT': '#008080',
  'POL': '#B0C4DE', 'RUG': '#A0522D', 'SAB': '#F4A460', 'SAL': '#FA8072',
  'BAB': '#F0E68C', 'CYT': '#E4D00A', 'ARA': '#F97316', 'MAR': '#451A03',
};

const DEFAULT_CALIBRATION = { centerY: 0.5, baseWidth: 300 };

const PRODUCT_CALIBRATION: { keywords: string[], centerY: number, baseWidth: number }[] = [
  { keywords: ['CANDELA 220'], centerY: 0.55, baseWidth: 320 },
  { keywords: ['CANDELA 450'], centerY: 0.55, baseWidth: 380 },
  { keywords: ['MINI', 'STICK'], centerY: 0.65, baseWidth: 240 },
  { keywords: ['PROFUMATORE', 'PROF_', 'BARATTOLO'], centerY: 0.76, baseWidth: 285 },
  { keywords: ['LAMPADA', 'LAMP_'], centerY: 0.74, baseWidth: 285 },
];

const normalize = (c: string) => {
  const s = c.toUpperCase();
  if (s === 'ARANCIO' || s === 'ARANCIONE') return 'ARANCIO';
  if (s === 'NERO' || s === 'BLACK' || s === 'BK') return 'NERO';
  if (s === 'BIANCO' || s === 'WHITE' || s === 'OFFWHITE') return 'BIANCO';
  if (s === 'ORO' || s === 'GOLD') return 'ORO';
  if (s === 'ARGENTO' || s === 'SILVER') return 'ARGENTO';
  if (s === 'ROSA' || s === 'PINK') return 'ROSA';
  if (s === 'ROSSO' || s === 'RED') return 'ROSSO';
  if (s === 'VERDE' || s === 'GREEN') return 'VERDE';
  if (s === 'BLU' || s === 'BLUE') return 'BLU';
  if (s === 'VIOLA' || s === 'VIOLET' || s === 'VIO') return 'VIOLA';
  if (s === 'LILLABABY') return 'LILLABABY';
  if (s === 'LILLA' || s === 'LIL' || s === 'MALVA') return 'LILLA';
  if (s === 'ORO' || s === 'GOLD' || s === 'COPPER' || s === 'RAME' || s === 'BRONZO' || s === 'BRASS' || s === 'OTTONE') return 'ORO';
  if (s === 'ARGENTO' || s === 'SILVER' || s === 'CHROME' || s === 'CROMO' || s === 'STEEL' || s === 'ACCIAIO') return 'ARGENTO';
  return s;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selections, setSelections] = useState<Record<string, Record<string, ComponentAsset>>>({});

  const [graficheList, setGraficheList] = useState<GraphicAsset[]>([]);
  const [selectedGraphic, setSelectedGraphic] = useState<GraphicAsset | null>(null);
  
  // STATO PER EMULAZIONE GLOBALE (MASTER CONFIG)
  const [masterConfig, setMasterConfig] = useState<{
    colorCode: string | null;
    isAmmaccato: boolean;
  }>({ colorCode: null, isAmmaccato: false });
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [graphicScale, setGraphicScale] = useState(100);
  const [graphicY, setGraphicY] = useState(0);
  const [graphicX, setGraphicX] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [smartFitStatus, setSmartFitStatus] = useState('');

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibRect, setCalibRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showDebugGrid, setShowDebugGrid] = useState(false);
  const [isGlobalLocked, setIsGlobalLocked] = useState(true);
  const [syncWarnings, setSyncWarnings] = useState<Record<string, string>>({});
  const [savedCalibrations, setSavedCalibrations] = useState<Record<string, { x: number, y: number, w: number, h: number }>>(() => {
    const saved = localStorage.getItem('pretty_calibrations');
    return saved ? JSON.parse(saved) : {};
  });

  const [isFloraRunning, setIsFloraRunning] = useState(false);
  const [floraResult, setFloraResult] = useState<FloraResponse | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
  const [showPublishDashboard, setShowPublishDashboard] = useState(false);
  const [mockupImages, setMockupImages] = useState<{ base64: string, filename: string, alt: string }[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<{ id: string, surface: string }[]>([]);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [isShopifyBulkMode, setIsShopifyBulkMode] = useState(false);
  const [shopifyQueue, setShopifyQueue] = useState<{ id: string, product: Product, images: {base64: string, filename: string, alt: string}[], selections: any }[]>([]);
  const [selectedQueueIndex, setSelectedQueueIndex] = useState<number | null>(null);
  const selectionsRef = useRef(selections);
  useEffect(() => { selectionsRef.current = selections; }, [selections]);

  const filteredBulkQueue = useMemo(() => {
    const seen = new Set();
    return bulkQueue.filter(q => {
      const p = products.find(prod => prod.id === q.id);
      if (!p) return false;
      const key = `${p.name.trim().toUpperCase()}_${q.surface}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bulkQueue, products]);

  const [floraStatus, setFloraStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const handleToggleBulk = (pName: string, surface: string, selected: boolean) => {
    const upName = pName.trim().toUpperCase();
    const relatedProducts = products.filter(p => p.name.trim().toUpperCase() === upName);
    const relatedIds = relatedProducts.map(p => p.id);

    if (selected) {
      setBulkQueue(prev => {
        const otherItems = prev.filter(q => !relatedIds.includes(q.id) || q.surface !== surface);
        const newItems = relatedIds.map(id => ({ id, surface }));
        return [...otherItems, ...newItems];
      });
    } else {
      setBulkQueue(prev => prev.filter(q => {
        const p = products.find(prod => prod.id === q.id);
        return p?.name.trim().toUpperCase() !== upName || q.surface !== surface;
      }));
    }
  };

  const runBulkExport = async () => {
    if (filteredBulkQueue.length === 0) return;
    if (!selectedGraphic) return;
    setIsBulkRunning(true);
    const originalProductId = selectedProductId;
    const collectedShopifyItems: any[] = [];

    try {
      setBulkTotal(filteredBulkQueue.length);
      setBulkProgress(0);
      
      for (let i = 0; i < filteredBulkQueue.length; i++) {
        const { id, surface } = filteredBulkQueue[i];
        setBulkProgress(i + 1);
        
        // Seleziona il prodotto
        setSelectedProductId(id);
        
        // Forza la superficie se specificata (LISCIO/AMMACCATO)
        if (surface !== 'DEFAULT') {
          const targetIsAmmaccato = surface === 'AMMACCATO';
          const product = products.find(p => p.id === id);
          if (product) {
            const newProductSelections = { ...(selections[id] || {}) };
            let changed = false;

            Object.entries(product.components).forEach(([cName, assets]) => {
              const currentAsset = newProductSelections[cName];
              if (!currentAsset) return;

              // Verifichiamo se questo specifico componente ha varianti L/A
              const hasLVariants = assets.some(a => {
                const n = a.name.toUpperCase();
                return n.includes('_L') || a.fullPath.toUpperCase().includes('LISC');
              });
              const hasAVariants = assets.some(a => {
                const n = a.name.toUpperCase();
                return n.includes('_A') || a.fullPath.toUpperCase().includes('AMM');
              });

              // Se il componente non ha varianti (es. Stick, Tappi specifici), non cambiamo la selezione dell'utente
              if (!hasLVariants || !hasAVariants) return;

              const targetSuffix = targetIsAmmaccato ? '_A' : '_L';
              const targetKey = targetIsAmmaccato ? 'AMM' : 'LISC';
              
              const surfaceWords = ['LISCIA', 'AMMACCATA', 'LISCIO', 'AMMACCATO', 'LISCE', 'AMMACCATE', 'A', 'L', 'LISC', 'AMM'];
              const knownPrefixes = ['PLL', 'PLS', 'PLSM', 'PLV', 'PLC2', 'PLC4', 'BOTTIGLIA', 'FLACONE', 'CONTENITORE', 'JAR', 'BARATTOLO', 'VASO', 'BODY', 'STRUTTURA'];
              
              const currentAssetParts = currentAsset.name.toUpperCase().replace(/\..+$/, '').split(/[_-]/);
              const hasLRSuffix = ['L', 'A'].includes(currentAssetParts[currentAssetParts.length - 1]);
              const currentClean = currentAssetParts.filter(p => !knownPrefixes.includes(p));
              const currentPrefix = hasLRSuffix ? currentClean.slice(0, -1).join('_') : currentClean.join('_');
              const currentAssetColorNorm = normalize(currentAssetParts.filter(p => !surfaceWords.includes(p) && !knownPrefixes.includes(p)).join('_'));

              const match = assets.find(a => {
                const aName = a.name.toUpperCase();
                const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
                const aClean = aParts.filter(p => !knownPrefixes.includes(p));
                const aPrefix = ['L', 'A'].includes(aParts[aParts.length - 1]) ? aClean.slice(0, -1).join('_') : aClean.join('_');
                const hasSurface = aName.includes(targetSuffix) || a.fullPath.toUpperCase().includes(targetKey);
                return aPrefix === currentPrefix && hasSurface;
              }) || assets.find(a => {
                const aName = a.name.toUpperCase();
                const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
                const aClean = aParts.filter(p => !knownPrefixes.includes(p));
                const aColorNorm = normalize(aClean.filter(p => !surfaceWords.includes(p) && !knownPrefixes.includes(p)).join('_'));
                const hasSurface = aName.includes(targetSuffix) || a.fullPath.toUpperCase().includes(targetKey);
                return aColorNorm === currentAssetColorNorm && hasSurface;
              });

              if (match && match.path !== currentAsset.path) {
                newProductSelections[cName] = match;
                changed = true;
              }
            });

            if (changed) {
              setSelections(prev => ({ ...prev, [id]: newProductSelections }));
            }
          }
        }

        // Sincronizziamo i componenti comuni (Sticks, Tappi, etc.) se il sync globale è attivo
        if (isGlobalLocked && id !== originalProductId) {
          const masterS = selectionsRef.current[originalProductId] || {};
          const product = products.find(p => p.id === id);
          if (product) {
            const newS = { ...(selectionsRef.current[id] || {}) };
            let changed = false;

            Object.entries(product.components).forEach(([cName, assets]) => {
              const upCName = cName.toUpperCase();
              const isStick = upCName.includes('STICK') || upCName.includes('BAST') || upCName.includes('LEGNO') || upCName.includes('DIFFUSORE');
              const isTappo = upCName.includes('TAPPO') || upCName.includes('CHIUSURA') || upCName.includes('METAL');
              
              if (isStick || isTappo) {
                const masterAsset = Object.entries(masterS).find(([mCName]) => {
                  const upM = mCName.toUpperCase();
                  return (isStick && (upM.includes('STICK') || upM.includes('BAST'))) ||
                         (isTappo && (upM.includes('TAPPO') || upM.includes('CHIUSURA') || upM.includes('METAL')));
                })?.[1];

                if (masterAsset) {
                  const normMaster = normalize(masterAsset.name);
                  const match = assets.find(a => normalize(a.name) === normMaster) || assets[0];
                  if (match.path !== newS[cName]?.path) {
                    newS[cName] = match;
                    changed = true;
                  }
                }
              }
            });

            if (changed) {
              setSelections(prev => ({ ...prev, [id]: newS }));
            }
          }
        }

        // Attendiamo che il canvas si aggiorni (2.5s per sicurezza)
        await new Promise(r => setTimeout(r, 2500)); 
        
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const product = products.find(p => p.id === id);
          const currentSelections = selectionsRef.current[id] || {};
          
          const mainCompName = product ? Object.keys(product.components).find(c => {
            const n = c.toUpperCase();
            return n.includes('JAR') || n.includes('BARATTOLO') || n.includes('VASO') || 
                   n.includes('PLS') || n.includes('PLL') || n.includes('PLSM') || 
                   n.includes('PLV') || n.includes('LAMPADA') || n.includes('STRUTTURA') ||
                   n.includes('BOTTIGLIA') || n.includes('FLACONE') || n.includes('CONTENITORE') ||
                   n.includes('BODY');
          }) || Object.keys(product.components)[0] : '';

          const asset = currentSelections[mainCompName];
          const graphicName = selectedGraphic.name.split('.')[0];
          const assetBaseName = asset ? asset.name.replace(/\.[^/.]+$/, "") : (product?.name || id);
          let finalFileName = '';

          const parsed = parseProductName(asset?.name || '');
          const imagesToCapture: any[] = [];
            
            // LOGICA BULLETPROOF PER DOPPIO SCATTO
            const pName = (product?.name || "").toUpperCase();
            const isMiniOrCandle = pName.includes("MINI") || pName.includes("CANDELA");
            
            const expectedImages = parsed?.expectedImages || 1;
            const isDouble = !isMiniOrCandle && (expectedImages === 2 || 
                             pName.includes("PROFUMATORE") || 
                             pName.includes("LAMPADA") || 
                             pName.includes("VASO"));

            if (isDouble) {
              const currentColor = asset?.name.split('_')[1] || '';

              // 1. CATTURA LISCIO
              setFloraStatus(`Cattura 1/2 (LISCIO) - ${product?.name}...`);
              setSelections(prev => {
                const currentS = { ...(prev[id] || {}) };
                const components = product!.components[mainCompName] || [];
                const match = components.find(as => {
                   const n = as.name.toUpperCase();
                   return n.includes(currentColor.toUpperCase()) && (n.includes('_L') || n.includes('LISC')) && !n.includes('_A') && !n.includes('AMM');
                }) || components.find(as => (as.name.toUpperCase().includes('_L') || as.fullPath.toUpperCase().includes('LISC')) && !as.name.toUpperCase().includes('_A'));
                
                if (match) currentS[mainCompName] = match;
                return { ...prev, [id]: currentS };
              });
              
              setMasterConfig(prev => ({ ...prev, isAmmaccato: false }));
              await new Promise(r => setTimeout(r, 3500));
              const canvasL = document.querySelector('canvas');
              if (canvasL) {
                const currentL = selectionsRef.current[id]?.[mainCompName]?.name.replace(/\.[^/.]+$/, "") || assetBaseName;
                imagesToCapture.push({
                  base64: canvasL.toDataURL('image/jpeg', 0.95),
                  filename: `${currentL}_${graphicName}.jpg`.toUpperCase().replace(/\s+/g, '_'),
                  alt: `${product?.name} - Liscio`
                });
              }

              // 2. CATTURA AMMACCATO
              setFloraStatus(`Cattura 2/2 (AMMACCATO) - ${product?.name}...`);
              setSelections(prev => {
                const currentS = { ...(prev[id] || {}) };
                const components = product!.components[mainCompName] || [];
                const match = components.find(as => {
                   const n = as.name.toUpperCase();
                   return n.includes(currentColor.toUpperCase()) && (n.includes('_A') || n.includes('AMM'));
                }) || components.find(as => as.name.toUpperCase().includes('_A') || as.fullPath.toUpperCase().includes('AMM'));
                
                if (match) currentS[mainCompName] = match;
                return { ...prev, [id]: currentS };
              });
              
              setMasterConfig(prev => ({ ...prev, isAmmaccato: true }));
              await new Promise(r => setTimeout(r, 3500));
              const canvasA = document.querySelector('canvas');
              if (canvasA) {
                const currentA = selectionsRef.current[id]?.[mainCompName]?.name.replace(/\.[^/.]+$/, "") || assetBaseName;
                imagesToCapture.push({
                  base64: canvasA.toDataURL('image/jpeg', 0.95),
                  filename: `${currentA}_${graphicName}.jpg`.toUpperCase().replace(/\s+/g, '_'),
                  alt: `${product?.name} - Ammaccato`
                });
              }
            } else {
              // SINGOLO SCATTO
              setFloraStatus(`Cattura (SINGOLO) - ${product?.name}...`);
              await new Promise(r => setTimeout(r, 3000));
              const canvasSingle = document.querySelector('canvas');
              if (canvasSingle) {
                imagesToCapture.push({
                  base64: canvasSingle.toDataURL('image/jpeg', 0.95),
                  filename: `${assetBaseName}_${graphicName}.jpg`.toUpperCase().replace(/\s+/g, '_'),
                  alt: `${product?.name}`
                });
              }
            }

            // GESTIONE OUTPUT (SHOPIFY vs DOWNLOAD)
            if (isShopifyBulkMode) {
              collectedShopifyItems.push({
                id: Math.random().toString(36).substring(7),
                product: product,
                selections: selectionsRef.current[id],
                images: imagesToCapture
              });
              finalFileName = `${assetBaseName}_SHOPIFY`.toUpperCase();
            } else {
              for (let j = 0; j < imagesToCapture.length; j++) {
                const img = imagesToCapture[j];
                const link = document.createElement('a');
                link.download = img.filename;
                link.href = img.base64;
                link.click();
                if (imagesToCapture.length > 1) await new Promise(r => setTimeout(r, 600)); // Delay per evitare blocco browser
              }
              finalFileName = `${assetBaseName}_DOWNLOAD`.toUpperCase();
            }

            saveToHistory({
              id: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
              fileName: finalFileName,
              productName: product?.name || id,
              graphicName: graphicName,
            });
        }
      }
    } catch (err) {
      console.error("Errore durante il bulk export:", err);
    } finally {
      setSelectedProductId(originalProductId);
      setIsBulkRunning(false);
      setIsBulkExportOpen(false);
      confetti({ particleCount: 200, spread: 100 });
      
      if (isShopifyBulkMode && collectedShopifyItems.length > 0) {
        setShopifyQueue(collectedShopifyItems);
        setSelectedQueueIndex(0);
      }
    }
  };

  // --- LOGICA SHOPIFY ---

  const fetchSvgFromOneDrive = async (filename: string) => {
    const pass = localStorage.getItem('pretty_auth') || '';
    const url = `${config.apiUrl}/onedrive-file/${encodeURIComponent(filename)}?token=${pass}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("SVG non trovato su OneDrive");
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const handlePublish = async (formData: any, logCallback: (msg: string) => void) => {
    if (!selectedProduct || !selectedGraphic) return;
    
    // Cerchiamo l'asset principale per il parsing (Vaso/Corpo)
    const mainComp = Object.values(selectedProduct.components)[0]?.[0];
    const filename = mainComp ? mainComp.name : selectedProduct.id;
    const parsed = parseProductName(filename);

    return await createProductFromMockup({
      templateId: parsed.templateId,
      ...formData,
      images: mockupImages,
      svgFilename: selectedGraphic.name,
      getBase64FromOneDrive: fetchSvgFromOneDrive,
      color: masterConfig.colorCode || formData.color,
      podWidth: 666,
      podHeight: 666
    }, logCallback);
  };

  const generateMockupsForShopify = async () => {
    if (!selectedProduct || !selectedGraphic) return;
    setFloraStatus('Generazione mockup per Shopify...');
    
    const originalSurface = masterConfig.isAmmaccato;
    const results: { base64: string, filename: string, alt: string }[] = [];

    // 1. Cattura Liscio
    setMasterConfig(prev => ({ ...prev, isAmmaccato: false }));
    handleSmartSwitch(); // Applica la superficie lisce
    await new Promise(r => setTimeout(r, 2500));
    const canvasL = document.querySelector('canvas');
    if (canvasL) {
      results.push({
        base64: canvasL.toDataURL('image/jpeg', 0.9),
        filename: 'MOCKUP_LISCIO.jpg',
        alt: `${selectedProduct.name} - Liscio`
      });
    }

    // 2. Cattura Ammaccato
    setMasterConfig(prev => ({ ...prev, isAmmaccato: true }));
    handleSmartSwitch(); // Applica la superficie ammaccata
    await new Promise(r => setTimeout(r, 2500));
    const canvasA = document.querySelector('canvas');
    if (canvasA) {
      results.push({
        base64: canvasA.toDataURL('image/jpeg', 0.9),
        filename: 'MOCKUP_AMMACCATO.jpg',
        alt: `${selectedProduct.name} - Ammaccato`
      });
    }

    // Ripristina e salva
    setMasterConfig(prev => ({ ...prev, isAmmaccato: originalSurface }));
    handleSmartSwitch();
    setMockupImages(results);
    setFloraStatus('Mockup pronti per Shopify! 🛍️');
    setTimeout(() => setFloraStatus(''), 3000);
  };

  useEffect(() => {
    if (isCalibrating && selectedProduct && !isDrawing) {
      const getProductMacroCategoryLocal = () => {
        if (!selectedProduct) return 'DEFAULT';
        const firstComp = Object.values(selectedProduct.components)[0]?.[0];
        const folder = firstComp ? firstComp.folder.toUpperCase() : '';
        const name = selectedProduct.name.toUpperCase();
        const fullPathInfo = `${folder} ${name}`;
        if (fullPathInfo.includes('PROFUMATORE')) return 'PROFUMATORE';
        if (fullPathInfo.includes('LAMPADA')) return 'LAMPADA';
        if (fullPathInfo.includes('CANDELA 220')) return 'CANDELA_220';
        if (fullPathInfo.includes('CANDELA 450')) return 'CANDELA_450';
        if (fullPathInfo.includes('MINI') || fullPathInfo.includes('STICK')) return 'MINI';
        if (fullPathInfo.includes('BARATTOLO') || fullPathInfo.includes('VASO') || fullPathInfo.includes('PLS')) return 'BARATTOLO';
        return 'DEFAULT';
      };

      const cat = getProductMacroCategoryLocal();
      const saved = savedCalibrations[cat] || savedCalibrations['GLOBAL'];
      if (saved && !calibRect) {
        setCalibRect(saved);
      }
    }
  }, [isCalibrating, selectedProductId, savedCalibrations, isDrawing, calibRect, selectedProduct]);

  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const savedPass = localStorage.getItem('pretty_auth');
    if (savedPass) {
      setIsAuthenticated(true);
      fetchData(savedPass);
    }
    const savedHistory = localStorage.getItem('pretty_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Errore nel caricamento della cronologia:", e);
      }
    }
  }, []);

  const saveToHistory = (item: DownloadHistoryItem) => {
    const newHistory = [item, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('pretty_history', JSON.stringify(newHistory));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoggingIn(true);
    fetchData(password);
  };

  const fetchData = async (pass: string) => {
    try {
      setConnectionError(null);
      const authHeaders = { 
        'ngrok-skip-browser-warning': 'true',
        'x-api-key': pass 
      };

      const [pRes, gRes] = await Promise.all([
        fetch(config.endpoints.products, { headers: authHeaders }),
        fetch(config.endpoints.grafiche, { headers: authHeaders })
      ]);

      if (pRes.status === 401) {
        setLoginError(true);
        setIsAuthenticated(false);
        setIsLoggingIn(false);
        localStorage.removeItem('pretty_auth');
        return;
      }

      if (!pRes.ok || !gRes.ok) throw new Error(`Errore Server: ${pRes.status} / ${gRes.status}`);
      
      const [pData, gData]: [Product[], GraphicAsset[]] = await Promise.all([
        pRes.json(),
        gRes.json()
      ]);
      
      setIsAuthenticated(true);
      localStorage.setItem('pretty_auth', pass);
      setLoginError(false);
      setIsLoggingIn(false);

      // Deduplica i prodotti per nome (case-insensitive) per evitare doppioni nel catalogo
      const uniquePData = pData.reduce((acc, current) => {
        const name = current.name.trim().toUpperCase();
        if (!acc.find(p => p.name.trim().toUpperCase() === name)) {
          acc.push(current);
        }
        return acc;
      }, [] as Product[]);

      setProducts(uniquePData);
      if (uniquePData.length > 0) {
        const defaultProduct = uniquePData.find(p => {
          const firstComp = Object.values(p.components)[0]?.[0];
          return !firstComp?.folder?.toUpperCase().includes('AI');
        }) || uniquePData[0];
        setSelectedProductId(defaultProduct.id);
        const initialSelections: Record<string, Record<string, ComponentAsset>> = {};
        uniquePData.forEach(p => {
          initialSelections[p.id] = {};
          Object.entries(p.components).forEach(([cName, assets]) => {
            if (assets.length > 0) {
              const defaultAsset = assets.find(a => !(a.folder || '').toUpperCase().includes('AI')) || assets[0];
              initialSelections[p.id][cName] = defaultAsset;
            }
          });
        });
        setSelections(initialSelections);
      }

      setGraficheList(gData);
      if (gData.length > 0) {
        setSelectedGraphic(gData[0]);
        setExpandedFolders({ [gData[0].folder]: true });
      }
    } catch (err: any) {
      console.error("Errore nel caricamento dati", err);
      setConnectionError(err.message);
      setIsLoggingIn(false);
    }
  };

  const [assetColors, setAssetColors] = useState<Record<string, string>>({});

  const getImageAverageColor = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');
        
        const SIZE = 20;
        canvas.width = SIZE;
        canvas.height = SIZE;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 50) {
            const pr = data[i];
            const pg = data[i+1];
            const pb = data[i+2];
            const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
            if (brightness > 10 && brightness < 245) {
              r += pr;
              g += pg;
              b += pb;
              count++;
            }
          }
        }

        if (count > 0) {
          const finalColor = `rgb(${Math.round(r/count)},${Math.round(g/count)},${Math.round(b/count)})`;
          resolve(finalColor);
        } else {
          for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] > 10) {
              resolve(`rgb(${data[i]},${data[i+1]},${data[i+2]})`);
              return;
            }
          }
          resolve('');
        }
      };
      img.onerror = () => resolve('');
    });
  };

  const formatLabel = (name: string) => {
    return name
      .replace(/\.(jpg|png|svg|jpeg)$/i, '')
      .replace(/^(pls|pll|plsm|plv|plc2|plc4)_/i, '')
      .replace(/(_l|_a)$/i, '')
      .replace(/(_l2|_a2)$/i, '')
      .replace(/_/g, ' ')
      .trim()
      .toUpperCase();
  };

  useEffect(() => {
    if (!selectedProduct) return;
    const extract = async () => {
      const newColors = { ...assetColors };
      let changed = false;

      for (const [, assets] of Object.entries(selectedProduct.components)) {
        for (const asset of assets) {
          const colorKey = `${selectedProductId}_${asset.path}`;
          if (!newColors[colorKey]) {
            const assetUrl = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
            const color = await getImageAverageColor(assetUrl);
            if (color) {
              newColors[colorKey] = color;
              changed = true;
            }
          }
        }
      }
      if (changed) setAssetColors(newColors);
    };
    extract();
  }, [selectedProduct, selectedProductId]);

  useEffect(() => {
    if (!selectedProduct) return;
    
    const preload = () => {
      Object.values(selectedProduct.components).forEach(assets => {
        assets.forEach(asset => {
          const img = new Image();
          img.src = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
        });
      });
    };
    
    const timer = setTimeout(preload, 1000);
    return () => clearTimeout(timer);
  }, [selectedProduct]);

  const getAssetStyle = (asset: ComponentAsset) => {
    const name = asset.name.toUpperCase();
    const label = formatLabel(asset.name);
    
    const cleanName = name.replace(/\..+$/, '').replace(/^PLS_/i, '');
    const parts = cleanName.split(/[_\s-]/).filter(p => p);
    const foundCode = parts.find(p => EXTENDED_MAP[p]);
    const colorCode = foundCode || parts[0] || '';
    
    const colorKey = `${selectedProductId}_${asset.path}`;
    const pixelColor = assetColors[colorKey];
    
    const mapColor = EXTENDED_MAP[colorCode] || 
                     Object.keys(EXTENDED_MAP).find(k => label.includes(k) && k.length > 2 && label.includes(k)) && EXTENDED_MAP[Object.keys(EXTENDED_MAP).find(k => label.includes(k) && k.length > 2)!] ||
                     EXTENDED_MAP[label];
    
    const bgColor = (pixelColor && pixelColor !== '') ? pixelColor : mapColor;
    
    if (bgColor) {
      let r = 0, g = 0, b = 0;
      if (bgColor.startsWith('#')) {
        const hex = bgColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16) || 0;
        g = parseInt(hex.substring(2, 4), 16) || 0;
        b = parseInt(hex.substring(4, 6), 16) || 0;
      } else if (bgColor.startsWith('rgb')) {
        const match = bgColor.match(/\d+/g);
        if (match) [r, g, b] = match.map(Number);
      }
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return { 
        backgroundColor: bgColor, 
        color: brightness > 155 ? '#000' : '#fff',
        borderColor: brightness > 230 ? 'rgba(0,0,0,0.1)' : 'transparent'
      };
    }
    
    return { backgroundColor: '#334155', color: '#fff' };
  };

  const handleSelection = (componentName: string, asset: ComponentAsset) => {
    const name = asset.name.toUpperCase();
    const fullPath = asset.fullPath.toUpperCase();
    
    const surfaceWords = ['LISCIA', 'AMMACCATA', 'LISCIO', 'AMMACCATO', 'LISCE', 'AMMACCATE', 'A', 'L', 'LISC', 'AMM', 'PLL', 'PLS', 'PLSM', 'PLV', 'PLC2', 'PLC4'];
    const knownPrefixes = ['PLL', 'PLS', 'PLSM', 'PLV', 'PLC2', 'PLC4'];
    
    const nameParts = name.replace(/\..+$/, '').split(/[_-]/);
    const cleanParts = nameParts.filter(p => !knownPrefixes.includes(p.toUpperCase()));
    const fullColorName = cleanParts.filter(p => !surfaceWords.includes(p.toUpperCase())).join('_') || name;
    const normColor = normalize(fullColorName);
    
    const isAmmaccato = name.includes('_A') || fullPath.includes('AMM') || name.includes('AMMACCATA') || name.includes('AMMACCATO');

    setSelections(prev => {
      const newSelections = { ...prev };
      newSelections[selectedProductId] = {
        ...(newSelections[selectedProductId] || {}),
        [componentName]: asset
      };

      if (isGlobalLocked) {
        const newWarnings: Record<string, string> = { ...syncWarnings };
        
        products.forEach(p => {
          if (p.id === selectedProductId) {
            delete newWarnings[p.id];
            return;
          }

          Object.keys(p.components).forEach(pCName => {
            const upCName = pCName.toUpperCase();
            const upComponentName = componentName.toUpperCase();
            const isMainBody = (n: string) => {
              const words = ['BARATTOLO', 'BARATTOLI', 'VASO', 'PLS', 'PLL', 'PLSM', 'PLV', 'FLACONE', 'LAMPADA', 'STRUTTURA', 'CANDELA', 'VETRO', 'PLC2', 'PLC4'];
              return words.some(w => n.includes(w));
            };
            const isTappo = (n: string) => n.includes('TAPPO') || n.includes('CHIUSURA') || n.includes('COPERCHIO');
            const isStick = (n: string) => n.includes('STICK') || n.includes('BAST') || n.includes('LEGNO') || n.includes('DIFFUSORE');

            if (!(upCName === upComponentName || (isMainBody(upComponentName) && isMainBody(upCName)) || (isTappo(upComponentName) && isTappo(upCName)) || (isStick(upComponentName) && isStick(upCName)))) return;

            const productAssets = p.components[pCName];
            const pTargetSuffix = isAmmaccato ? '_A' : '_L';
            
            let match = productAssets.find(a => {
              const aName = a.name.toUpperCase();
              const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
              const aCleanParts = aParts.filter(p => !knownPrefixes.includes(p));
              const aColorRaw = aCleanParts.filter(p => !surfaceWords.includes(p)).join('_');
              const aColorNorm = normalize(aColorRaw);
              const hasSurface = aName.includes(pTargetSuffix) || a.fullPath.toUpperCase().includes(isAmmaccato ? 'AMM' : 'LISC');
              return (aColorRaw === fullColorName || aColorNorm === normColor) && hasSurface;
            });

            if (!match) {
              match = productAssets.find(a => {
                const aName = a.name.toUpperCase();
                const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
                return aParts.some(part => normalize(part) === normColor);
              });
            }

            if (match) {
              const matchName = match.name.toUpperCase();
              const isPerfectSurface = matchName.includes(pTargetSuffix) || match.fullPath.toUpperCase().includes(isAmmaccato ? 'AMM' : 'LISC');
              
              const upPName = p.name.toUpperCase();
              const isAutoMatchProduct = 
                upCName.includes('STICK') || upCName.includes('MINI') || upCName.includes('LAMPADA') || upCName.includes('CANDELA') ||
                upPName.includes('MINI') || upPName.includes('LAMPADA') || upPName.includes('CANDELA');
              
              if (isPerfectSurface || isAutoMatchProduct) {
                delete newWarnings[p.id];
              } else {
                newWarnings[p.id] = `⚠️ Match Parziale per ${p.name}: superficie non trovata.`;
              }
            } else {
              const colors = ['NERO', 'BIANCO', 'ORO', 'ARGENTO', 'ROSA', 'ROSSO', 'BLU', 'VERDE', 'ARANCIO', 'GIALLO', 'VIOLA', 'TIF', 'TIFFANY', 'BEIGE', 'OLIVA', 'SALVIA', 'GRAFITE', 'BORDEAUX', 'CILIEGIA', 'COBALTO', 'CYTRON', 'MAGENTA', 'LILLA'];
              const baseColor = colors.find(c => normColor.includes(c));

              match = productAssets.find(a => {
                const aName = a.name.toUpperCase();
                const hasBase = baseColor ? aName.includes(baseColor) : false;
                const hasSurf = aName.includes(pTargetSuffix) || a.fullPath.toUpperCase().includes(isAmmaccato ? 'AMM' : 'LISC');
                return hasBase && hasSurf;
              }) || productAssets.find(a => {
                const aName = a.name.toUpperCase();
                const hasBase = baseColor ? aName.includes(baseColor) : false;
                return hasBase;
              });

              if (match) {
                const mParts = match.name.toUpperCase().replace(/\..+$/, '').split(/[_-]/);
                const mClean = mParts.filter(p => !knownPrefixes.includes(p));
                const foundAltColor = mClean.filter(p => !surfaceWords.includes(p)).join(' ');
                newWarnings[p.id] = `⚠️ '${fullColorName.replace(/_/g, ' ')}' non trovato per ${p.name}, applicato '${foundAltColor}'`;
              } else {
                newWarnings[p.id] = `❌ Nessun colore simile a '${fullColorName.replace(/_/g, ' ')}' per ${p.name}`;
              }
            }

            if (match) {
              newSelections[p.id] = { ...(newSelections[p.id] || {}), [pCName]: match };
            }
          });
        });
        
        setSyncWarnings(newWarnings);
      }
      
      return newSelections;
    });

    if (isGlobalLocked) {
      setFloraStatus(`Sync Globale: ${fullColorName.replace(/_/g, ' ')} 🔒`);
      setTimeout(() => setFloraStatus(''), 2000);
    }

    const colorsList = ['NERO', 'BIANCO', 'ORO', 'ARGENTO', 'ROSA', 'ROSSO', 'BLU', 'VERDE', 'ARANCIO', 'GIALLO', 'VIOLA', 'TIF', 'TIFFANY', 'BEIGE', 'OLIVA'];
    const baseColorKeyword = colorsList.find(c => normColor.includes(c));
    setMasterConfig({ colorCode: baseColorKeyword || 'DEFAULT', isAmmaccato });
  };

  const getUniqueAssets = (assets: ComponentAsset[]) => {
    const seen = new Set();
    return assets.filter(asset => {
      const label = formatLabel(asset.name);
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  };

  const groupedGrafiche = useMemo(() => {
    const filtered = graficheList.filter(g =>
      g && g.name && (
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.folder && g.folder.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    );

    const groups: Record<string, GraphicAsset[]> = {};
    filtered.forEach(g => {
      const folderKey = g.folder || 'Principale';
      if (!groups[folderKey]) groups[folderKey] = [];
      groups[folderKey].push(g);
    });
    return groups;
  }, [graficheList, searchQuery]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  useEffect(() => {
    if (selectedGraphic) {
      setGraphicScale(100);
      setGraphicY(0);
    }
  }, [selectedGraphic]);



  const handleSmartSwitch = () => {
    if (!selectedProduct || !selections[selectedProductId]) return;
    
    const currentSelections = selections[selectedProductId];
    const newSelections = { ...currentSelections };
    let switchedCount = 0;

    const globalTarget: 'LISCIO' | 'AMMACCATO' = masterConfig.isAmmaccato ? 'LISCIO' : 'AMMACCATO';
    const targetSuffix = globalTarget === 'AMMACCATO' ? '_A' : '_L';
    const targetKey = globalTarget === 'AMMACCATO' ? 'AMM' : 'LISC';

    Object.keys(currentSelections).forEach(cName => {
      const asset = currentSelections[cName];
      const surfaceWords = ['LISCIA', 'AMMACCATA', 'LISCIO', 'AMMACCATO', 'LISCE', 'AMMACCATE', 'A', 'L', 'LISC', 'AMM', 'PLL', 'PLS', 'PLSM', 'PLV', 'PLC2', 'PLC4'];
      const knownPrefixes = ['PLL', 'PLS', 'PLSM', 'PLV', 'PLC2', 'PLC4'];
      
      const currentAssetParts = asset.name.toUpperCase().replace(/\..+$/, '').split(/[_-]/);
      const hasLRSuffix = ['L', 'A'].includes(currentAssetParts[currentAssetParts.length - 1]);
      const currentClean = currentAssetParts.filter(p => !knownPrefixes.includes(p));
      const currentPrefix = hasLRSuffix ? currentClean.slice(0, -1).join('_') : currentClean.join('_');
      const currentAssetColorRaw = currentClean.filter(p => !surfaceWords.includes(p)).join('_');
      const currentAssetColorNorm = normalize(currentAssetColorRaw);

      const possibleAssets = selectedProduct.components[cName];
      if (!possibleAssets) return;

      const target = possibleAssets.find(a => {
        const aName = a.name.toUpperCase();
        const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
        const aClean = aParts.filter(p => !knownPrefixes.includes(p));
        const aPrefix = ['L', 'A'].includes(aParts[aParts.length - 1]) ? aClean.slice(0, -1).join('_') : aClean.join('_');
        const hasSurface = aName.includes(targetSuffix) || a.fullPath.toUpperCase().includes(targetKey);
        return aPrefix === currentPrefix && hasSurface && a.path !== asset.path;
      }) || possibleAssets.find(a => {
        const aName = a.name.toUpperCase();
        const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
        const aClean = aParts.filter(p => !knownPrefixes.includes(p));
        const aColorRaw = aClean.filter(p => !surfaceWords.includes(p)).join('_');
        const aColorNorm = normalize(aColorRaw);
        const hasSurface = aName.includes(targetSuffix) || a.fullPath.toUpperCase().includes(targetKey);
        return (aColorRaw === currentAssetColorRaw || aColorNorm === currentAssetColorNorm) && hasSurface && a.path !== asset.path;
      }) || possibleAssets.find(a => {
        const aName = a.name.toUpperCase();
        const aParts = aName.replace(/\..+$/, '').split(/[_-]/);
        const hasSurface = aName.includes(targetSuffix) || a.fullPath.toUpperCase().includes(targetKey);
        const isColorMatch = aParts.some(p => normalize(p) === currentAssetColorNorm);
        return isColorMatch && hasSurface && a.path !== asset.path;
      });

      if (target) {
        newSelections[cName] = target;
        switchedCount++;
      }
    });

    if (switchedCount > 0) {
      setSelections(prev => ({ ...prev, [selectedProductId]: newSelections }));
    }
    
    setMasterConfig(prev => ({ ...prev, isAmmaccato: globalTarget === 'AMMACCATO' }));
    
    setFloraStatus(`Studio Hub: -> ${globalTarget} ✨`);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 }, colors: ['#6366f1', '#f59e0b'] });
    setTimeout(() => setFloraStatus(''), 2000);
  };

  const getProductMacroCategory = () => {
    if (!selectedProduct) return 'DEFAULT';
    
    const firstComp = Object.values(selectedProduct.components)[0]?.[0];
    const folder = firstComp ? firstComp.folder.toUpperCase() : '';
    const name = selectedProduct.name.toUpperCase();
    const fullPathInfo = `${folder} ${name}`;
    
    if (fullPathInfo.includes('PROFUMATORE')) return 'PROFUMATORE';
    if (fullPathInfo.includes('LAMPADA')) return 'LAMPADA';
    if (fullPathInfo.includes('CANDELA 220')) return 'CANDELA_220';
    if (fullPathInfo.includes('CANDELA 450')) return 'CANDELA_450';
    if (fullPathInfo.includes('MINI') || fullPathInfo.includes('STICK')) return 'MINI';
    if (fullPathInfo.includes('BARATTOLO') || fullPathInfo.includes('VASO') || fullPathInfo.includes('PLS')) return 'BARATTOLO';
    return 'DEFAULT';
  };

  const handleCalibrationSave = () => {
    if (!calibRect || calibRect.w < 1 || calibRect.h < 1) {
      alert("ERRORE: La griglia è troppo piccola o non disegnata bene. Riprova a trascinare il mouse!");
      return;
    }
    
    const cat = getProductMacroCategory();
    try {
      const updated = { ...savedCalibrations, [cat]: calibRect, 'GLOBAL': calibRect };
      localStorage.setItem('pretty_calibrations', JSON.stringify(updated));
      setSavedCalibrations(updated);
      setIsCalibrating(false);
      setCalibRect(null);
      setSmartFitStatus('Griglia Salvata! ✅');
      setTimeout(() => setSmartFitStatus(''), 2000);
    } catch (err) {
      alert("Errore durante il salvataggio: " + err);
    }
  };

  const handleCalibrationToggle = () => {
    if (!isCalibrating) {
      setCalibRect(null);
      setIsCalibrating(true);
    } else {
      setIsCalibrating(false);
      setCalibRect(null);
    }
  };

  const handleSmartFit = () => {
    if (!selectedProduct || !selectedGraphic) {
      alert("Seleziona prima un prodotto e una grafica!");
      return;
    }
    
    const cat = getProductMacroCategory();
    const saved = savedCalibrations[cat] || savedCalibrations['GLOBAL'];

    if (saved) {
      const getDimensions = (url: string): Promise<{w: number, h: number}> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve({w: img.width, h: img.height});
          img.onerror = () => resolve({w: 1000, h: 1000});
        });
      };

      getDimensions(selectedGraphic.path).then(({w, h}) => {
        const assetRatio = h / w;
        
        const safetyMargin = 0.95;
        const targetW = (saved.w / 100) * 1000 * safetyMargin;
        const targetH = (saved.h / 100) * 1250 * safetyMargin;
        const targetCenterX = ((saved.x + saved.w / 2) / 100) * 1000;
        const targetCenterY = ((saved.y + saved.h / 2) / 100) * 1250;

        const pName = selectedProduct.name.toUpperCase();
        const calibration = PRODUCT_CALIBRATION.find(c => 
          c.keywords.some(k => pName.includes(k))
        ) || DEFAULT_CALIBRATION;

        const baseW = calibration.baseWidth;
        const scaleW = (targetW / baseW) * 100;
        const baseH = baseW * assetRatio;
        const scaleH = (targetH / baseH) * 100;

        const finalScale = Math.round(Math.min(scaleW, scaleH));
        const jarCenterY = 1250 * calibration.centerY;
        const finalY = Math.round(targetCenterY - jarCenterY);
        const finalX = Math.round(targetCenterX - 500);

        setGraphicScale(finalScale);
        setGraphicY(finalY);
        setGraphicX(finalX);
        
        setSmartFitStatus(`Fit 2/2 OK! (Scale: ${finalScale}%) 🎯`);
        setTimeout(() => setSmartFitStatus(''), 3000);
      });
    }
  };

  useEffect(() => {
    if (selectedGraphic && selectedProduct && !isCalibrating && !isDrawing) {
      handleSmartFit();
    }
  }, [selectedGraphic, selectedProductId]);

  const handleExport = async () => {
    setIsExporting(true);
    setFloraStatus('Preparazione esportazione...');
    try {
      if (!selectedProduct) return;

      const mainCompName = Object.keys(selectedProduct.components).find(c => {
        const n = c.toUpperCase();
        return n.includes('JAR') || n.includes('BARATTOLO') || n.includes('VASO') || 
               n.includes('PLS') || n.includes('PLL') || n.includes('PLV') || 
               n.includes('LAMPADA') || n.includes('STRUTTURA') ||
               n.includes('BOTTIGLIA') || n.includes('FLACONE') || n.includes('CONTENITORE') ||
               n.includes('BODY');
      }) || Object.keys(selectedProduct.components)[0];

      const asset = selections[selectedProductId]?.[mainCompName] || 
                    Object.values(selections[selectedProductId] || {})[0];
      
      const parsed = parseProductName(asset?.name || '');
      const assetBaseName = asset ? asset.name.replace(/\.[^/.]+$/, "") : selectedProduct.id;
      const graphicName = selectedGraphic?.name.split('.')[0] || 'DESIGN';
      
      const pName = selectedProduct.name.toUpperCase();
      const isMiniOrCandle = pName.includes("MINI") || pName.includes("CANDELA");

      const expectedImages = parsed?.expectedImages || 1;
      const isDouble = !isMiniOrCandle && (expectedImages === 2 || 
                       pName.includes("PROFUMATORE") || 
                       pName.includes("LAMPADA") || 
                       pName.includes("VASO"));

      const imagesToDownload: { base64: string, filename: string }[] = [];

      if (isDouble) {
        const originalAmmaccato = masterConfig.isAmmaccato;
        const currentColor = asset?.name.split('_')[1] || '';

        // 1. Liscio
        setMasterConfig(prev => ({ ...prev, isAmmaccato: false }));
        setSelections(prev => {
          const currentS = { ...(prev[selectedProductId] || {}) };
          const components = selectedProduct.components[mainCompName] || [];
          const match = components.find(as => {
             const n = as.name.toUpperCase();
             return n.includes(currentColor.toUpperCase()) && (n.includes('_L') || n.includes('LISC')) && !n.includes('_A') && !n.includes('AMM');
          }) || components.find(as => (as.name.toUpperCase().includes('_L') || as.fullPath.toUpperCase().includes('LISC')) && !as.name.toUpperCase().includes('_A'));
          
          if (match) currentS[mainCompName] = match;
          return { ...prev, [selectedProductId]: currentS };
        });

        handleSmartSwitch();
        await new Promise(r => setTimeout(r, 3500));
        const canvasL = document.querySelector('canvas');
        if (canvasL) {
          const assetL = selections[selectedProductId]?.[mainCompName]?.name.replace(/\.[^/.]+$/, "") || assetBaseName;
          imagesToDownload.push({
            base64: canvasL.toDataURL('image/jpeg', 0.95),
            filename: `${assetL}_${graphicName}.jpg`.toUpperCase().replace(/\s+/g, '_')
          });
        }

        // 2. Ammaccato
        setMasterConfig(prev => ({ ...prev, isAmmaccato: true }));
        setSelections(prev => {
          const currentS = { ...(prev[selectedProductId] || {}) };
          const components = selectedProduct.components[mainCompName] || [];
          const match = components.find(as => {
             const n = as.name.toUpperCase();
             return n.includes(currentColor.toUpperCase()) && (n.includes('_A') || n.includes('AMM'));
          }) || components.find(as => as.name.toUpperCase().includes('_A') || as.fullPath.toUpperCase().includes('AMM'));
          
          if (match) currentS[mainCompName] = match;
          return { ...prev, [selectedProductId]: currentS };
        });

        handleSmartSwitch();
        await new Promise(r => setTimeout(r, 3500));
        const canvasA = document.querySelector('canvas');
        if (canvasA) {
          const assetA = selections[selectedProductId]?.[mainCompName]?.name.replace(/\.[^/.]+$/, "") || assetBaseName;
          imagesToDownload.push({
            base64: canvasA.toDataURL('image/jpeg', 0.95),
            filename: `${assetA}_${graphicName}.jpg`.toUpperCase().replace(/\s+/g, '_')
          });
        }

        // Ripristina
        setMasterConfig(prev => ({ ...prev, isAmmaccato: originalAmmaccato }));
        handleSmartSwitch();
      } else {
        // Singolo
        await new Promise(r => setTimeout(r, 2000));
        const canvas = document.querySelector('canvas');
        if (canvas) {
          imagesToDownload.push({
            base64: canvas.toDataURL('image/jpeg', 0.95),
            filename: `${assetBaseName}_${graphicName}.jpg`.toUpperCase().replace(/\s+/g, '_')
          });
        }
      }

      // Download effettivi
      imagesToDownload.forEach(img => {
        const link = document.createElement('a');
        link.download = img.filename;
        link.href = img.base64;
        link.click();
      });

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899'] });
      setFloraStatus('Esportazione completata! ✅');
    } catch (err) {
      console.error("Export error:", err);
      setFloraStatus('Errore durante l\'esportazione ❌');
    } finally {
      setIsExporting(false);
      setTimeout(() => setFloraStatus(''), 3000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6 md:p-10 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 p-8 md:p-12 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] text-center">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-600/20">
              <Lock className="text-white" size={32} />
            </div>
            
            <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Pretty Studio</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mb-10">Accesso Riservato</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLoginError(false);
                  }}
                  placeholder="Inserisci Password..."
                  className={`w-full py-4 px-6 bg-white/5 border ${loginError ? 'border-red-500/50 text-red-200' : 'border-white/10 text-white'} rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600 transition-all text-center font-bold tracking-widest placeholder:text-white/10`}
                  autoFocus
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white transition-all font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/30 group"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCcw size={18} className="animate-spin" /> Entrata in corso...
                  </>
                ) : (
                  <>
                    Entra nello Studio <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-10 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 p-8 rounded-[2rem] text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Errore di Connessione</h2>
          <p className="text-white/40 text-xs leading-relaxed mb-8">{connectionError}</p>
          <button
            onClick={() => {
              localStorage.removeItem('pretty_auth');
              window.location.reload();
            }}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl"
          >
            <RefreshCcw size={18} /> Riprova Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden font-sans">
      <div className="h-16 bg-slate-900 border-b border-white/10 flex items-center px-6 gap-4 shrink-0 overflow-x-auto no-scrollbar shadow-2xl z-20">
        <div className="flex items-center gap-3 pr-6 border-r border-white/5 mr-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">P</div>
          <h1 className="text-xs font-black uppercase tracking-tighter whitespace-nowrap">Studio Hub</h1>
        </div>
        <div className="flex-1 flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
          {products.sort((a, b) => {
            const order = ["PROFUMATORE", "MINI", "CANDELA 220", "CANDELA 450", "VASO", "LAMPADA"];
            const idxA = order.indexOf(a.name.toUpperCase());
            const idxB = order.indexOf(b.name.toUpperCase());
            if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          }).map(product => (
            <button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${selectedProductId === product.id ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
            >
              {product.name}
            </button>
          ))}
        </div>

        {/* Shopify Queue Button - Moved to Top Bar */}
        {shopifyQueue.length > 0 && (
          <div className="pl-4 ml-2 border-l border-white/5">
            <button 
              onClick={() => setSelectedQueueIndex(0)}
              className="relative p-2.5 bg-green-600 text-white rounded-xl shadow-xl shadow-green-500/20 hover:bg-green-500 transition-all group flex items-center gap-2"
              title="Prodotti in attesa di pubblicazione"
            >
              <ShoppingBag size={16} />
              <span className="text-[10px] font-black">{shopifyQueue.length}</span>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
              
              {/* Tooltip con mini-lista */}
              <div className="absolute top-full right-0 mt-3 w-56 bg-slate-900 rounded-2xl p-2 border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-2 group-hover:translate-y-0 z-[100]">
                <p className="text-[7px] font-black uppercase text-white/40 px-2 py-1">In coda per Shopify</p>
                {shopifyQueue.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 mb-1">
                    <img src={item.images[0].base64} className="w-5 h-5 rounded object-cover" />
                    <span className="text-[8px] font-bold text-white truncate">{item.product.name}</span>
                  </div>
                ))}
                {shopifyQueue.length > 4 && (
                  <p className="text-[7px] font-bold text-center text-green-400 py-1">+{shopifyQueue.length - 4} altri...</p>
                )}
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[320px] h-full bg-slate-900 border-r border-white/10 flex flex-col overflow-hidden shrink-0 shadow-2xl">
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {selectedProduct && Object.entries(selectedProduct.components).map(([cName, assets], index) => {
              if (!assets || assets.length === 0) return null;
              const upCName = cName.toUpperCase();
              const upPName = selectedProduct.name.toUpperCase();
              const isExcluded = upCName.includes('STICK') || upCName.includes('MINI') || upPName.includes('MINI');
              const hasMasterFolders = !isExcluded && assets.some(a => {
                const f = (a.folder || '').toUpperCase();
                const n = a.name.toUpperCase();
                return f.includes('LISC') || f.includes('AMM') || n.includes('_L') || n.includes('_A');
              });

              if (!hasMasterFolders) {
                const allUnique = getUniqueAssets(assets);
                return (
                  <section key={cName} className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest block text-white/20">{index + 1}. {cName}</label>
                    <div className="flex flex-wrap gap-2">
                      {allUnique.map((asset) => (
                        <button
                          key={asset.path}
                          onClick={() => handleSelection(cName, asset)}
                          style={getAssetStyle(asset)}
                          className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                        >
                          {asset.name.toUpperCase().replace(/\..+$/, '').split('_')[1]?.substring(0, 3) || formatLabel(asset.name).substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              }

              const rawCategories: (string | null)[] = assets.map(a => {
                const f = (a.folder || '').toUpperCase();
                const n = a.name.toUpperCase();
                if (f.includes('LISC') || n.includes('_L')) return 'LISCIO';
                if (f.includes('AMM') || n.includes('_A') || n.includes('_M')) return 'AMMACCATO';
                return null;
              });
              
              const categories = Array.from(new Set(rawCategories)).filter((c): c is string => c !== null).sort();
              const selectedAsset = selections[selectedProductId]?.[cName];
              const sFolder = (selectedAsset?.folder || '').toUpperCase();
              const sName = (selectedAsset?.name || '').toUpperCase();
              const selectionCategory = (sFolder.includes('LISC') || sName.includes('_L')) ? 'LISCIO' : ((sFolder.includes('AMM') || sName.includes('_A') || sName.includes('_M')) ? 'AMMACCATO' : '');
              const currentTab = activeTabs[cName] || selectionCategory || categories[0];

              return (
                <section key={cName} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest block text-white/20">{index + 1}. {cName}</label>
                    <button onClick={handleSmartSwitch} className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase tracking-tighter transition-all border border-indigo-500/20">Switch All</button>
                  </div>
                  <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5">
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setActiveTabs(prev => ({ ...prev, [cName]: cat }))} className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${currentTab === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>{cat}</button>
                    ))}
                  </div>
                  {categories.filter(cat => cat === currentTab).map(cat => {
                    const targetKey = cat === 'LISCIO' ? 'LISC' : 'AMM';
                    const targetSuffix = cat === 'LISCIO' ? '_L' : '_A';
                    
                    const catAssets = assets.filter(a => {
                      const f = (a.folder || '').toUpperCase();
                      const n = a.name.toUpperCase();
                      return f.includes(targetKey) || n.includes(targetSuffix);
                    });

                    // Dividiamo tra asset "standard" e asset in "sottocartelle"
                    const standardAssets: ComponentAsset[] = [];
                    const subfolderGroups: Record<string, ComponentAsset[]> = {};

                    catAssets.forEach(a => {
                      const f = (a.folder || '').toUpperCase();
                      const parts = f.split(/[/\\]/).filter(p => p && p.toUpperCase() !== cName.toUpperCase());
                      const masterIdx = parts.findIndex(p => p.includes(targetKey));
                      
                      if (masterIdx === -1) {
                        standardAssets.push(a);
                      } else if (masterIdx === parts.length - 1) {
                        standardAssets.push(a);
                      } else {
                        const subName = parts.slice(masterIdx + 1).join(' / ');
                        if (!subfolderGroups[subName]) subfolderGroups[subName] = [];
                        subfolderGroups[subName].push(a);
                      }
                    });

                    const uniqueStandard = getUniqueAssets(standardAssets);

                    return (
                      <motion.div key={cat} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        {/* Asset principali */}
                        <div className="flex flex-wrap gap-2">
                          {uniqueStandard.map((asset) => (
                            <button
                              key={asset.path}
                              onClick={() => handleSelection(cName, asset)}
                              style={getAssetStyle(asset)}
                              className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                            >
                              {asset.name.toUpperCase().replace(/\..+$/, '').split('_')[1]?.substring(0, 3) || formatLabel(asset.name).substring(0, 3)}
                            </button>
                          ))}
                        </div>

                        {/* Sottocartelle */}
                        {Object.entries(subfolderGroups).map(([subName, subAssets]) => (
                          <div key={subName} className="space-y-2 pt-2 border-t border-white/5">
                            <p className="text-[8px] font-black uppercase tracking-widest text-white/40">{subName}</p>
                            <div className="flex flex-wrap gap-2">
                              {getUniqueAssets(subAssets).map((asset) => (
                                <button
                                  key={asset.path}
                                  onClick={() => handleSelection(cName, asset)}
                                  style={getAssetStyle(asset)}
                                  className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                                >
                                  {asset.name.toUpperCase().replace(/\..+$/, '').split('_')[1]?.substring(0, 3) || formatLabel(asset.name).substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    );
                  })}
                </section>
              );
            })}

          {/* Shared Graphics */}
          <section className="pt-4 border-t border-white/5 space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest block text-white/20">Grafiche Universali</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
              <input type="text" placeholder="Cerca design..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[11px] outline-none focus:border-indigo-500/50 transition-all" />
            </div>
            <div className="space-y-1">
              {Object.entries(groupedGrafiche).map(([folder, assets]) => (
                <div key={folder} className="space-y-1">
                  <button onClick={() => toggleFolder(folder)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-all text-left group">
                    {expandedFolders[folder] ? <ChevronDown size={14} className="text-indigo-400" /> : <ChevronRight size={14} className="text-white/20" />}
                    <Folder size={14} className={expandedFolders[folder] ? "text-indigo-400" : "text-white/20 group-hover:text-white/40"} />
                    <span className={`text-[10px] font-bold uppercase truncate tracking-tight ${expandedFolders[folder] ? "text-white" : "text-white/40"}`}>{folder}</span>
                  </button>
                  <AnimatePresence>
                    {(expandedFolders[folder] || searchQuery.length > 0) && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-4 space-y-1 border-l border-white/5 ml-2">
                        {assets.map(asset => (
                          <div key={asset.path} className="flex items-center gap-1 group/item">
                            <button onClick={() => setSelectedGraphic(asset)} className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-medium text-left truncate transition-all ${selectedGraphic?.path === asset.path ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/5' : 'text-white/40 hover:text-white hover:bg-white/10'}`}>
                              {formatLabel(asset.name)}
                            </button>
                            <a 
                              href={asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-white/20 hover:text-indigo-400 opacity-0 group-hover/item:opacity-100 transition-all"
                              title="Anteprima originale"
                            >
                              <Search size={14} />
                            </a>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Shopify Queue Section */}
        <AnimatePresence>
          {shopifyQueue.length > 0 && (
            <section className="p-5 border-t border-white/5 space-y-4 bg-green-500/5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest block text-green-400">Pronti per Shopify ({shopifyQueue.length})</label>
                <button onClick={() => setShopifyQueue([])} className="text-[8px] font-bold text-white/20 hover:text-red-400 uppercase">Svuota</button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {shopifyQueue.map((item, idx) => (
                  <div key={item.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between group hover:border-green-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-black border border-white/10">
                        <img src={item.images[0].base64} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-white truncate w-32">{item.product.name}</span>
                        <span className="text-[7px] font-bold text-white/30 uppercase">{item.images[0].filename}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedQueueIndex(idx)}
                      className="p-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-lg"
                    >
                      <ShoppingBag size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </AnimatePresence>
      </div>

        {/* Shopify Dashboard Modal */}
        {(showPublishDashboard || selectedQueueIndex !== null) && (
          <PublishDashboard
            productData={(selectedQueueIndex !== null 
              ? parseProductName(shopifyQueue[selectedQueueIndex].images[0].filename)
              : parseProductName(Object.values(selectedProduct?.components || {})[0]?.[0]?.name || '')) as any
            }
            mockupImages={selectedQueueIndex !== null ? shopifyQueue[selectedQueueIndex].images : mockupImages}
            onPublish={async (formData, logCallback) => {
              const res = await (selectedQueueIndex !== null 
                ? createProductFromMockup({
                    ...formData,
                    images: shopifyQueue[selectedQueueIndex].images,
                    svgFilename: selectedGraphic?.name || '',
                    getBase64FromOneDrive: fetchSvgFromOneDrive,
                  }, logCallback)
                : handlePublish(formData, logCallback)
              );
              
              if (res && res.success && selectedQueueIndex !== null) {
                // Invece di rimuovere subito, potremmo voler mostrare il successo e poi "Avanti"
                // Ma per ora seguiamo la richiesta: "Passa al prodotto successivo"
                // Lo facciamo gestire al componente tramite un pulsante "Prossimo Prodotto"
              }
              return res || { success: false, error: 'Errore risposta server' };
            }}
            isQueueMode={selectedQueueIndex !== null}
            queueProgress={selectedQueueIndex !== null ? { current: selectedQueueIndex + 1, total: shopifyQueue.length } : undefined}
            onNext={() => {
              if (selectedQueueIndex !== null) {
                if (selectedQueueIndex < shopifyQueue.length - 1) {
                  setSelectedQueueIndex(selectedQueueIndex + 1);
                } else {
                  setSelectedQueueIndex(null);
                  setShopifyQueue([]); // Fine coda
                  confetti({ particleCount: 300, spread: 150 });
                }
              }
            }}
            onClose={() => {
              setShowPublishDashboard(false);
              setSelectedQueueIndex(null);
            }}
          />
        )}

        <div className="flex-1 h-full bg-[#f8f8f8] flex flex-col relative">
          {/* Top Header */}
          <div className="h-14 border-b border-black/[0.05] bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-[60]">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-black text-black/20 uppercase tracking-[0.3em]">{selectedProduct?.name || 'Studio'} View</h2>
              <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-4 px-3 py-1.5 bg-black/5 rounded-xl border border-black/[0.03]">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleCalibrationToggle}
                    className={`p-1.5 rounded-lg transition-all ${isCalibrating ? 'bg-red-500 text-white' : 'hover:bg-black/10 text-black/30'}`}
                    title="Calibra Griglia di Fit"
                  >
                    <Ruler size={14} />
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-black/30 uppercase w-8">Scala</span>
                    <div className="flex items-center bg-white/80 rounded-lg p-0.5 shadow-sm">
                      <button onClick={() => setGraphicScale(s => Math.max(10, s - 1))} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronDown size={12} /></button>
                      <input type="range" min="10" max="250" value={graphicScale} onChange={(e) => setGraphicScale(parseInt(e.target.value))} className="w-16 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black mx-1" />
                      <button onClick={() => setGraphicScale(s => Math.min(400, s + 1))} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronDown className="rotate-180" size={12} /></button>
                    </div>
                  </div>
                </div>

                <div className="w-[1px] h-4 bg-black/10" />

                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-black/30 uppercase w-8">Pos.X</span>
                  <div className="flex items-center bg-white/80 rounded-lg p-0.5 shadow-sm">
                    <button onClick={() => setGraphicX(x => x - 1)} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronRight className="rotate-180" size={12} /></button>
                    <input type="range" min="-400" max="400" value={graphicX} onChange={(e) => setGraphicX(parseInt(e.target.value))} className="w-16 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black mx-1" />
                    <button onClick={() => setGraphicX(x => x + 1)} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronRight size={12} /></button>
                  </div>
                </div>

                <div className="w-[1px] h-4 bg-black/10" />

                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-black/30 uppercase w-8">Pos.Y</span>
                  <div className="flex items-center bg-white/80 rounded-lg p-0.5 shadow-sm">
                    <button onClick={() => setGraphicY(y => y + 1)} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronDown className="rotate-180" size={12} /></button>
                    <input type="range" min="-400" max="400" value={graphicY} onChange={(e) => setGraphicY(parseInt(e.target.value))} className="w-16 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black mx-1" />
                    <button onClick={() => setGraphicY(y => y - 1)} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronDown size={12} /></button>
                  </div>
                </div>

                <button onClick={() => { setGraphicScale(100); setGraphicY(0); setGraphicX(0); }} className="p-1.5 rounded-lg hover:bg-black/10 text-black/30 hover:text-black transition-all" title="Reset">
                  <RefreshCcw size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleSmartSwitch} className="px-3 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all flex items-center gap-2 border border-indigo-500/20 group">
                  <RefreshCcw size={14} className="group-active:rotate-180 transition-transform duration-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:inline">Switch</span>
                </button>
                <button onClick={handleSmartFit} className="p-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all flex items-center gap-2 group border border-indigo-500/20 relative">
                  <Wand2 size={14} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:inline">Fit</span>
                  {smartFitStatus && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black text-white text-[8px] font-black py-1 px-3 rounded-full shadow-xl z-50"
                    >
                      {smartFitStatus}
                    </motion.div>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 border-l border-black/5 pl-6 relative">
                <div className="relative">
                  <button 
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
                    className={`p-3 rounded-xl transition-all group ${isHistoryOpen ? 'bg-black text-white shadow-lg' : 'bg-black/5 hover:bg-black/10 text-black/40 hover:text-black'}`}
                    title="Cronologia Download"
                  >
                    <History size={18} className={`${isHistoryOpen ? 'rotate-[-45deg]' : ''} transition-transform`} />
                  </button>

                  <AnimatePresence>
                    {isHistoryOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-4 mt-3 w-80 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-black/[0.03] overflow-hidden z-[100]"
                      >
                        <div className="p-5 border-b border-black/[0.03] flex items-center justify-between bg-gray-50/50">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40">Cronologia Export</h3>
                          <button onClick={() => setHistory([])} className="text-[8px] font-bold text-red-500 hover:underline uppercase">Pulisci</button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          {history.length === 0 ? (
                            <div className="p-10 text-center">
                              <History size={24} className="mx-auto mb-2 text-black/5" />
                              <p className="text-[9px] font-bold text-black/20 uppercase">Nessun export recente</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-black/[0.03]">
                              {history.map((item) => (
                                <div key={item.id} className="p-4 hover:bg-gray-50 transition-all group">
                                  <div className="flex items-start justify-between mb-1">
                                    <p className="text-[10px] font-black uppercase truncate max-w-[180px]">{item.fileName}</p>
                                    <span className="text-[8px] font-bold text-black/20">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase">{item.productName}</span>
                                    <span className="text-[8px] font-bold text-black/30 truncate">{item.graphicName}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/20 h-[44px]">
                  <button 
                    onClick={() => setIsBulkExportOpen(true)} 
                    disabled={isExporting || isBulkRunning || !selectedGraphic} 
                    className="px-6 h-full text-[10px] bg-black text-white font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-800 transition-all disabled:opacity-30 border-r border-white/10"
                  >
                    <Layers size={18} /> 
                    <span className="hidden sm:inline">Bulk Export</span>
                  </button>
                  <button 
                    onClick={handleExport} 
                    disabled={isExporting || isBulkRunning || !selectedGraphic} 
                    className="px-4 h-full text-white hover:bg-zinc-800 transition-all disabled:opacity-30"
                    title="Export Singolo"
                  >
                    <Download size={18} /> 
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10 relative">
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30 relative">
              {/* Avviso Sync (Ora perfettamente centrato rispetto al Canvas) */}
              <AnimatePresence>
                {syncWarnings[selectedProductId] && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                  >
                    <div className="bg-amber-50/90 backdrop-blur-md border border-amber-200/50 px-4 py-2 rounded-2xl shadow-2xl shadow-amber-900/10 flex items-center gap-3 border-b-2 border-b-amber-200/80">
                      <div className="p-1 bg-amber-500 rounded-lg text-white">
                        <AlertCircle size={12} />
                      </div>
                      <span className="text-[9px] font-black text-amber-900 uppercase tracking-[0.1em] whitespace-nowrap">
                        {syncWarnings[selectedProductId]}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
                {selectedProduct ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-12 relative">
                    <div 
                      id="canvas-container"
                    className="relative grid place-items-center h-full max-h-[85vh] mx-auto select-none"
                    style={{ aspectRatio: '1000/1250' }}
                  >
                    {/* Layer 1: Il Canvas reale */}
                    <div className="col-start-1 row-start-1 w-full h-full shadow-2xl rounded-2xl overflow-hidden bg-white">
                      {(() => {
                        const pName = selectedProduct.name.toUpperCase();
                        const calib = PRODUCT_CALIBRATION.find(c => c.keywords.some(k => pName.includes(k))) || DEFAULT_CALIBRATION;
                        return (
                          <MockupCanvas
                            product={selectedProduct}
                            selections={selections[selectedProductId] || {}}
                            graphic={selectedGraphic?.path || 'PLACEHOLDER'}
                            graphicScale={graphicScale}
                            graphicY={graphicY}
                            graphicX={graphicX}
                            centerY={calib.centerY}
                            baseWidth={calib.baseWidth}
                            debugRect={showDebugGrid ? (savedCalibrations[getProductMacroCategory()] || null) : null}
                          />
                        );
                      })()}
                    </div>
                    
                    {/* Layer 2: La griglia di calibrazione (Sempre sopra al Canvas) */}
                    {isCalibrating && (
                      <div 
                        className="col-start-1 row-start-1 w-full h-full z-50 cursor-crosshair bg-black/5 pointer-events-auto rounded-2xl"
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setIsDrawing(true);
                          const px = ((e.clientX - rect.left) / rect.width) * 100;
                          const py = ((e.clientY - rect.top) / rect.height) * 100;
                          setStartPos({ x: px, y: py });
                          setCalibRect({ x: px, y: py, w: 0.1, h: 0.1 });
                        }}
                        onMouseMove={(e) => {
                          if (!isDrawing) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const currentX = ((e.clientX - rect.left) / rect.width) * 100;
                          const currentY = ((e.clientY - rect.top) / rect.height) * 100;
                          setCalibRect({
                            x: Math.min(startPos.x, currentX),
                            y: Math.min(startPos.y, currentY),
                            w: Math.max(0.1, Math.abs(currentX - startPos.x)),
                            h: Math.max(0.1, Math.abs(currentY - startPos.y))
                          });
                        }}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                      >
                        <svg className="w-full h-full pointer-events-none">
                          {calibRect && (
                            <rect
                              x={`${calibRect.x}%`}
                              y={`${calibRect.y}%`}
                              width={`${calibRect.w}%`}
                              height={`${calibRect.h}%`}
                              fill="rgba(239, 68, 68, 0.2)"
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          )}
                        </svg>
                        
                        <div 
                          className="absolute top-10 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] border-2 border-indigo-500 animate-bounce pointer-events-auto"
                          onMouseDown={(e) => e.stopPropagation()} 
                        >
                          <span className="text-xs font-black uppercase text-indigo-600">Disegna e Clicca -&gt;</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCalibrationSave();
                            }} 
                            className="bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all flex items-center gap-2 shadow-lg active:scale-90"
                          >
                            <Save size={18} />
                            <span className="font-black uppercase text-[10px]">SALVA ORA</span>
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center opacity-20">
                    <RefreshCcw size={48} className="mx-auto mb-4 animate-spin-slow" />
                    <p className="text-xs font-black uppercase">In attesa del prodotto...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-[360px] shrink-0 flex flex-col border-l border-black/[0.03] bg-white p-6 gap-6 shadow-[-20px_0_50px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <h2 className="text-[10px] font-black text-black/20 uppercase tracking-[0.2em]">Reality Engine</h2>
                  <div className="flex items-center bg-black/[0.02] rounded-lg p-0.5 border border-black/[0.03]">
                    <button 
                      onClick={() => setShowDebugGrid(!showDebugGrid)}
                      className={`p-1.5 rounded-md transition-all ${showDebugGrid ? 'bg-cyan-500 text-white shadow-lg' : 'text-black/20 hover:text-black/40'}`}
                      title={showDebugGrid ? "Nascondi Area Sacra" : "Mostra Area Sacra"}
                    >
                      {showDebugGrid ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <div className="w-[1px] h-3 bg-black/5 mx-0.5" />
                    <button 
                      onClick={() => setIsGlobalLocked(!isGlobalLocked)}
                      className={`p-1.5 rounded-md transition-all ${isGlobalLocked ? 'bg-amber-500 text-white shadow-lg' : 'text-black/20 hover:text-black/40'}`}
                      title={isGlobalLocked ? "Sincronizzazione Globale Attiva" : "Sincronizzazione Globale Disattivata"}
                    >
                      {isGlobalLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                  </div>
                </div>
                {floraResult?.status === 'completed' && <CheckCircle2 className="text-green-500" size={16} />}
              </div>
              <div className="flex-1 xl:flex-none aspect-[1000/1250] lg:h-[450px] bg-white rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.08)] border border-black/[0.03] overflow-hidden relative group">
                {isFloraRunning && !floraResult?.outputs && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-xl z-20">
                    <div className="text-center">
                      <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4 mx-auto" />
                      <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest animate-pulse">{floraStatus}</p>
                    </div>
                  </div>
                )}
                {floraResult?.outputs?.find(o => o.type === 'imageUrl')?.url && (
                  <img src={floraResult.outputs.find(o => o.type === 'imageUrl')?.url} className="w-full h-full object-cover shadow-2xl" alt="AI Reality" />
                )}
                {floraResult?.outputs?.find(o => o.type === 'videoUrl')?.url && (
                  <div className="absolute bottom-6 right-6">
                    <a href={floraResult.outputs.find(o => o.type === 'videoUrl')?.url} target="_blank" rel="noopener noreferrer" className="p-4 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 hover:scale-110 hover:rotate-2 transition-all">
                      <Video size={20} /> <span className="font-bold text-[10px] uppercase tracking-tighter">Download 360°</span>
                    </a>
                  </div>
                )}
                {!isFloraRunning && !floraResult && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                    <Wand2 size={48} className="text-black/5 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/20 max-w-[150px] leading-relaxed">
                      Pronto per la generazione AI Reality
                    </p>
                  </div>
                )}
              </div>
              {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-[10px] font-black uppercase flex items-center gap-3"><AlertCircle size={14} /> {error}</div>}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isBulkExportOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isBulkRunning && setIsBulkExportOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-8 border-b border-black/[0.03] flex items-center justify-between bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900">Configura Bulk Export</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Seleziona i prodotti per l'esportazione totale</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setBulkQueue([])} 
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                  >
                    Svuota
                  </button>
                  <button onClick={() => setIsBulkExportOpen(false)} disabled={isBulkRunning} className="p-3 rounded-full hover:bg-black/5 text-slate-400 transition-all">
                    <RefreshCcw size={20} className={isBulkRunning ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Toggle Shopify Mode */}
              <div className="px-8 py-4 bg-white border-b border-black/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isShopifyBulkMode ? 'bg-green-500/10 text-green-600' : 'bg-indigo-500/10 text-indigo-600'}`}>
                    <ShoppingBag size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Destinazione Export</span>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setIsShopifyBulkMode(false)}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!isShopifyBulkMode ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    💾 Download
                  </button>
                  <button 
                    onClick={() => setIsShopifyBulkMode(true)}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isShopifyBulkMode ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    🛍️ Shopify
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const seenNames = new Set();
                    return products.flatMap(p => {
                      const pName = p.name.trim().toUpperCase();
                      if (seenNames.has(pName)) return [];
                      seenNames.add(pName);
                      return [{ ...p, variantId: p.id, variantLabel: pName, surface: 'DEFAULT' }];
                    });
                  })().map(p => (
                    <BulkItem 
                      key={p.variantId}
                      label={p.variantLabel} 
                      productId={p.id} 
                      surface={p.surface} 
                      selected={bulkQueue.some(q => {
                        const qProd = products.find(prod => prod.id === q.id);
                        return qProd?.name.trim().toUpperCase() === p.name.trim().toUpperCase();
                      })}
                      onToggle={(sel) => handleToggleBulk(p.name, p.surface, sel)}
                    />
                  ))}
                </div>
              </div>
              <div className="p-8 bg-gray-50 border-t border-black/[0.03] flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filteredBulkQueue.length} Prodotti Selezionati</div>
                <button onClick={runBulkExport} disabled={isBulkRunning || filteredBulkQueue.length === 0} className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all flex flex-col items-center gap-1 ${isShopifyBulkMode ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20 text-white' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 text-white'}`}>
                  {isBulkRunning ? (
                    <>
                      <span>Esportazione {bulkProgress}/{bulkTotal}</span>
                      {floraStatus && <span className="text-[8px] opacity-70 normal-case font-bold">{floraStatus}</span>}
                    </>
                  ) : isShopifyBulkMode ? 'Prepara per Shopify' : 'Avvia Bulk Export'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BulkItem = ({ label, selected, onToggle }: { label: string, productId: string, surface: string, selected: boolean, onToggle: (sel: boolean) => void }) => (
  <button 
    onClick={() => onToggle(!selected)}
    className={`p-4 rounded-[1.5rem] border-2 transition-all flex items-center justify-between group ${selected ? 'border-indigo-600 bg-indigo-50/50' : 'border-black/[0.03] hover:border-black/10 bg-white'}`}
  >
    <span className={`text-[11px] font-black uppercase tracking-wider ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-black/10'}`}>
      {selected && <CheckCircle2 size={12} />}
    </div>
  </button>
);

export default App;
