import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, CheckCircle2, ExternalLink, Loader2, Image as ImageIcon, Tag, Palette, AlignLeft, Layers, ChevronRight, Search, Globe, MoreHorizontal, HelpCircle, Package, Info } from 'lucide-react';
import { config } from '../config';

interface PublishDashboardProps {
  productData: {
    title: string;
    fullTitle?: string;
    color: string;
    templateId: string;
    categoryName: string;
    graphicName: string;
    expectedImages: number;
  };
  mockupImages: { base64: string, filename: string, alt: string }[];
  onPublish: (formData: any, logCallback: (msg: string) => void) => Promise<any>;
  onClose: () => void;
  onNext?: () => void;
  isQueueMode?: boolean;
  queueProgress?: { current: number, total: number };
}

const PublishDashboard: React.FC<PublishDashboardProps> = ({ productData, mockupImages, onPublish, onClose, onNext, isQueueMode, queueProgress }) => {
  const [formData, setFormData] = useState({
    title: productData.fullTitle || productData.title,
    description: "",
    status: "active",
    productType: "Profumi e colonie",
    vendor: "Pretty Little Scent®",
    collections: ["Profumatori", "Nuovi Arrivi", "BestSeller_Ever"],
    tags: `PRETTY, ${productData.categoryName}, ${productData.color}, MOCKUP`,
    color: productData.color,
    podWidth: "666,0",
    podHeight: "666,0",
    podSvgUrl: "",
    podSvgFile: "Button-Pla...timate.svg",
    // Varianti Predefinite dal Template
    variants: {
      modello: ["Liscio", "Ammaccato"],
      formato: ["150ml", "300ml"],
      fragranza: ["Frutti Rossi", "Ambra", "Legno", "Limoncè", "Floreale", "Vetiver", "Miele Bianco", "Acqua Marina", "Arancia&Cannella"]
    }
  });

  const [isPublishing, setIsPublishing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [publishResult, setPublishResult] = useState<{ adminUrl: string } | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const fetchTemplateDescription = async () => {
      try {
        const authPass = localStorage.getItem('pretty_auth') || '';
        const res = await fetch(`${config.apiUrl}/api/shopify-publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': authPass },
          body: JSON.stringify({
            action: 'get-product',
            data: { productId: productData.templateId }
          })
        });
        const result = await res.json();
        if (isMounted && result.product && result.product.body_html) {
          setFormData(prev => ({ ...prev, description: result.product.body_html }));
        }
      } catch (err: any) {
        console.error("Errore recupero template:", err);
      }
    };

    if (productData.templateId) {
      fetchTemplateDescription();
    }
    return () => { isMounted = false; };
  }, [productData.templateId]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleStartPublish = async () => {
    setIsPublishing(true);
    setLogs([]);
    const result = await onPublish(formData, addLog);
    if (result.success) {
      setPublishResult(result);
    }
    setIsPublishing(false);
  };

  const Card: React.FC<{ title?: string, children: React.ReactNode, footer?: React.ReactNode, extra?: React.ReactNode }> = ({ title, children, footer, extra }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {(title || extra) && (
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          {title && <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>}
          {extra}
        </div>
      )}
      <div className="p-4 flex-1">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/90 backdrop-blur-sm overflow-hidden">
      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-full md:w-[95vw] md:h-[95vh] bg-slate-50 flex flex-col shadow-2xl md:rounded-xl overflow-hidden text-slate-700"
      >
        {/* Shopify Style Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-500">
              <ChevronRight className="rotate-180" size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Prodotti</span>
              <ChevronRight size={14} className="text-slate-300" />
              <h1 className="text-[14px] font-bold text-slate-900">{formData.title}</h1>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Attivo</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 bg-white">Duplica</button>
            <button className="px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300 bg-white">Visualizza</button>
            <button 
              onClick={handleStartPublish}
              disabled={isPublishing}
              className="px-4 py-1.5 text-[12px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {isPublishing ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!publishResult ? (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Column */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Title & Description */}
                <Card>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[12px] font-medium text-slate-900 mb-1.5 block">Titolo</label>
                      <input 
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="Nome del prodotto"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-900 mb-1.5 block">Descrizione</label>
                      <div className="border border-slate-300 rounded-md overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-4">
                          <span className="text-[12px] font-bold text-slate-400">B</span>
                          <span className="text-[12px] italic text-slate-400">I</span>
                          <span className="text-[12px] underline text-slate-400">U</span>
                          <div className="w-[1px] bg-slate-200 h-4 self-center" />
                          <AlignLeft size={14} className="text-slate-400" />
                        </div>
                        <textarea 
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={10}
                          className="w-full p-4 text-[13px] text-slate-600 outline-none resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Media */}
                <Card title="Contenuti multimediali">
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                    {mockupImages.slice(0, 4).map((img, i) => (
                      <div key={i} className="aspect-square bg-slate-100 rounded-lg border border-slate-200 overflow-hidden group relative">
                        <img src={img.base64} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 bg-white/90 rounded p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal size={14} />
                        </div>
                      </div>
                    ))}
                    <div className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <ImageIcon size={20} />
                      </div>
                      <span className="text-[11px] font-medium">Aggiungi</span>
                    </div>
                  </div>
                </Card>

                {/* Varianti */}
                <Card title="Varianti" extra={<button className="text-indigo-600 text-[12px] font-medium">+ Aggiungi variante</button>}>
                  <div className="space-y-6">
                    {/* Opzioni */}
                    <div className="space-y-4">
                      {Object.entries(formData.variants).map(([key, options]) => (
                        <div key={key} className="flex items-start gap-4 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                          <div className="p-2 bg-white border border-slate-200 rounded text-slate-400">
                            <MoreHorizontal size={14} className="rotate-90" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{key}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {options.map((opt, i) => (
                                <span key={i} className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded text-[11px] shadow-sm">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Tabella Varianti */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-[12px] text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2 font-semibold">Variante</th>
                            <th className="px-4 py-2 font-semibold">Prezzo</th>
                            <th className="px-4 py-2 font-semibold">Disponibile</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="bg-white">
                            <td className="px-4 py-3 flex items-center gap-3">
                               <div className="w-8 h-10 bg-slate-100 rounded overflow-hidden">
                                  <img src={mockupImages[0]?.base64} className="w-full h-full object-cover" />
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900">Liscio</p>
                                  <p className="text-slate-400 text-[10px]">18 varianti</p>
                               </div>
                            </td>
                            <td className="px-4 py-3">
                               <div className="flex items-center border border-slate-200 rounded px-2 py-1 w-fit bg-white">
                                  <input type="text" value="34,90 - 44,90" className="w-24 outline-none text-[11px]" readOnly />
                                  <span className="text-slate-400 ml-1">€</span>
                               </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400">18000</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-4 py-3 flex items-center gap-3">
                               <div className="w-8 h-10 bg-slate-100 rounded overflow-hidden">
                                  <img src={mockupImages[1]?.base64} className="w-full h-full object-cover" />
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900">Ammaccato</p>
                                  <p className="text-slate-400 text-[10px]">18 varianti</p>
                               </div>
                            </td>
                            <td className="px-4 py-3">
                               <div className="flex items-center border border-slate-200 rounded px-2 py-1 w-fit bg-white">
                                  <input type="text" value="34,90 - 44,90" className="w-24 outline-none text-[11px]" readOnly />
                                  <span className="text-slate-400 ml-1">€</span>
                               </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400">17999</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
                         <span className="text-slate-400 font-medium">Scorte totali in tutte le sedi: 35999 disponibili</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* SEO Preview */}
                <Card title="Inserzione sui motori di ricerca">
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-indigo-700 uppercase leading-tight">PRETTYLITTLE.it®</p>
                    <p className="text-[11px] text-slate-400 truncate">https://www.prettylittle.it › products › {formData.title.toLowerCase().replace(/ /g, '-')}</p>
                    <p className="text-[16px] text-indigo-600 font-medium leading-snug">{formData.title}</p>
                    <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                      {formData.description.replace(/<[^>]*>/g, '').slice(0, 160) || 'Ancora nessuna descrizione per questo prodotto.'}
                    </p>
                    <p className="text-[13px] font-bold text-slate-900 mt-2">34,90 € EUR</p>
                  </div>
                </Card>
              </div>

              {/* Sidebar Column */}
              <div className="space-y-6">
                
                {/* Status */}
                <Card title="Stato">
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] focus:border-indigo-500 outline-none appearance-none bg-white"
                  >
                    <option value="active">Attivo</option>
                    <option value="draft">Bozza</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-2">Questo prodotto sarà disponibile in tutti i canali di vendita.</p>
                </Card>

                {/* Publishing */}
                <Card title="Pubblicazione" extra={<Layers size={14} className="text-slate-300" />}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-slate-400" />
                        <span className="text-[12px]">Negozio online</span>
                      </div>
                      <Package size={14} className="text-slate-400" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['Facebook & Instagram', 'Pinterest', 'POS', 'TikTok'].map(t => (
                        <span key={t} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">{t}</span>
                      ))}
                    </div>
                    <button className="flex items-center gap-2 text-indigo-600 text-[12px] font-medium">
                      <CheckCircle2 size={12} /> Google & YouTube <ChevronRight size={12} className="rotate-90" />
                    </button>
                  </div>
                </Card>

                {/* Organization */}
                <Card title="Organizzazione del prodotto">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">Tipo</label>
                      <input 
                        type="text" 
                        value={formData.productType}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">Venditore</label>
                      <input 
                        type="text" 
                        value={formData.vendor}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">Collezioni</label>
                      <div className="flex flex-wrap gap-1 mb-2">
                         {formData.collections.map(c => (
                           <span key={c} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 border border-indigo-100">
                             {c} <X size={8} />
                           </span>
                         ))}
                      </div>
                      <div className="relative">
                        <input type="text" placeholder="Cerca collezioni" className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-2 text-[12px]" />
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">Tag</label>
                      <input 
                        type="text" 
                        value={formData.tags}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]"
                      />
                    </div>
                  </div>
                </Card>

                {/* Metafield POD */}
                <Card title="Metafield di Prodotto" extra={<Info size={14} className="text-slate-300" />}>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">POD SVG URL</label>
                      <input 
                        type="text" 
                        placeholder="https://cdn.shopify.com/..."
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px] font-mono text-slate-400 overflow-hidden text-ellipsis"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">POD SVG File</label>
                      <div className="flex items-center gap-2 border border-slate-300 rounded-md px-3 py-2 bg-slate-50">
                        <ChevronRight size={12} className="rotate-90 text-slate-400" />
                        <span className="text-[11px] text-slate-600">{formData.podSvgFile}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">POD Altezza (mm)</label>
                        <input type="text" value={formData.podHeight} className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">POD Larghezza (mm)</label>
                        <input type="text" value={formData.podWidth} className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 mb-1 block">Colore</label>
                      <div className="flex items-center gap-3 border border-slate-300 rounded-md px-3 py-2">
                        <div className="w-4 h-4 rounded-sm border border-slate-200" style={{ backgroundColor: productData.color }} />
                        <span className="text-[11px] font-mono text-slate-500 uppercase">{productData.color}</span>
                      </div>
                    </div>
                    <button className="text-indigo-600 text-[11px] font-medium">Visualizza tutto</button>
                  </div>
                </Card>

              </div>
            </div>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 bg-white rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto mt-10">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Prodotto caricato con successo!</h3>
                <p className="text-[14px] text-slate-500">
                  La bozza di "{formData.title}" è stata creata sul tuo store Shopify.
                </p>
              </div>
              <div className="flex gap-3">
                <a 
                  href={publishResult.adminUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-md font-bold text-[13px] flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <ExternalLink size={16} /> Vedi su Shopify
                </a>
                <button 
                  onClick={onNext || onClose}
                  className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-md font-bold text-[13px] hover:bg-slate-50 transition-colors"
                >
                  {isQueueMode ? 'Prossimo prodotto' : 'Chiudi'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Overlay */}
        <AnimatePresence>
          {isPublishing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full text-center space-y-6">
                <div className="relative w-16 h-16 mx-auto">
                   <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                   <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-[18px] font-bold text-slate-900 uppercase tracking-tight">Pubblicazione in corso...</h4>
                  <div className="max-h-32 overflow-y-auto font-mono text-[10px] text-slate-400 bg-slate-50 p-3 rounded-lg text-left divide-y divide-slate-100">
                    {logs.map((log, i) => (
                      <div key={i} className="py-1">{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default PublishDashboard;
