import { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCcw, Video, Wand2, AlertCircle, CheckCircle2, Search, Folder, ChevronRight, ChevronDown } from 'lucide-react';
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

const COLOR_MAP: Record<string, string> = {
  'BAB': '#E0FFFF', 'PLS': '#FF69B4', 'ARG': '#C0C0C0', 'AZZ': '#87CEEB',
  'BEI': '#F5F5DC', 'BK': '#1A1A1A', 'BLU': '#0000FF', 'BRW': '#A52A2A',
  'CIL': '#8B0000', 'CYT': '#E4D00A', 'GRA': '#808080', 'GRI': '#808080',
  'LIL': '#C8A2C8', 'MAG': '#FF00FF', 'MAL': '#E0B0FF', 'MAN': '#FF8C00',
  'MEN': '#98FB98', 'NAV': '#000080', 'OLI': '#808000', 'ORA': '#D4AF37',
  'OTT': '#008080', 'OW': '#FAF9F6', 'PNK': '#FFB6C1', 'POL': '#B0C4DE',
  'RED': '#FF0000', 'ROS': '#FF0000', 'RUG': '#A0522D', 'SAB': '#F4A460',
  'SAL': '#FA8072', 'TIF': '#008080', 'VER': '#008000', 'VIO': '#EE82EE',
  'WH': '#FFFFFF', 'YW': '#FFD700', 'STI': '#8B4513'
};

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selections, setSelections] = useState<Record<string, Record<string, ComponentAsset>>>({});

  const [graficheList, setGraficheList] = useState<GraphicAsset[]>([]);
  const [selectedGraphic, setSelectedGraphic] = useState<GraphicAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [graphicScale, setGraphicScale] = useState(100);
  const [graphicY, setGraphicY] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const [isFloraRunning, setIsFloraRunning] = useState(false);
  const [floraResult, setFloraResult] = useState<FloraResponse | null>(null);
  const [floraStatus, setFloraStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setConnectionError(null);
        // Fetch Prodotti
        const pRes = await fetch(config.endpoints.products, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!pRes.ok) throw new Error(`Errore Server Prodotti: ${pRes.status}`);
        const pData: Product[] = await pRes.json();
        setProducts(pData);
        if (pData.length > 0) {
          setSelectedProductId(pData[0].id);
          // Initial selections
          const initialSelections: Record<string, Record<string, ComponentAsset>> = {};
          pData.forEach(p => {
            initialSelections[p.id] = {};
            Object.entries(p.components).forEach(([cName, assets]) => {
              if (assets.length > 0) initialSelections[p.id][cName] = assets[0];
            });
          });
          setSelections(initialSelections);
        }

        // Fetch Grafiche
        const gRes = await fetch(config.endpoints.grafiche, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!gRes.ok) throw new Error(`Errore Server Grafiche: ${gRes.status}`);
        const gData: GraphicAsset[] = await gRes.json();
        setGraficheList(gData);
        if (gData.length > 0) {
          setSelectedGraphic(gData[0]);
          setExpandedFolders({ [gData[0].folder]: true });
        }
      } catch (err: any) {
        console.error("Errore nel caricamento dati", err);
        setConnectionError(`Errore di connessione a ${config.apiUrl}. Verifica che il server Railway sia attivo. Dettaglio: ${err.message}`);
      }
    };
    init();
  }, []);

  const [assetColors, setAssetColors] = useState<Record<string, string>>({});

  const getImageAverageColor = (url: string, isStick: boolean = false): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');
        canvas.width = 10; canvas.height = 10;

        const sourceX = isStick ? img.width * 0.48 : img.width * 0.45;
        const sourceY = isStick ? img.height * 0.48 : img.height * 0.82;
        const sourceWidth = img.width * 0.05;
        const sourceHeight = img.height * 0.05;

        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 10, 10);
        const imageData = ctx.getImageData(5, 5, 1, 1).data;
        if (imageData[3] < 50 && isStick) {
          ctx.drawImage(img, sourceX, img.height * 0.6, sourceWidth, sourceHeight, 0, 0, 10, 10);
          const fallbackData = ctx.getImageData(5, 5, 1, 1).data;
          return resolve(`rgb(${fallbackData[0]},${fallbackData[1]},${fallbackData[2]})`);
        }
        resolve(`rgb(${imageData[0]},${imageData[1]},${imageData[2]})`);
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

      for (const [cName, assets] of Object.entries(selectedProduct.components)) {
        const isStick = cName.toUpperCase().includes('STICK');
        for (const asset of assets) {
          const colorKey = `${selectedProductId}_${asset.path}`;
          if (!newColors[colorKey]) {
            const assetUrl = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
            const color = await getImageAverageColor(assetUrl, isStick);
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
    const colorKey = `${selectedProductId}_${asset.path}`;
    const bgColor = assetColors[colorKey];
    if (bgColor) {
      const match = bgColor.match(/\d+/g);
      if (match) {
        const [r, g, b] = match.map(Number);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return { backgroundColor: bgColor, color: brightness > 155 ? '#000' : '#fff' };
      }
    }
    const label = formatLabel(asset.name);
    const EXTENDED_MAP: Record<string, string> = {
      ...COLOR_MAP,
      'BK': '#000000', 'BLACK': '#000000',
      'RED': '#FF0000', 'ROSSO': '#FF0000',
      'PNK': '#FFB6C1', 'PINK': '#FFB6C1', 'ROSA': '#FFB6C1',
      'BEI': '#F5F5DC', 'BEIGE': '#F5F5DC',
      'BLU': '#0000FF', 'BLUE': '#0000FF',
      'AZZ': '#87CEEB', 'AZZURRO': '#87CEEB',
      'GRI': '#808080', 'GRIGIO': '#808080',
      'WH': '#FFFFFF', 'WHITE': '#FFFFFF', 'BIANCO': '#FFFFFF',
      'YW': '#FFFF00', 'YELLOW': '#FFFF00', 'GIALLO': '#FFFF00'
    };
    const fallbackColor = EXTENDED_MAP[label] || EXTENDED_MAP[label.split(' ')[0]] || '#333';
    return { backgroundColor: fallbackColor, color: '#fff' };
  };

  const handleSelection = (componentName: string, asset: ComponentAsset) => {
    setSelections(prev => ({
      ...prev,
      [selectedProductId]: {
        ...prev[selectedProductId],
        [componentName]: asset
      }
    }));
  };

  const handleSmartSwitch = () => {
    if (!selectedProduct) return;
    
    // Cerchiamo il componente principale da switchare (Contenitore, Flacone, Barattolo, etc.)
    const mainComp = Object.keys(selectedProduct.components).find(c => {
      const name = c.toUpperCase();
      return name.includes('CONTENITORE') || name.includes('FLACONE') || 
             name.includes('JAR') || name.includes('BARATTOLO') || 
             name.includes('BOTTIGLIA') || name.includes('VASO');
    });
    
    if (!mainComp) return;
    
    const currentAsset = selections[selectedProductId]?.[mainComp];
    if (!currentAsset) return;

    const currentName = currentAsset.name.toUpperCase();
    const isLiscio = currentName.endsWith('_L.PNG') || currentName.endsWith('_L.JPG') || currentName.endsWith('_L.SVG') || currentName.includes('_L');
    const isAmm = currentName.endsWith('_A.PNG') || currentName.endsWith('_A.JPG') || currentName.endsWith('_A.SVG') || currentName.includes('_A');
    
    if (!isLiscio && !isAmm) return;

    const baseName = currentAsset.name.substring(0, currentAsset.name.lastIndexOf('_'));
    const targetSuffix = isLiscio ? '_A' : '_L';
    
    const assets = selectedProduct.components[mainComp];
    
    // Cerchiamo l'asset con lo stesso prefisso ma suffisso opposto
    const targetAsset = assets.find(a => {
      const aName = a.name.toUpperCase();
      return aName.startsWith(baseName.toUpperCase()) && aName.includes(targetSuffix);
    });

    if (targetAsset) {
      handleSelection(mainComp, targetAsset);
      confetti({ particleCount: 30, spread: 20, origin: { y: 0.8 }, colors: ['#6366f1'] });
    }
  };

  const handleSmartFit = async () => {
    if (!selectedProduct) return;
    
    // Cerchiamo il componente principale (Contenitore, Flacone, Barattolo, etc.)
    const containerComp = Object.keys(selectedProduct.components).find(c => {
      const name = c.toUpperCase();
      return name.includes('CONTENITORE') || name.includes('FLACONE') || 
             name.includes('JAR') || name.includes('BARATTOLO') || 
             name.includes('BOTTIGLIA') || name.includes('VASO');
    });
    
    if (!containerComp) return;
    
    const asset = selections[selectedProductId]?.[containerComp];
    if (!asset) return;

    const assetUrl = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = assetUrl;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      
      let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
      let found = false;

      // Scansioniamo i pixel per trovare l'area non trasparente
      for (let y = 0; y < canvas.height; y += 5) {
        for (let x = 0; x < canvas.width; x += 5) {
          const alpha = imageData[(y * canvas.width + x) * 4 + 3];
          if (alpha > 50) { // Pixel non trasparente
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      if (found) {
        const jarWidth = maxX - minX;
        const jarHeight = maxY - minY;
        const jarCenterY = minY + (jarHeight / 2);
        
        // Calcoliamo la scala (usando circa l'80% della larghezza del contenitore per il padding)
        // Supponiamo che la grafica originale sia circa 1000px di base nel canvas
        const targetWidth = jarWidth * 0.75;
        const newScale = Math.round((targetWidth / 500) * 100); // 500 è una base empirica per il nostro MockupCanvas
        
        // Calcoliamo la posizione Y relativa al centro dell'immagine (1000x1250)
        const relativeY = Math.round((jarCenterY - 625)); // 625 è il centro verticale di 1250
        
        setGraphicScale(newScale);
        setGraphicY(relativeY);
        
        confetti({ particleCount: 50, spread: 30, origin: { y: 0.8 }, colors: ['#a855f7'] });
      }
    };
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
        const result = await floraService.pollStatus(runId, 'rotazione360');
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

  const handleRandomize = () => {
    if (!selectedProduct) return;

    const newProductSelections = { ...selections[selectedProductId] };
    Object.entries(selectedProduct.components).forEach(([cName, assets]) => {
      newProductSelections[cName] = assets[Math.floor(Math.random() * assets.length)];
    });

    setSelections(prev => ({ ...prev, [selectedProductId]: newProductSelections }));
    const randomGraphic = graficheList[Math.floor(Math.random() * graficheList.length)];
    if (randomGraphic) setSelectedGraphic(randomGraphic);
    setFloraResult(null);
  };

  const handleExport = () => {
    setIsExporting(true);
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `mockup-${selectedProductId.toLowerCase()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899'] });
    }
    setTimeout(() => setIsExporting(false), 1000);
  };

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
            onClick={() => window.location.reload()}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl"
          >
            <RefreshCcw size={18} /> Riprova Connessione
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
                const last = parts[parts.length - 1].toUpperCase();
                return last === 'METAL' ? (parts[parts.length - 2]?.toUpperCase() || 'STANDARD') : last;
              }))).filter(c => c && c !== 'METAL').sort();

              const currentCategory = selections[selectedProductId]?.[cName]?.folder.split(/[/\\]/).shift()?.toUpperCase() || categories[0];
              
              const categoryAssets = assets.filter(a => a.folder.toUpperCase().includes(currentCategory));
              
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
                    <div className="flex flex-wrap gap-1 p-1 bg-white/5 rounded-xl">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            const firstInCat = assets.find(a => a.folder.toUpperCase().includes(cat));
                            if (firstInCat) handleSelection(cName, firstInCat);
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${currentCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {uniqueStandard.map((asset) => (
                      <button
                        key={asset.path}
                        onClick={() => handleSelection(cName, asset)}
                        style={getAssetStyle(asset)}
                        title={formatLabel(asset.name)}
                        className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                      >
                        {formatLabel(asset.name).substring(0, 3)}
                      </button>
                    ))}
                  </div>

                  {uniqueMetal.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Metal Edition</span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {uniqueMetal.map((asset) => (
                          <button
                            key={asset.path}
                            onClick={() => handleSelection(cName, asset)}
                            style={getAssetStyle(asset)}
                            title={formatLabel(asset.name)}
                            className={`w-10 h-10 rounded-full transition-all border-2 flex items-center justify-center text-[9px] font-black shadow-md ${selections[selectedProductId]?.[cName]?.path === asset.path ? 'border-white scale-110 ring-4 ring-indigo-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}`}
                          >
                            {formatLabel(asset.name).substring(0, 3)}
                          </button>
                        ))}
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

        <div className="flex-1 h-full bg-[#f8f8f8] flex flex-col overflow-hidden relative">
          {/* Top Header */}
          <div className="h-14 border-b border-black/[0.05] bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-black text-black/20 uppercase tracking-[0.3em]">{selectedProduct?.name || 'Studio'} View</h2>
              <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6 px-4 py-1.5 bg-black/5 rounded-2xl border border-black/[0.03]">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-black/30">Scala</span>
                  <input type="range" min="10" max="250" value={graphicScale} onChange={(e) => setGraphicScale(parseInt(e.target.value))} className="w-24 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black" />
                  <span className="text-[9px] font-bold text-black w-8">{graphicScale}%</span>
                </div>
                <div className="w-[1px] h-4 bg-black/10" />
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-black/30">Posizione Y</span>
                  <input type="range" min="-300" max="400" value={graphicY} onChange={(e) => setGraphicY(parseInt(e.target.value))} className="w-24 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black" />
                  <span className="text-[9px] font-bold text-black w-8">{graphicY}px</span>
                </div>
                <button onClick={() => { setGraphicScale(100); setGraphicY(0); }} className="p-1.5 rounded-lg hover:bg-black/10 text-black/40 hover:text-black transition-all" title="Reset">
                  <RefreshCcw size={14} />
                </button>
              </div>

                <button 
                  onClick={handleSmartSwitch} 
                  className="px-4 py-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all flex items-center gap-2 group border border-indigo-500/20" 
                  title="Switch Liscio/Ammatcato"
                >
                  <RefreshCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Switch</span>
                </button>
                <div className="w-[1px] h-4 bg-black/10" />
                <button onClick={handleSmartFit} className="p-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all flex items-center gap-2 group" title="Adatta Automaticamente">
                  <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:inline">Smart Fit</span>
                </button>
                <div className="w-[1px] h-4 bg-black/10" />
                <button 
                  onClick={async () => {
                    setFloraStatus('Aggiornamento asset...');
                    try {
                      const pRes = await fetch(config.endpoints.products, {
                        headers: { 'ngrok-skip-browser-warning': 'true' }
                      });
                      const pData = await pRes.json();
                      setProducts(pData);
                      const gRes = await fetch(config.endpoints.grafiche, {
                        headers: { 'ngrok-skip-browser-warning': 'true' }
                      });
                      const gData = await gRes.json();
                      setGraficheList(gData);
                      setFloraStatus('Asset aggiornati');
                      setTimeout(() => setFloraStatus(''), 2000);
                    } catch (e) {
                      setError('Errore durante l\'aggiornamento asset');
                    }
                  }} 
                  className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black/40 hover:text-black transition-all flex items-center gap-2 group" 
                  title="Aggiorna OneDrive"
                >
                  <RefreshCcw size={16} className="group-active:rotate-180 transition-transform duration-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:inline">Sync OneDrive</span>
                </button>
                <button onClick={handleRandomize} className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black/40 transition-all" title="Randomize"><RefreshCcw size={16} /></button>
                <button onClick={handleExport} disabled={isExporting || !selectedGraphic} className="px-6 py-2.5 text-[10px] rounded-xl bg-black text-white font-black uppercase tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20">
                  <Download size={16} /> Export HQ
                </button>
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
