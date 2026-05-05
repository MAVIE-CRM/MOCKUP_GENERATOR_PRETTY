import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ExternalLink, Loader2, ChevronRight, Save, ShoppingBag, AlertCircle } from 'lucide-react';
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
    description?: string;
  };
  mockupImages: { base64: string, filename: string, alt: string }[];
  onPublish: (formData: any, logCallback: (msg: string) => void) => Promise<any>;
  onSave?: (formData: any) => void;
  onClose: () => void;
  onNext?: () => void;
  isQueueMode?: boolean;
  queueProgress?: { current: number, total: number };
}

const PublishDashboard: React.FC<PublishDashboardProps> = ({ productData, mockupImages, onPublish, onSave, onClose, onNext, isQueueMode, queueProgress }) => {
  const [formData, setFormData] = useState({
    title: productData.fullTitle || productData.title,
    description: productData.description || "",
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
    variants: {
      modello: ["Liscio", "Ammaccato"],
      formato: ["150ml", "300ml"],
      fragranza: ["Frutti Rossi", "Ambra", "Legno", "Limoncè", "Floreale", "Vetiver", "Miele Bianco", "Acqua Marina", "Arancia&Cannella"]
    }
  });

  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [publishResult, setPublishResult] = useState<{ adminUrl: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const fetchTemplateDescription = async () => {
      // Se abbiamo già una descrizione (caricata dalla coda), non sovrascriviamola subito
      if (productData.description && productData.description.length > 10) return;

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
            options: p.options || [],
            realVariants: p.variants || []
          }));
        }
      } catch (error: any) {
        console.error("Errore recupero template:", error);
      }
    };

    if (productData.templateId) {
      fetchTemplateDescription();
    }
    return () => { isMounted = false; };
  }, [productData.templateId]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleLocalSave = async () => {
    if (onSave) {
      setIsSaving(true);
      await onSave(formData);
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const handleStartPublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setLogs([]);
    try {
      const result = await onPublish(formData, addLog);
      if (result.success) {
        setPublishResult(result);
        setIsPublishing(false);
      } else {
        setPublishError(result.error || "Errore durante la pubblicazione");
        setIsPublishing(false);
      }
    } catch (err: any) {
      setPublishError(err.message || "Errore di connessione");
      setIsPublishing(false);
    }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/90 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-7xl h-full max-h-[95vh] bg-slate-50 flex flex-col shadow-2xl rounded-3xl overflow-hidden text-slate-700 border border-white"
      >
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
              <ChevronRight className="rotate-180" size={20} />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Editor Prodotto</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Shopify Sync</span>
              </div>
              <h1 className="text-[15px] font-black text-slate-900 uppercase tracking-tighter">{formData.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLocalSave}
              disabled={isSaving || isPublishing}
              className="px-5 py-2 text-[12px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
            <button 
              onClick={handleStartPublish}
              disabled={isPublishing || isSaving}
              className="px-6 py-2 text-[12px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
              {isPublishing ? 'Invio...' : 'Invia a Shopify'}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc]">
          {!publishResult ? (
            <>
              <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Titolo Prodotto</label>
                      <input 
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[14px] font-bold text-slate-900 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                        placeholder="Nome del prodotto..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Descrizione Shopify</label>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 focus-within:bg-white focus-within:border-indigo-500 transition-all">
                        <div className="bg-slate-50/50 border-b border-slate-200 px-4 py-2 flex gap-4">
                          <span className="text-[11px] font-black text-slate-300">B</span>
                          <span className="text-[11px] font-black italic text-slate-300">I</span>
                          <span className="text-[11px] font-black underline text-slate-300">U</span>
                        </div>
                        <textarea 
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={12}
                          className="w-full bg-transparent p-5 text-[13px] text-slate-600 outline-none resize-none leading-relaxed font-medium"
                          placeholder="Inserisci la descrizione..."
                        />
                      </div>
                    </div>
                  </div>

                  <Card title="Contenuti multimediali">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {mockupImages.map((img, i) => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative group">
                          <img src={img.base64} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">{i === 0 ? 'Main' : `Img ${i+1}`}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Varianti Prodotto" extra={<span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">{formData.realVariants?.length || 0} Varianti</span>}>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        {formData.options && formData.options.map((opt: any) => (
                          <div key={opt.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-[10px] font-black uppercase tracking-tighter shadow-sm">{opt.name}</div>
                            <div className="flex-1 flex flex-wrap gap-2">
                              {opt.values.map((val: string, i: number) => (
                                <span key={i} className="bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-lg text-[11px] font-bold shadow-sm">{val}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full text-[12px] text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
                            <tr>
                              <th className="px-6 py-4">Variante</th>
                              <th className="px-6 py-4">Prezzo</th>
                              <th className="px-6 py-4">SKU</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {formData.realVariants && formData.realVariants.slice(0, 10).map((v: any) => (
                              <tr key={v.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-black text-slate-900">{v.title}</td>
                                <td className="px-6 py-4 text-emerald-600 font-black">{v.price} €</td>
                                <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">{v.sku || '---'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-8">
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 block">Visibilità Store</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, status: 'active' }))}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.status === 'active' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Attivo
                      </button>
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, status: 'draft' }))}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.status === 'draft' ? 'bg-white text-slate-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Bozza
                      </button>
                    </div>
                  </div>

                  <Card title="Organizzazione">
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Tipologia</label>
                        <input type="text" value={formData.productType} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[12px] font-bold text-slate-600" readOnly />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Venditore</label>
                        <input type="text" value={formData.vendor} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[12px] font-bold text-slate-600" readOnly />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Tag Attuali</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          {formData.tags.split(',').map((tag, i) => (
                            <span key={i} className="text-[10px] font-black text-indigo-600 bg-white px-2 py-1 rounded-md shadow-sm border border-indigo-100">{tag.trim()}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>

                  <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700" />
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl">
                          <ShoppingBag size={20} className="text-indigo-400" />
                        </div>
                        <h4 className="text-[13px] font-black uppercase tracking-widest">Shopify Meta</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                          <label className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40 mb-1 block">POD SVG</label>
                          <span className="text-[11px] font-bold text-white/80">{formData.podSvgFile || 'GENERAZIONE AUTOMATICA'}</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                          <label className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40 mb-1 block">Colore Mappa</label>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: productData.color }} />
                            <span className="text-[11px] font-black text-white">{productData.color}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-6 bg-white border-t border-slate-200 flex items-center justify-between sticky bottom-0 z-10">
                <button onClick={onClose} className="px-8 py-3 text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-slate-900 transition-colors">Annulla</button>
                <div className="flex items-center gap-4">
                  {isQueueMode && <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mr-4">{queueProgress?.current} / {queueProgress?.total} IN CODA</span>}
                  <button
                    onClick={handleStartPublish}
                    disabled={isPublishing || isSaving}
                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 hover:-translate-y-0.5 transition-all flex items-center gap-3 disabled:opacity-50 active:translate-y-0"
                  >
                    {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                    {isPublishing ? 'Invio...' : 'Invia Prodotto'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 bg-white rounded-[3rem] shadow-2xl border border-slate-100 max-w-2xl mx-auto mt-20 p-16 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-indigo-600" />
              <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-inner">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Caricato!</h3>
                <p className="text-[15px] text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">Il prodotto "{formData.title}" è stato sincronizzato correttamente con Shopify.</p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <a href={publishResult.adminUrl} target="_blank" rel="noopener noreferrer" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl">
                  <ExternalLink size={18} /> Apri Shopify Admin
                </a>
                <button onClick={onNext || onClose} className="w-full py-5 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all">
                  {isQueueMode ? 'Prossimo in Coda' : 'Torna al Catalogo'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Publishing Overlay */}
        <AnimatePresence>
          {(isPublishing || publishError) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[120] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6">
              <div className="bg-white rounded-[3rem] shadow-2xl border border-white p-10 max-w-md w-full text-center space-y-8">
                {!publishError ? (
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                    <ShoppingBag size={24} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-red-50 rounded-[2.5rem] flex items-center justify-center text-red-500 mx-auto">
                    <AlertCircle size={40} />
                  </div>
                )}
                
                <div className="space-y-4">
                  <h4 className={`text-xl font-black uppercase tracking-tighter ${publishError ? 'text-red-600' : 'text-slate-900'}`}>
                    {publishError ? 'Errore di Sincronizzazione' : 'Invio a Shopify...'}
                  </h4>
                  
                  {publishError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-[12px] font-bold leading-relaxed">
                      {publishError}
                    </div>
                  )}

                  <div className="max-h-40 overflow-y-auto font-mono text-[10px] text-slate-400 bg-slate-50 p-5 rounded-2xl text-left divide-y divide-slate-100 custom-scrollbar border border-slate-100">
                    {logs.map((log, i) => <div key={i} className="py-1.5 flex items-start gap-2"><span className="text-indigo-300">›</span> {log}</div>)}
                  </div>
                </div>

                {publishError && (
                  <button 
                    onClick={() => { setIsPublishing(false); setPublishError(null); }}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl"
                  >
                    Riprova
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default PublishDashboard;
