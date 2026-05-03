import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, CheckCircle2, ExternalLink, Loader2, Image as ImageIcon, Tag, Palette, AlignLeft, Layers, Sliders, ChevronRight } from 'lucide-react';

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
    description: "", // Inizia vuoto come richiesto
    tags: `PRETTY, ${productData.categoryName}, ${productData.color}, MOCKUP`,
    color: productData.color,
    podWidth: 666,
    podHeight: 666
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [publishResult, setPublishResult] = useState<{ adminUrl: string } | null>(null);

  // Caricamento descrizione dal template PRIMA di mostrare o durante il mount
  React.useEffect(() => {
    let isMounted = true;
    const fetchTemplateDescription = async () => {
      try {
        const authPass = localStorage.getItem('pretty_auth') || '';
        const res = await fetch('/api/shopify-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': authPass },
          body: JSON.stringify({
            action: 'get-product',
            data: { productId: productData.templateId }
          })
        });
        const result = await res.json();
        console.log("Shopify Template Data:", result);
        if (isMounted && result.product && result.product.body_html) {
          setFormData(prev => ({ ...prev, description: result.product.body_html }));
        } else if (isMounted) {
          setFormData(prev => ({ ...prev, description: `ERRORE: Prodotto non trovato o body_html vuoto. ID cercato: ${productData.templateId}\nRisposta server: ${JSON.stringify(result)}` }));
        }
      } catch (err: any) {
        console.error("Errore recupero template:", err);
        if (isMounted) {
          setFormData(prev => ({ ...prev, description: `ERRORE FATALE: ${err.message}\nVerifica la connessione o l'ID ${productData.templateId}` }));
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={!isPublishing && !publishResult ? onClose : undefined}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
      />

      {/* Modal */}
      <motion.div 
        key={productData.templateId + productData.graphicName} // Re-render when product changes in queue
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-2xl text-green-400">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                {isQueueMode ? `Revisione ${queueProgress?.current}/${queueProgress?.total}` : 'Pubblica su Shopify'}
              </h2>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                {productData.categoryName} — {productData.graphicName}
              </p>
            </div>
          </div>
          {!isPublishing && !publishResult && (
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all">
              <X size={24} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {!publishResult ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left Column: Form */}
              <div className="space-y-8">
                <section className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                    <Tag size={12} /> Titolo Prodotto
                  </label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-green-500/50 transition-all"
                  />
                </section>

                <section className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                    <AlignLeft size={12} /> Descrizione (Bozza)
                  </label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white/80 text-xs outline-none focus:border-green-500/50 transition-all resize-none"
                  />
                </section>

                <div className="grid grid-cols-2 gap-4">
                  <section className="space-y-4">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                      <Layers size={12} /> Tag
                    </label>
                    <input 
                      type="text" 
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-green-500/50 transition-all"
                    />
                  </section>
                  <section className="space-y-4">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                      <Palette size={12} /> Colore Pixel Engine
                    </label>
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                      <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: formData.color }} />
                      <input 
                        type="text" 
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="bg-transparent text-white font-mono text-[10px] uppercase outline-none flex-1"
                      />
                    </div>
                  </section>
                </div>
              </div>

              {/* Right Column: Previews & Status */}
              <div className="space-y-8">
                <section className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                    <ImageIcon size={12} /> Asset Immagini (Pronti per Shopify)
                  </label>
                  
                  {mockupImages && mockupImages.length > 0 ? (
                    <div className={`grid ${productData.expectedImages === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                      {mockupImages.slice(0, productData.expectedImages).map((img, i) => (
                        <div key={i} className="space-y-2">
                          <div className="aspect-[4/5] bg-black rounded-3xl overflow-hidden border-2 border-white/10 group relative shadow-2xl">
                            <img src={img.base64} alt={img.alt} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                               <CheckCircle2 size={32} className="text-green-500 shadow-2xl" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                              <span className="text-[10px] font-black uppercase text-white tracking-widest">
                                {productData.expectedImages === 2 ? (i === 0 ? 'LISCIO' : 'AMMACCATO') : 'UNICA FOTO'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video bg-white/5 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/20">
                      <ImageIcon size={48} className="mb-2" />
                      <p className="text-[10px] font-black uppercase">Nessuna immagine catturata</p>
                    </div>
                  )}
                </section>

                <AnimatePresence>
                  {isPublishing && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-black/50 rounded-3xl p-6 font-mono text-[10px] space-y-2 border border-white/5 shadow-2xl"
                    >
                      {logs.map((log, i) => (
                        <div key={i} className="text-white/60 flex items-start gap-2">
                          <span className="text-green-500">›</span> {log}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-8">
              <div className="w-32 h-32 bg-green-500/20 rounded-[3rem] flex items-center justify-center text-green-500 shadow-[0_0_80px_rgba(34,197,94,0.3)]">
                <CheckCircle2 size={64} />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Prodotto Caricato!</h3>
                <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
                  Bozza creata con successo. {isQueueMode ? `Pronto per il prossimo dei ${queueProgress?.total} prodotti?` : ''}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <a 
                  href={publishResult.adminUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-10 py-5 bg-green-600 hover:bg-green-500 rounded-2xl text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-2xl shadow-green-600/30 active:scale-95"
                >
                  <ExternalLink size={18} /> Vedi su Shopify
                </a>
                {isQueueMode && onNext && (
                  <button 
                    onClick={onNext}
                    className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-2xl shadow-indigo-600/30 active:scale-95"
                  >
                    Prossimo Prodotto <ChevronRight size={18} />
                  </button>
                )}
                {!isQueueMode && (
                   <button 
                   onClick={onClose}
                   className="px-10 py-5 bg-white/5 hover:bg-white/10 rounded-2xl text-white/60 font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
                 >
                   Chiudi
                 </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!publishResult && (
          <div className="p-6 md:p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
            <button 
              disabled={isPublishing}
              onClick={onClose} 
              className="px-6 py-4 rounded-2xl text-white/40 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Annulla Tutto
            </button>
            <button 
              disabled={isPublishing || !formData.title}
              onClick={handleStartPublish}
              className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-2xl ${isPublishing ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/30 active:scale-95'}`}
            >
              {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
              {isPublishing ? 'Caricamento...' : 'Conferma e Crea Bozza'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PublishDashboard;
