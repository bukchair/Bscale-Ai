import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Sparkles, Image as ImageIcon, Type, Send, Wand2, Layout, Plus, Loader2, Download, ShoppingCart, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateCreativeCopy } from '../lib/gemini';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useConnections } from '../contexts/ConnectionsContext';

const mockProducts = [
  { id: 1, name: 'נעלי ריצה מקצועיות', shortDesc: 'נעלי ריצה נוחות.', longDesc: 'נעלי ריצה מקצועיות עם סוליה בולמת זעזועים. מתאימות לריצות ארוכות.', price: '₪450' },
  { id: 2, name: 'שעון חכם ספורט', shortDesc: 'שעון חכם למעקב.', longDesc: 'שעון חכם עם מד דופק, GPS ומעקב שינה. עמיד במים.', price: '₪890' },
  { id: 3, name: 'אוזניות אלחוטיות', shortDesc: 'אוזניות בלוטוס.', longDesc: 'אוזניות אלחוטיות עם סינון רעשים אקטיבי וסוללה ל-24 שעות.', price: '₪350' },
];

export function CreativeLab() {
  const { t, dir } = useLanguage();
  const { navigateTo } = useAppNavigation();
  const { connections } = useConnections();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'copy' | 'video'>('image');
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const prefilledProduct = localStorage.getItem('creativeLab:selectedProduct');
    if (!prefilledProduct) return;
    try {
      const parsed = JSON.parse(prefilledProduct);
      setSelectedProduct(parsed);
      if (!prompt) {
        setPrompt(`צור קריאייטיב עבור ${parsed.name}. תיאור: ${parsed.shortDesc || ''}`);
      }
    } catch (err) {
      console.error('Failed to parse prefilled product', err);
    } finally {
      localStorage.removeItem('creativeLab:selectedProduct');
    }
  }, []);

  const handleCopyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleDownloadByUrl = async (url: string, filename: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handlePublishToMeta = () => {
    const isMetaConnected = connections.find((c) => c.id === 'meta')?.status === 'connected';
    if (!isMetaConnected) {
      showToast('יש לחבר קודם את Meta Ads כדי לפרסם.');
      navigateTo('connections');
      return;
    }

    showToast('הקריאייטיב נשלח לאישורים ואוטומציות.');
    navigateTo('approvals-automations');
  };

  const handleGenerateStoryboard = () => {
    if (!generatedContent?.script?.length) {
      showToast('אין תסריט זמין ליצירת סטוריבורד.');
      return;
    }

    const storyboard = generatedContent.script
      .map((scene: any, idx: number) =>
        `Scene ${idx + 1}\nTime: ${scene.time}\nVisual: ${scene.visual}\nAudio: ${scene.audio}\n`
      )
      .join('\n');
    handleDownloadTextFile(storyboard, 'storyboard.txt');
    showToast('סטוריבורד נוצר והורד בהצלחה.');
  };

  const handleGenerate = async () => {
    if (!prompt && !selectedProduct) return;
    setIsGenerating(true);
    
    if (activeTab === 'copy' && selectedProduct) {
      try {
        const res = await generateCreativeCopy(selectedProduct.name, selectedProduct.longDesc, prompt);
        setGeneratedContent({
          type: 'copy',
          options: res.options || []
        });
      } catch (error) {
        console.error("Failed to generate copy", error);
      }
      setIsGenerating(false);
      return;
    }

    // Mock generation delay for image and video
    setTimeout(() => {
      setIsGenerating(false);
      if (activeTab === 'image') {
        setGeneratedContent({
          type: 'image',
          url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800&h=800',
          variations: [
            'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=200&h=200',
            'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=200&h=200',
            'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=200&h=200'
          ]
        });
      } else if (activeTab === 'copy') {
        setGeneratedContent({
          type: 'copy',
          options: [
            {
              headline: "שחרר את הפוטנציאל שלך. ה-Ultra Boost החדשות.",
              primaryText: "חווה החזר אנרגיה חסר משקל בכל צעד. מעוצב לרצים שדורשים את הטוב ביותר.",
              description: "קנה את הקולקציה החדשה היום וקבל משלוח חינם בהזמנות מעל 100 ₪."
            },
            {
              headline: "רוץ מהר יותר. רוץ רחוק יותר.",
              primaryText: "הכר את השיא האישי החדש שלך. ה-Ultra Boost מציגות את הריפוד הרספונסיבי ביותר שלנו אי פעם.",
              description: "זמין ב-5 צבעים חדשים. מצא את ההתאמה המושלמת שלך."
            }
          ]
        });
      } else {
        setGeneratedContent({
          type: 'video',
          script: [
            { time: "0:00-0:05", visual: "צילום תקריב של נעליים פוגעות בקרקע בהילוך איטי", audio: "כל צעד הוא התחלה חדשה." },
            { time: "0:05-0:15", visual: "רץ ברחובות העיר בשעת זריחה", audio: "כשכולם ישנים, אתה כבר בדרך לשיא הבא שלך." },
            { time: "0:15-0:30", visual: "לוגו החברה וקריאה לפעולה", audio: "Ultra Boost. הנוחות שאתה צריך לביצועים שאתה רוצה. קנה עכשיו." }
          ]
        });
      }
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.creativeLab')}</h1>
          <p className="text-sm text-gray-500 mt-1">צור קריאייטיבים וקופירייטינג למודעות באמצעות בינה מלאכותית.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
              <button 
                onClick={() => { setActiveTab('image'); setGeneratedContent(null); }}
                className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'image' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
              >
                <ImageIcon className="w-4 h-4" />
                יצירת תמונות
              </button>
              <button 
                onClick={() => { setActiveTab('copy'); setGeneratedContent(null); }}
                className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'copy' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
              >
                <Type className="w-4 h-4" />
                קופירייטינג
              </button>
              <button 
                onClick={() => { setActiveTab('video'); setGeneratedContent(null); }}
                className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'video' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
              >
                <Layout className="w-4 h-4" />
                תסריט וידאו
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Selection */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  בחר מוצר מ-WooCommerce (אופציונלי)
                </label>
                <button
                  type="button"
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-gray-400" />
                    {selectedProduct ? selectedProduct.name : 'בחר מוצר...'}
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isProductDropdownOpen && "rotate-180")} />
                </button>
                
                {isProductDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    <button
                      className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setSelectedProduct(null);
                        setIsProductDropdownOpen(false);
                      }}
                    >
                      ללא מוצר ספציפי
                    </button>
                    {mockProducts.map((product) => (
                      <button
                        key={product.id}
                        className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsProductDropdownOpen(false);
                          if (!prompt) {
                            setPrompt(`צור קריאייטיב עבור ${product.name}. תיאור: ${product.shortDesc}`);
                          }
                        }}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-gray-500 truncate">{product.shortDesc}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'image' ? 'תאר את התמונה שברצונך ליצור' : 'מהו המוצר וקהל היעד?'}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={activeTab === 'image' ? "לדוגמה: צילום מקצועי של נעלי ריצה אדומות על רחוב עירוני רטוב בלילה, אורות ניאון משתקפים..." : "לדוגמה: ליין חדש של נעלי ריצה לרצי מרתון, מתמקד בנוחות ועמידות..."}
                  className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-sm"
                />
              </div>

              {activeTab === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">יחס גובה-רוחב</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAspectRatio('1:1')}
                      className={cn("px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50", aspectRatio === '1:1' ? "bg-white ring-2 ring-indigo-500/30" : "")}
                    >
                      1:1 (ריבוע)
                    </button>
                    <button
                      onClick={() => setAspectRatio('9:16')}
                      className={cn("px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50", aspectRatio === '9:16' ? "bg-white ring-2 ring-indigo-500/30" : "")}
                    >
                      9:16 (סטורי)
                    </button>
                    <button
                      onClick={() => setAspectRatio('16:9')}
                      className={cn("px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50", aspectRatio === '16:9' ? "bg-white ring-2 ring-indigo-500/30" : "")}
                    >
                      16:9 (לרוחב)
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={(!prompt && !selectedProduct) || isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    מייצר...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    ייצר {activeTab === 'image' ? 'תמונות' : 'טקסט'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-full min-h-[500px] flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              תוצאות
            </h2>

            {!generatedContent && !isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <Wand2 className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-gray-900 font-medium mb-1">מוכן ליצירה</h3>
                <p className="text-sm text-gray-500 max-w-sm">בחר מוצר מ-WooCommerce או הזן תיאור בצד ימין כדי ליצור קריאייטיבים או קופירייטינג ממירים באמצעות בינה מלאכותית.</p>
              </div>
            )}

            {isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <h3 className="text-gray-900 font-medium mb-1">הבינה המלאכותית עובדת...</h3>
                <p className="text-sm text-gray-500">זה בדרך כלל לוקח כמה שניות.</p>
              </div>
            )}

            {generatedContent?.type === 'image' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="relative group rounded-xl overflow-hidden border border-gray-200">
                  <img src={generatedContent.url} alt="Generated Ad" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button
                      onClick={() => handleDownloadByUrl(generatedContent.url, 'creative-main.jpg')}
                      className="px-4 py-2 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> הורדה
                    </button>
                    <button
                      onClick={handlePublishToMeta}
                      className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" /> פרסם ב-Meta
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {generatedContent.variations.map((url: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleDownloadByUrl(url, `creative-variation-${idx + 1}.jpg`)}
                      className="relative rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-indigo-500 transition-all"
                    >
                      <img src={url} alt={`Variation ${idx + 1}`} className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generatedContent?.type === 'copy' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-bold text-indigo-900 mb-1">קופירייטינג מבוסס AI</h4>
                  <p className="text-xs text-indigo-700">הטקסטים מותאמים למודעות פייסבוק ואינסטגרם.</p>
                </div>
                
                <div className="space-y-4">
                  {generatedContent.options.map((option: any, idx: number) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2" dir="ltr">
                        <button
                          onClick={() => handleCopyText(`${option.headline}\n${option.primaryText}\n${option.description}`)}
                          className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                          title="העתק"
                        >
                          <Type className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handlePublishToMeta}
                          className="p-1.5 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition-colors"
                          title="פרסם"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mb-3 pr-8">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase mb-2 inline-block">אופציה {idx + 1}</span>
                        <h4 className="text-base font-bold text-gray-900 leading-tight">{option.headline}</h4>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700 leading-relaxed">{option.primaryText}</p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {generatedContent?.type === 'video' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-bold text-indigo-900 mb-1">תסריט וידאו מבוסס AI</h4>
                  <p className="text-xs text-indigo-700">התסריט מותאם לסרטון של 30 שניות לרשתות החברתיות.</p>
                </div>
                
                <div className="space-y-4">
                  {generatedContent.script.map((scene: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                      <div className="md:col-span-2">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{scene.time}</span>
                      </div>
                      <div className="md:col-span-5">
                        <span className="text-[10px] text-gray-500 font-bold block mb-1 uppercase">ויזואלי</span>
                        <p className="text-sm text-gray-900 leading-relaxed">{scene.visual}</p>
                      </div>
                      <div className="md:col-span-5">
                        <span className="text-[10px] text-gray-500 font-bold block mb-1 uppercase">אודיו / קריינות</span>
                        <p className="text-sm text-gray-700 italic">"{scene.audio}"</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => handleDownloadTextFile(JSON.stringify(generatedContent.script, null, 2), 'video-script.txt')}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> הורד תסריט
                  </button>
                  <button
                    onClick={handleGenerateStoryboard}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> צור סטוריבורד
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
