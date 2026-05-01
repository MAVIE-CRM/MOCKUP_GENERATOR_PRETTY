import { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCcw, Video, Wand2, AlertCircle, CheckCircle2, Search, Folder, ChevronRight, ChevronDown, Lock, ShieldCheck, ArrowRight, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import MockupCanvas from './components/MockupCanvas';
// I prodotti e le grafiche vengono ora caricati dinamicamente da OneDrive
import { floraService } from './services/flora.service';
import type { FloraResponse } from './services/flora.service';
import { config } from './config';

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
  'FRA': '#E11D48', 'NAP': '#000080', 'MIN': '#334155', 'LIM': '#A3E635'
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [graphicScale, setGraphicScale] = useState(100);
  const [graphicY, setGraphicY] = useState(0);
  const [graphicX, setGraphicX] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const [isFloraRunning, setIsFloraRunning] = useState(false);
  const [floraResult, setFloraResult] = useState<FloraResponse | null>(null);
  const [floraStatus, setFloraStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);
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
    const newHistory = [item, ...history].slice(0, 50); // Teniamo gli ultimi 50
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

      // Avviamo entrambi i fetch in parallelo per massima velocità
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
      
      // Password corretta!
      setIsAuthenticated(true);
      localStorage.setItem('pretty_auth', pass);
      setLoginError(false);
      setIsLoggingIn(false);

      // Setup Prodotti
      setProducts(pData);
      if (pData.length > 0) {
        setSelectedProductId(pData[0].id);
        const initialSelections: Record<string, Record<string, ComponentAsset>> = {};
        pData.forEach(p => {
          initialSelections[p.id] = {};
          Object.entries(p.components).forEach(([cName, assets]) => {
            if (assets.length > 0) initialSelections[p.id][cName] = assets[0];
          });
        });
        setSelections(initialSelections);
      }

      // Setup Grafiche
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


  // EFFETTO DI EMULAZIONE AUTOMATICA AL CAMBIO PRODOTTO
  useEffect(() => {
    if (!selectedProduct || !masterConfig.colorCode) return;

    const currentSelections = selections[selectedProductId] || {};
    const newSelections = { ...currentSelections };
    let emulationCount = 0;

    Object.entries(selectedProduct.components).forEach(([cName, assets]) => {
      // Cerchiamo un asset che corrisponda al colore e allo stato liscio/ammaccato
      const targetSuffix = masterConfig.isAmmaccato ? '_A' : '_L';
      
      const match = assets.find(a => {
        const aName = a.name.toUpperCase();
        return aName.includes(masterConfig.colorCode!) && aName.includes(targetSuffix);
      }) || assets.find(a => {
        const aName = a.name.toUpperCase();
        return aName.includes(masterConfig.colorCode!);
      });

      if (match && (!currentSelections[cName] || currentSelections[cName].path !== match.path)) {
        newSelections[cName] = match;
        emulationCount++;
      }
    });

    if (emulationCount > 0) {
      setSelections(prev => ({ ...prev, [selectedProductId]: newSelections }));
      setFloraStatus(`Emulazione Style: ${masterConfig.colorCode} ✨`);
      setTimeout(() => setFloraStatus(''), 2000);
    }
  }, [selectedProductId]);

  const [assetColors, setAssetColors] = useState<Record<string, string>>({});

  const getImageAverageColor = (url: string, fileName: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const name = fileName.toUpperCase();
        let sampleX = img.width * 0.5;
        let sampleY = img.height * 0.5;

        // LOGICA DI CAMPIONAMENTO MIRATO PER CATEGORIA
        if (name.includes('PLS_') || name.includes('BARATTOLO')) {
          // Barattoli: 50% centro, scendi al 65-70% (corpo del prodotto)
          sampleY = img.height * 0.68;
        } else if (name.includes('PROFUMATORE') || name.includes('PROF_')) {
          // Profumatori: 50% centro, scendi all'82% (zona liquido/fondo)
          sampleY = img.height * 0.82;
        } else if (name.includes('STICK')) {
          // Stick: 50% centro esatto
          sampleY = img.height * 0.5;
        } else if (name.includes('LAMPADA')) {
          // Lampada: centro alto
          sampleY = img.height * 0.4;
        }

        // Prendiamo una piccola media (5x5 pixel) intorno al punto per evitare "rumore"
        const size = 5;
        const data = ctx.getImageData(sampleX - 2, sampleY - 2, size, size).data;
        
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 200) { // Solo pixel opachi
            r += data[i];
            g += data[i+1];
            b += data[i+2];
            count++;
          }
        }

        if (count > 0) {
          resolve(`rgb(${Math.round(r/count)},${Math.round(g/count)},${Math.round(b/count)})`);
        } else {
          // Fallback: cerca il pixel più saturo se il punto mirato è trasparente
          resolve(''); 
        }
      };
      img.onerror = () => resolve('');
    });
  };

  const formatLabel = (name: string) => {
    return name
      .replace(/\.(jpg|png|svg|jpeg)$/i, '')
      .replace(/^pls_/i, '')
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
            const color = await getImageAverageColor(assetUrl, asset.name);
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
  }, [selectedProduct]);

  // Pre-caricamento intelligente degli asset
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
    
    // Piccolo delay per non rallentare l'avvio iniziale
    const timer = setTimeout(preload, 1000);
    return () => clearTimeout(timer);
  }, [selectedProduct]);

  const getAssetStyle = (asset: ComponentAsset) => {
    const name = asset.name.toUpperCase();
    const label = formatLabel(asset.name);
    
    const parts = name.replace(/\..+$/, '').split(/[_\s-]/);
    const colorCode = parts.length >= 2 ? parts[1].toUpperCase() : parts[0].toUpperCase();
    
    // Priorità: Codice dal nome -> Etichetta -> Analisi Pixel
    const pixelColor = assetColors[`${selectedProductId}_${asset.path}`];
    const bgColor = pixelColor || EXTENDED_MAP[colorCode] || EXTENDED_MAP[label];
    
    if (bgColor) {
      // Calcolo contrasto testo (bianco o nero)
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
    // Aggiorniamo la selezione locale
    setSelections(prev => ({
      ...prev,
      [selectedProductId]: {
        ...prev[selectedProductId],
        [componentName]: asset
      }
    }));

    // AGGIORNIAMO LA MASTER CONFIG PER EMULAZIONE
    // Estraiamo il colore e il tipo di superficie dall'asset selezionato
    const name = asset.name.toUpperCase();
    const parts = name.replace(/\..+$/, '').split(/[_\s-]/);
    const colorCode = parts.length >= 2 ? parts[1].toUpperCase() : parts[0].toUpperCase();
    const isAmmaccato = name.includes('_A') || asset.fullPath.toUpperCase().includes('AMM');

    setMasterConfig({ colorCode, isAmmaccato });
    console.log(`Master Style Updated: ${colorCode} (${isAmmaccato ? 'Ammaccato' : 'Liscio'})`);
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

  const handleFloraGenerate = async () => {
    setIsFloraRunning(true);
    setError(null);
    setFloraStatus('Inizializzazione AI (Upload)...');

    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas non trovato');

      const mockupUrl = canvas.toDataURL('image/png');
      const runId = await floraService.startGeneration({
        image: mockupUrl,
        technique: 'rotazione360'
      });

      setFloraStatus('Generazione in corso (Flora AI)...');

      const poll = async () => {
        const result = await floraService.pollStatus(runId);
        setFloraResult(result);

        if (result.status === 'completed') {
          setIsFloraRunning(false);
          setFloraStatus('Completato!');
          confetti({ particleCount: 200, spread: 100 });
        } else if (result.status === 'failed') {
          setIsFloraRunning(false);
          setError(result.errorMessage || 'Errore durante la generazione AI');
        } else {
          setFloraStatus(`Generazione: ${result.progress || 0}%`);
          setTimeout(poll, 3000);
        }
      };

      poll();
    } catch (err: any) {
      setError(err.message || 'Errore di connessione');
      setIsFloraRunning(false);
    }
  };

  const handleSmartSwitch = () => {
    if (!selectedProduct || !selections[selectedProductId]) return;
    
    const currentSelections = selections[selectedProductId];
    const newSelections = { ...currentSelections };
    let switchedCount = 0;

    // 1. Determiniamo la direzione globale
    let globalTarget: 'LISCIO' | 'AMMACCATO' | null = null;
    for (const cName of Object.keys(currentSelections)) {
      const asset = currentSelections[cName];
      const path = asset.fullPath.toUpperCase();
      const name = asset.name.toUpperCase();
      
      if (path.includes('LISCIO') || name.includes('_L')) {
        globalTarget = 'AMMACCATO';
        break;
      } else if (path.includes('AMM') || name.includes('_A')) {
        globalTarget = 'LISCIO';
        break;
      }
    }

    if (!globalTarget) return;

    // 2. Applichiamo la direzione
    Object.keys(currentSelections).forEach(cName => {
      const asset = currentSelections[cName];
      const name = asset.name.toUpperCase();
      const fromSuffix = globalTarget === 'AMMACCATO' ? '_L' : '_A';
      const toSuffix = globalTarget === 'AMMACCATO' ? '_A' : '_L';
      const targetFolder = globalTarget;

      const expectedName = name.replace(fromSuffix, toSuffix);
      const possibleAssets = selectedProduct.components[cName];
      if (!possibleAssets) return;

      const target = possibleAssets.find(a => {
        const aName = a.name.toUpperCase();
        const aFolder = a.folder.toUpperCase();
        return aName === expectedName && (aFolder.includes(targetFolder) || aFolder.includes(targetFolder.substring(0, 3)));
      }) || possibleAssets.find(a => a.name.toUpperCase() === expectedName);

      if (target) {
        newSelections[cName] = target;
        switchedCount++;
      }
    });

    if (switchedCount > 0) {
      setSelections(prev => ({ ...prev, [selectedProductId]: newSelections }));
      setFloraStatus(`Studio Hub: -> ${globalTarget} ✨`);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 }, colors: ['#6366f1', '#f59e0b'] });
      setTimeout(() => setFloraStatus(''), 2000);
    }
  };

  const handleSmartFit = async () => {
    if (!selectedProduct || !selectedGraphic) return;
    
    setFloraStatus('Analisi Bounding Box...');
    try {
      // 1. Troviamo l'asset del corpo principale
      const mainCompName = Object.keys(selectedProduct.components).find(c => {
        const n = c.toUpperCase();
        return n.includes('CONTENITORE') || n.includes('FLACONE') || n.includes('JAR') || 
               n.includes('BARATTOLO') || n.includes('BOTTIGLIA') || n.includes('VASO') ||
               n.includes('LAMPADA') || n.includes('STRUTTURA');
      }) || Object.keys(selectedProduct.components)[0];

      const asset = selections[selectedProductId]?.[mainCompName];
      if (!asset) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      let baseUrl = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
      img.src = baseUrl;
      
      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = 400; // Analisi a bassa risoluzione per velocità
      canvas.height = 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 400, 500);
      const data = ctx.getImageData(0, 0, 400, 500).data;

      // Analizziamo la larghezza di ogni riga per trovare il "corpo solido"
      let rowWidths = [];
      for (let y = 0; y < 500; y++) {
        let first = -1, last = -1;
        for (let x = 0; x < 400; x++) {
          if (data[(y * 400 + x) * 4 + 3] > 20) {
            if (first === -1) first = x;
            last = x;
          }
        }
        rowWidths[y] = first === -1 ? 0 : last - first;
      }

      // Troviamo la riga più larga (il diametro del barattolo)
      const maxWidth = Math.max(...rowWidths);
      
      // Il "corpo" inizia quando la riga è almeno il 70% della larghezza massima
      // (questo esclude i bastoncini che sono molto più stretti del barattolo)
      let bodyTop = 0, bodyBottom = 499;
      for (let y = 0; y < 500; y++) {
        if (rowWidths[y] > maxWidth * 0.7) {
          bodyTop = y;
          break;
        }
      }
      for (let y = 499; y >= 0; y--) {
        if (rowWidths[y] > 5) { // Fine del prodotto alla base
          bodyBottom = y;
          break;
        }
      }

      const bodyHeight = bodyBottom - bodyTop;
      const centerY = bodyTop + (bodyHeight / 2);

      // Calcoliamo scala e posizione
      // Mappiamo i 500px del canvas ai 1250px reali del mockup (fattore 2.5)
      const realCenterY = centerY * 2.5;
      const targetY = Math.round((realCenterY - 625) / 5); // Offset relativo al centro (625)
      
      // La scala si basa sulla larghezza del corpo
      const targetScale = Math.round((maxWidth / 400) * 110); 

      setGraphicScale(targetScale);
      setGraphicY(targetY);
      setGraphicX(0); // Centrato orizzontalmente di default

      setFloraStatus('Smart Fit: Corpo Rilevato! ✨');
      setTimeout(() => setFloraStatus(''), 2000);
    } catch (err) {
      setFloraStatus('Errore Smart Fit');
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    const canvas = document.querySelector('canvas');
    if (canvas && selectedProduct) {
      // Troviamo il nome dell'asset principale selezionato (es. PLS_NERO_L)
      const mainCompName = Object.keys(selectedProduct.components).find(c => {
        const n = c.toUpperCase();
        return n.includes('CONTENITORE') || n.includes('FLACONE') || n.includes('JAR') || 
               n.includes('BARATTOLO') || n.includes('BOTTIGLIA') || n.includes('VASO') ||
               n.includes('LAMPADA') || n.includes('STRUTTURA');
      }) || Object.keys(selectedProduct.components)[0];

      const asset = selections[selectedProductId]?.[mainCompName];
      const productName = asset ? asset.name.split('.')[0] : selectedProductId;
      const graphicName = selectedGraphic ? selectedGraphic.name.split('.')[0] : 'default';
      
      const fileName = `${productName}_${graphicName}.jpg`;

      const link = document.createElement('a');
      link.download = fileName;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      link.href = dataUrl;
      link.click();

      // Salviamo nella cronologia
      saveToHistory({
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        fileName,
        productName,
        graphicName,
        // Non salviamo il dataUrl intero per non saturare il localStorage
      });

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899'] });
    }
    setTimeout(() => setIsExporting(false), 1000);
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6 md:p-10 font-sans relative overflow-hidden">
        {/* Animated Background Elements */}
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
                {loginError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-[10px] font-black uppercase mt-2 tracking-widest"
                  >
                    Password Errata
                  </motion.p>
                )}
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
            
            <div className="mt-10 flex items-center justify-center gap-2 text-white/20">
              <ShieldCheck size={14} />
              <span className="text-[9px] font-bold uppercase tracking-widest">End-to-End Encrypted Session</span>
            </div>
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
          <p className="text-white/40 text-xs leading-relaxed mb-8">
            Impossibile connettersi al server. Verifica che la password sia corretta e che il server Railway sia attivo.<br/>
            <span className="opacity-50 mt-2 block">{connectionError}</span>
          </p>
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
      {/* Product Switcher Bar */}
      <div className="h-16 bg-slate-900 border-b border-white/10 flex items-center px-6 gap-4 shrink-0 overflow-x-auto no-scrollbar shadow-2xl z-20">
        <div className="flex items-center gap-3 pr-6 border-r border-white/5 mr-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">P</div>
          <h1 className="text-xs font-black uppercase tracking-tighter whitespace-nowrap">Studio Hub</h1>
        </div>
        {products.map(product => (
          <button
            key={product.id}
            onClick={() => setSelectedProductId(product.id)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedProductId === product.id ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
          >
            {product.name}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-[320px] h-full bg-slate-900 border-r border-white/10 flex flex-col overflow-hidden shrink-0 shadow-2xl">
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {/* Dynamic Product Components */}
            {selectedProduct && Object.entries(selectedProduct.components).map(([cName, assets], index) => {
              const categories = Array.from(new Set(assets.map(a => {
                const parts = a.folder.split(/[/\\]/);
                let cat = parts[parts.length - 1].toUpperCase();
                // Se l'ultima cartella è METAL, prendiamo quella superiore per la categoria principale
                if (cat === 'METAL' && parts.length > 1) {
                  cat = parts[parts.length - 2].toUpperCase();
                }
                return cat;
              }))).filter(c => c).sort();

              const selectedAsset = selections[selectedProductId]?.[cName];
              const sParts = selectedAsset?.folder.split(/[/\\]/) || [];
              let currentCategory = sParts[sParts.length - 1]?.toUpperCase() || categories[0];
              if (currentCategory === 'METAL' && sParts.length > 1) {
                currentCategory = sParts[sParts.length - 2].toUpperCase();
              }
              
              const categoryAssets = assets.filter(a => {
                const f = a.folder.toUpperCase();
                return f.includes(currentCategory);
              });

              const switchCategory = (cat: string) => {
                const target = assets.find(a => {
                  const f = a.folder.toUpperCase();
                  return f.includes(cat) && !f.endsWith('METAL');
                }) || assets.find(a => a.folder.toUpperCase().includes(cat));
                if (target) handleSelection(cName, target);
              };
              
              const uniqueStandard = getUniqueAssets(categoryAssets.filter(a => !a.folder.toUpperCase().includes('METAL')));
              const uniqueMetal = getUniqueAssets(categoryAssets.filter(a => a.folder.toUpperCase().includes('METAL')));

              return (
                <section key={cName} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest block text-white/20">{index + 1}. {cName}</label>
                      {(currentCategory.includes('LISCIO') || currentCategory.includes('AMM')) && (
                        <button 
                          onClick={handleSmartSwitch}
                          className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase tracking-tighter transition-all border border-indigo-500/20"
                        >
                          Switch {currentCategory.includes('LISCIO') ? 'Amm' : 'Liscio'}
                        </button>
                      )}
                    </div>
                    {categories.length > 1 && (
                      <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{currentCategory}</span>
                    )}

                  {categories.length > 1 && (
                    <div className="flex flex-wrap gap-1 p-1 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                      {categories.map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => switchCategory(cat)} 
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${currentCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {uniqueStandard.map((asset) => {
                      const name = asset.name.toUpperCase();
                      const parts = name.replace(/\..+$/, '').split('_');
                      const displayLabel = parts.length >= 2 ? parts[1].substring(0, 3) : formatLabel(asset.name).substring(0, 3);
                      
                      return (
                        <button
                          key={asset.path}
                          onClick={() => handleSelection(cName, asset)}
                          style={getAssetStyle(asset)}
                          title={formatLabel(asset.name)}
                          className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                        >
                          {displayLabel}
                        </button>
                      );
                    })}
                  </div>

                  {uniqueMetal.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Metal Edition</span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {uniqueMetal.map((asset) => {
                          const name = asset.name.toUpperCase();
                          const parts = name.replace(/\..+$/, '').split('_');
                          const displayLabel = parts.length >= 2 ? parts[1].substring(0, 3) : formatLabel(asset.name).substring(0, 3);

                          return (
                            <button
                              key={asset.path}
                              onClick={() => handleSelection(cName, asset)}
                              style={getAssetStyle(asset)}
                              title={formatLabel(asset.name)}
                              className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                            >
                              {displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

          <div className="p-5 border-t border-white/5 shrink-0 bg-slate-950/30">
            <button onClick={handleFloraGenerate} disabled={isFloraRunning} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/20 active:scale-95">
              < Wand2 size={18} /> {isFloraRunning ? 'Processing...' : 'AI Render Reality'}
            </button>
          </div>
        </div>

        <div className="flex-1 h-full bg-[#f8f8f8] flex flex-col relative">
          {/* Top Header */}
          <div className="h-14 border-b border-black/[0.05] bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-[60]">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-black text-black/20 uppercase tracking-[0.3em]">{selectedProduct?.name || 'Studio'} View</h2>
              <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-4 px-3 py-1.5 bg-black/5 rounded-xl border border-black/[0.03]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-black/30 uppercase w-8">Scala</span>
                  <div className="flex items-center bg-white/80 rounded-lg p-0.5 shadow-sm">
                    <button onClick={() => setGraphicScale(s => Math.max(10, s - 1))} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronDown size={12} /></button>
                    <input type="range" min="10" max="250" value={graphicScale} onChange={(e) => setGraphicScale(parseInt(e.target.value))} className="w-16 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black mx-1" />
                    <button onClick={() => setGraphicScale(s => Math.min(400, s + 1))} className="p-1 hover:bg-black/5 rounded text-black/40"><ChevronDown className="rotate-180" size={12} /></button>
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
                <button onClick={handleSmartFit} className="p-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all flex items-center gap-2 group border border-indigo-500/20">
                  <Wand2 size={14} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:inline">Smart Fit</span>
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

                <button 
                  onClick={handleExport} 
                  disabled={isExporting || !selectedGraphic} 
                  className="px-8 py-3 text-[10px] rounded-xl bg-black text-white font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-black/20 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100"
                >
                  <Download size={18} /> 
                  <span className="hidden sm:inline">Export Design</span>
                </button>
              </div>
            </div>
          </div>


          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10">
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30 relative">
              <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
                {selectedProduct ? (
                  <div className="relative w-full h-full flex items-center justify-center max-w-5xl mx-auto">
                      <MockupCanvas
                        product={selectedProduct}
                        selections={selections[selectedProductId] || {}}
                        graphic={selectedGraphic?.path || 'PLACEHOLDER'}
                        graphicScale={graphicScale}
                        graphicY={graphicY}
                        graphicX={graphicX}
                      />
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
                <h2 className="text-[10px] font-black text-black/20 uppercase tracking-[0.2em]">Reality Engine</h2>
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
    </div>
  );
}

export default App;
