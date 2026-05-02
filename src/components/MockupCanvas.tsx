import { useRef, useEffect, useState } from 'react';
import { config } from '../config';

interface ComponentAsset {
  name: string;
  path: string;
  folder: string;
  fullPath: string;
}

interface Product {
  id: string;
  name: string;
  components: Record<string, ComponentAsset[]>;
}

interface MockupCanvasProps {
  product: Product | null;
  selections: Record<string, ComponentAsset>;
  graphic: string | null;
  graphicScale: number;
  graphicY: number;
  graphicX: number;
  centerY?: number; // Passiamo il valore esatto dall'App
  baseWidth?: number; // Passiamo il valore esatto dall'App
}

const PRODUCT_CALIBRATION: { keywords: string[], centerY: number, baseWidth: number }[] = [
  { keywords: ['CANDELA 220'], centerY: 0.55, baseWidth: 320 },
  { keywords: ['CANDELA 450'], centerY: 0.55, baseWidth: 380 },
  { keywords: ['MINI', 'STICK'], centerY: 0.65, baseWidth: 240 },
  { keywords: ['PROFUMATORE', 'PROF_', 'BARATTOLO'], centerY: 0.76, baseWidth: 285 },
  { keywords: ['LAMPADA', 'LAMP_'], centerY: 0.74, baseWidth: 285 },
];

const DEFAULT_CALIBRATION = { centerY: 0.5, baseWidth: 300 };

const MockupCanvas = (props: MockupCanvasProps) => {
  const { product, selections, graphic, graphicScale, graphicY, graphicX, centerY: propCenterY, baseWidth: propBaseWidth } = props;

  // Logica di calibrazione centralizzata
  const pName = product?.name.toUpperCase() || '';
  const calibration = PRODUCT_CALIBRATION.find(c => 
    c.keywords.some(k => pName.includes(k))
  ) || DEFAULT_CALIBRATION;

  const currentCenterY = propCenterY !== undefined ? propCenterY : calibration.centerY;
  const currentBaseWidth = propBaseWidth !== undefined ? propBaseWidth : calibration.baseWidth;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Record<string, HTMLImageElement | null>>({});
  const [loading, setLoading] = useState(true);

  const loadImage = (src: string, isExternal = false): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      if (isExternal) img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.error("Failed to load image:", src);
        resolve(null);
      };
    });
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const newImages: Record<string, HTMLImageElement | null> = {};
      
      console.log("MockupCanvas: Inizio caricamento asset per", product.id);

      // Load Product Components
      const pass = localStorage.getItem('pretty_auth') || '';
      const componentTasks = Object.entries(selections).map(async ([cName, asset]) => {
        let url = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
        // Aggiungiamo il token di autenticazione se è una chiamata al nostro server
        if (url.includes(config.apiUrl)) {
          url += (url.includes('?') ? '&' : '?') + `token=${pass}`;
        }
        
        console.log(`MockupCanvas: Caricamento componente ${cName}`);
        const img = await loadImage(url, true);
        newImages[cName] = img;
      });

      // Load Graphic
      const hasGraphic = graphic && graphic !== 'PLACEHOLDER';
      let graphicUrl = null;
      if (hasGraphic) {
        if (graphic.startsWith('http')) {
          graphicUrl = graphic;
        } else if (graphic.length > 20) {
          graphicUrl = config.endpoints.file(graphic);
        } else {
          graphicUrl = `${config.apiUrl}/grafiche-files/${graphic}`;
        }
        
        // Aggiungiamo il token anche alla grafica
        if (graphicUrl && graphicUrl.includes(config.apiUrl)) {
          graphicUrl += (graphicUrl.includes('?') ? '&' : '?') + `token=${pass}`;
        }
      }
      
      const graphicTask = graphicUrl ? loadImage(graphicUrl, true) : Promise.resolve(null);

      try {
        await Promise.all([...componentTasks, graphicTask.then(img => { newImages['graphic'] = img; })]);
      } catch (err) {
        console.error("MockupCanvas: Errore critico nel caricamento asset", err);
      }
      
      setImages(newImages);
      setLoading(false);
      console.log("MockupCanvas: Caricamento completato", Object.keys(newImages));
    };

    if (product && selections && Object.keys(selections).length > 0) {
      loadAll();
    }
  }, [selections, graphic, product]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1000;
    canvas.height = 1250;

    // Clear and Fill Background (Dimensioni fisse 1000x1250)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff'; // Bianco pulito come da riferimento
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Layers (Allineamento 1:1 per asset 1000x1250)
    Object.keys(product.components).forEach(cName => {
      const img = images[cName];
      if (img) {
        ctx.drawImage(img, 0, 0, 1000, 1250);
      }
    });

    // Draw Graphic Overlay
    if (images.graphic) {
      const gScale = graphicScale / 100;
      const graphicWidth = currentBaseWidth * gScale;
      const aspectRatio = images.graphic.height / images.graphic.width;
      const graphicHeight = graphicWidth * aspectRatio;

      const centerX = (canvas.width / 2) + graphicX;
      const jarCenterY = canvas.height * currentCenterY;
      const centerY = jarCenterY + graphicY - (graphicHeight / 2);

      ctx.save();
      ctx.drawImage(images.graphic, centerX - graphicWidth / 2, centerY, graphicWidth, graphicHeight);
      ctx.restore();
    }

    // --- DEBUG VISIVO: Disegniamo la griglia salvata ---
    if (props.debugRect) {
      const rx = (props.debugRect.x / 100) * canvas.width;
      const ry = (props.debugRect.y / 100) * canvas.height;
      const rw = (props.debugRect.w / 100) * canvas.width;
      const rh = (props.debugRect.h / 100) * canvas.height;

      ctx.save();
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();
    }

    if (Object.keys(images).length === 0 && !loading) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NESSUN COMPONENTE CARICATO', canvas.width/2, canvas.height/2);
    }
  }, [images, loading, graphicScale, graphicY, graphicX, product, currentCenterY, currentBaseWidth, props.debugRect]);

  return (
    <div className="relative flex items-center justify-center">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-30 rounded-[2rem]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest animate-pulse">Rendering Hub...</p>
          </div>
        </div>
      )}
      <canvas 
        ref={canvasRef}
        className="max-w-full max-h-full object-contain shadow-[0_30px_60px_rgba(0,0,0,0.1)] rounded-[2rem] bg-white transition-opacity duration-500"
        style={{ opacity: loading ? 0.5 : 1 }}
      />
    </div>
  );
};

export default MockupCanvas;
