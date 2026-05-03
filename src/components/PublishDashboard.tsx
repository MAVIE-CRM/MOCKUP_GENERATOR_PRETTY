import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ExternalLink, Loader2, ChevronRight, Info } from 'lucide-react';
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
    status: "draft",
    productType: "Profumi e colonie",
    vendor: "Pretty Little Scent®",
    collections: ["Profumatori", "Nuovi Arrivi", "BestSeller_Ever"],
    tags: `PRETTY, ${productData.categoryName}, ${productData.color}, MOCKUP`,
    color: productData.color,
    podWidth: "666,0",
    podHeight: "666,0",
    podSvgUrl: "",
    podSvgFile: "",
    options: [] as any[],
    realVariants: [] as any[],
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
        if (isMounted && result.product) {
          const p = result.product;
          setFormData(prev => ({
            ...prev,
            description: p.body_html ? p.body_html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') : prev.description,
            productType: p.product_type || prev.productType,
            vendor: p.vendor || prev.vendor,
            tags: p.tags || prev.tags,
            status: p.status || prev.status,
            // Recuperiamo le opzioni reali (Modello, Fragranza, ecc.)
            options: p.options || [],
            // Recuperiamo le varianti reali (Prezzi, SKU, ecc.)
            realVariants: p.variants || []
          }));
        } else if (isMounted) {
          setFormData(prev => ({ 
            ...prev, 
            description: `⚠️ TEMPLATE NON TROVATO\nID: ${productData.templateId}\nRisposta Server: ${JSON.stringify(result)}` 
          }));
        }
      } catch (error: any) {
        const detail = error.response?.data?.error || error.message;
        console.error("Dettaglio Errore:", error);
        if (isMounted) {
          setFormData(prev => ({ 
            ...prev, 
            description: `❌ ERRORE DI CONNESSIONE\nID: ${productData.templateId}\nMessaggio: ${detail}` 
          }));
        }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full h-full md:w-[95vw] md:h-[95vh] bg-slate-50 flex flex-col shadow-2xl md:rounded-xl overflow-hidden text-slate-700"
      >
        {/* Header */}
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!publishResult ? (
            <>
              <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[12px] font-medium text-slate-900 mb-1.5 block">Titolo</label>
                        <input 
                          type="text" 
                          value={formData.title}
                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-medium text-slate-900 mb-1.5 block">Descrizione</label>
                        <div className="border border-slate-300 rounded-md overflow-hidden">
                          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-4">
                            <span className="text-[12px] font-bold text-slate-400">B</span>
                            <span className="text-[12px] italic text-slate-400">I</span>
                            <span className="text-[12px] underline text-slate-400">U</span>
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

                  <Card title="Contenuti multimediali">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                      {mockupImages.slice(0, 4).map((img, i) => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative">
                          <img src={img.base64} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Varianti" extra={<span className="text-slate-400 text-[11px] font-medium">{formData.realVariants?.length || 0} varianti totali</span>}>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        {formData.options && formData.options.map((opt: any) => (
                          <div key={opt.id} className="flex items-start gap-4 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                            <div className="p-2 bg-white border border-slate-200 rounded text-slate-400 text-[10px] font-bold uppercase">{opt.name}</div>
                            <div className="flex-1 flex flex-wrap gap-1.5">
                              {opt.values.map((val: string, i: number) => (
                                <span key={i} className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded text-[11px] shadow-sm">{val}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-[12px] text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-2">Variante</th>
                              <th className="px-4 py-2">Prezzo</th>
                              <th className="px-4 py-2">SKU</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {formData.realVariants && formData.realVariants.slice(0, 10).map((v: any) => (
                              <tr key={v.id} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-900">{v.title}</td>
                                <td className="px-4 py-3 text-indigo-600 font-bold">{v.price} €</td>
                                <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{v.sku || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Card>

                  <Card title="Inserzione sui motori di ricerca">
                    <div className="space-y-1">
                      <p className="text-[12px] font-bold text-indigo-700 uppercase">PRETTYLITTLE.it®</p>
                      <p className="text-[11px] text-slate-400 truncate">https://www.prettylittle.it › products › {formData.title.toLowerCase().replace(/ /g, '-')}</p>
                      <p className="text-[16px] text-indigo-600 font-medium">{formData.title}</p>
                      <p className="text-[12px] text-slate-500 line-clamp-2">
                        {formData.description.replace(/<[^>]*>/g, '').slice(0, 160) || 'Ancora nessuna descrizione.'}
                      </p>
                      <p className="text-[13px] font-bold text-slate-900 mt-2">
                        {formData.realVariants?.length > 0 
                          ? `${Math.min(...formData.realVariants.map((v: any) => parseFloat(v.price))).toFixed(2).replace('.', ',')} € EUR`
                          : "34,90 € EUR"
                        }
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                  <Card title="Stato">
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] focus:border-indigo-500 outline-none bg-white"
                    >
                      <option value="active">Attivo</option>
                      <option value="draft">Bozza</option>
                    </select>
                  </Card>

                  <Card title="Organizzazione del prodotto">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">Tipo</label>
                        <input type="text" value={formData.productType} className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]" readOnly />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">Venditore</label>
                        <input type="text" value={formData.vendor} className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]" readOnly />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">Tag</label>
                        <input type="text" value={formData.tags} className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12px]" readOnly />
                      </div>
                    </div>
                  </Card>

                  <Card title="Metafield di Prodotto" extra={<Info size={14} className="text-slate-300" />}>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">POD SVG File</label>
                        <div className="flex items-center gap-2 border border-slate-300 rounded-md px-3 py-2 bg-slate-50">
                          <span className="text-[11px] text-slate-600 truncate">{formData.podSvgFile || 'Automatico'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 mb-1 block">Colore</label>
                        <div className="flex items-center gap-3 border border-slate-300 rounded-md px-3 py-2">
                          <div className="w-4 h-4 rounded-sm border border-slate-200" style={{ backgroundColor: productData.color }} />
                          <span className="text-[11px] font-mono text-slate-500 uppercase">{productData.color}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between sticky bottom-0 z-10">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium text-[13px] hover:bg-slate-50 rounded-md transition-colors">Chiudi</button>
                <div className="flex items-center gap-3">
                  {isQueueMode && <span className="text-[11px] font-medium text-slate-400 mr-2">Prodotto {queueProgress?.current} di {queueProgress?.total}</span>}
                  <button
                    onClick={handleStartPublish}
                    disabled={isPublishing}
                    className="px-6 py-2 bg-[#008060] text-white rounded-md font-bold text-[13px] flex items-center gap-2 hover:bg-[#006e52] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isPublishing ? <><Loader2 size={16} className="animate-spin" /> Salvataggio...</> : <><CheckCircle2 size={16} /> Salva</>}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 bg-white rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto mt-10 p-10">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Prodotto caricato con successo!</h3>
                <p className="text-[14px] text-slate-500">La bozza di "{formData.title}" è stata creata sul tuo store Shopify.</p>
              </div>
              <div className="flex gap-3">
                <a href={publishResult.adminUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 bg-slate-900 text-white rounded-md font-bold text-[13px] flex items-center gap-2 hover:bg-slate-800 transition-colors">
                  <ExternalLink size={16} /> Vedi su Shopify
                </a>
                <button onClick={onNext || onClose} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-md font-bold text-[13px] hover:bg-slate-50 transition-colors">
                  {isQueueMode ? 'Prossimo prodotto' : 'Chiudi'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Publishing Overlay */}
        <AnimatePresence>
          {isPublishing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full text-center space-y-6">
                <div className="relative w-16 h-16 mx-auto">
                   <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                   <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-[18px] font-bold text-slate-900 uppercase tracking-tight">Pubblicazione in corso...</h4>
                  <div className="max-h-32 overflow-y-auto font-mono text-[10px] text-slate-400 bg-slate-50 p-3 rounded-lg text-left divide-y divide-slate-100">
                    {logs.map((log, i) => <div key={i} className="py-1">{log}</div>)}
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
