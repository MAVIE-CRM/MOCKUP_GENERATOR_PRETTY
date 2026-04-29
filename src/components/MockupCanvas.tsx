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
  product: Product;
  selections: Record<string, ComponentAsset>;
  graphic: string;
  graphicScale: number;
  graphicY: number;
  graphicX: number;
}

const PRODUCT_CALIBRATION: Record<string, { centerY: number, baseWidth: number }> = {
  'PROFUMATORE': { centerY: 0.74, baseWidth: 285 },
  'LAMPADA': { centerY: 0.74, baseWidth: 285 },
  'CANDELA 220': { centerY: 0.55, baseWidth: 320 },
  'CANDELA 450': { centerY: 0.55, baseWidth: 380 },
  'MINI': { centerY: 0.65, baseWidth: 240 },
  'DEFAULT': { centerY: 0.5, baseWidth: 300 }
};

const MockupCanvas = ({ product, selections, graphic, graphicScale, graphicY, graphicX }: MockupCanvasProps) => {
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
      const componentTasks = Object.entries(selections).map(async ([cName, asset]) => {
        const url = asset.fullPath.startsWith('http') ? asset.fullPath : `${config.apiUrl}${asset.fullPath}`;
        console.log(`MockupCanvas: Caricamento componente ${cName} da ${url}`);
        const img = await loadImage(url, true); // Always use anonymous for cross-origin
        if (!img) console.error(`MockupCanvas: ERRORE caricamento ${cName}`);
        newImages[cName] = img;
      });

      // Load Graphic
      const hasGraphic = graphic && graphic !== 'PLACEHOLDER';
      
      // If graphic is an ID (OneDrive), use proxy, otherwise use local path
      let graphicUrl = null;
      if (hasGraphic) {
        if (graphic.startsWith('http')) {
          graphicUrl = graphic;
        } else if (graphic.length > 20) { // Likely a OneDrive ID
          graphicUrl = config.endpoints.file(graphic);
        } else {
          graphicUrl = `${config.apiUrl}/grafiche-files/${graphic}`;
        }
      }

      if (graphicUrl) console.log(`MockupCanvas: Caricamento grafica da ${graphicUrl}`);
      
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

    // Clear and Fill Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Check if we have at least one image
    const loadedComponents = Object.keys(images).filter(k => k !== 'graphic' && images[k]);
    
    if (loadedComponents.length === 0) {
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 30px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('NESSUN COMPONENTE VISIBILE', canvas.width/2, canvas.height/2);
        ctx.font = '16px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Verifica connessione server o cartella PRODOTTI', canvas.width/2, canvas.height/2 + 40);
        return;
    }

    // Draw Layers (in order of component definitions)
    Object.keys(product.components).forEach(cName => {
      const img = images[cName];
      if (img) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    });

    // Draw Graphic Overlay
    if (images.graphic) {
      const calibration = PRODUCT_CALIBRATION[product.id] || PRODUCT_CALIBRATION['DEFAULT'];
      const gScale = graphicScale / 100;
      const graphicWidth = calibration.baseWidth * gScale;
      const aspectRatio = images.graphic.height / images.graphic.width;
      const graphicHeight = graphicWidth * aspectRatio;

      const centerX = (canvas.width / 2) + graphicX;
      const jarCenterY = canvas.height * calibration.centerY;
      const centerY = jarCenterY + graphicY - (graphicHeight / 2);

      ctx.save();
      ctx.drawImage(images.graphic, centerX - graphicWidth / 2, centerY, graphicWidth, graphicHeight);
      ctx.restore();
    }

    if (Object.keys(images).length === 0 && !loading) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NESSUN COMPONENTE CARICATO', canvas.width/2, canvas.height/2);
    }
  }, [images, loading, graphicScale, graphicY, graphicX, product]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
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
