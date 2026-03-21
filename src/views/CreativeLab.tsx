"use client";

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Sparkles, Image as ImageIcon, Type, Send, Wand2, Layout, Loader2, Download, ShoppingCart, ChevronDown, Save, Edit3, UploadCloud, Copy, ArrowRight, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useConnections } from '../contexts/ConnectionsContext';
import { type SavedAd } from '../lib/firebase';
import { useCreativeLab, type CreativeProduct } from './creative-lab/useCreativeLab';

export function CreativeLab() {
  const { t, dir, language } = useLanguage();
  const isHebrew = language === 'he';
  const { connections, dataOwnerUid, isWorkspaceReadOnly } = useConnections();
  const {
    prompt, setPrompt,
    isGenerating,
    elapsedMs,
    activeTab, setActiveTab,
    generatedContent, setGeneratedContent,
    selectedProduct, setSelectedProduct,
    isProductDropdownOpen, setIsProductDropdownOpen,
    products,
    productsLoading,
    aspectRatio, setAspectRatio,
    toast,
    savedAds,
    editingCopyIndex, setEditingCopyIndex,
    overlayHeadline, setOverlayHeadline,
    overlayCta, setOverlayCta,
    overlayPosition, setOverlayPosition,
    exportedImageUrl,
    uploadedProductImageDataUrl, setUploadedProductImageDataUrl,
    canvasRef,
    productDropdownRef,
    uploadImageInputRef,
    isWooConnected,
    aiKeys,
    showToast,
    launchCampaign,
    buildBackgroundPrompt,
    handleProductImageUpload,
    handleCopyText,
    handlePublishTo,
    handleSaveAdCopy,
    handleSaveAdImage,
    updateCopyOption,
    drawCanvas,
    exportImageWithOverlay,
    handleDownloadComposite,
    handleSaveAdImageClick,
    handleSuggestOverlayFromAI,
    handleGenerate,
  } = useCreativeLab({ connections, dataOwnerUid, isWorkspaceReadOnly, isHebrew });

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold">
          {toast}
        </div>
      )}
      {isWorkspaceReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-bold">
          {isHebrew
            ? 'מצב צפייה בלבד פעיל. ניתן לצפות במערכת אך לא לשמור או לפרסם נתונים.'
            : 'View-only mode is active. You can view data but cannot save or publish.'}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.creativeLab')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isHebrew
              ? 'צור קריאייטיבים וקופירייטינג למודעות באמצעות בינה מלאכותית.'
              : 'Generate ad creatives and copy with AI.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 bg-gray-100 p-1 rounded-lg mb-6 gap-1">
              <button 
                onClick={() => { setActiveTab('image'); setGeneratedContent(null); }}
                className={cn("flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'image' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
              >
                <ImageIcon className="w-4 h-4" />
                {isHebrew ? 'יצירת תמונות' : 'Image generation'}
              </button>
              <button 
                onClick={() => { setActiveTab('copy'); setGeneratedContent(null); }}
                className={cn("flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'copy' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
              >
                <Type className="w-4 h-4" />
                {isHebrew ? 'קופירייטינג' : 'Copywriting'}
              </button>
              <button 
                onClick={() => { setActiveTab('video'); setGeneratedContent(null); }}
                className={cn("flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'video' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
              >
                <Layout className="w-4 h-4" />
                {isHebrew ? 'תסריט וידאו' : 'Video script'}
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Selection */}
              <div ref={productDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isHebrew ? 'בחר מוצר מ-WooCommerce (אופציונלי)' : 'Select WooCommerce product (optional)'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-gray-700"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingCart className="w-4 h-4 text-gray-400" />
                    <span className="truncate">
                      {selectedProduct ? selectedProduct.name : (isHebrew ? 'בחר מוצר...' : 'Select product...')}
                    </span>
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
                      {isHebrew ? 'ללא מוצר ספציפי' : 'No specific product'}
                    </button>
                    {productsLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> {isHebrew ? 'טוען מוצרים...' : 'Loading products...'}
                      </div>
                    ) : (
                      products.map((product) => (
                        <button
                          key={product.id}
                          className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsProductDropdownOpen(false);
                            if (!prompt) {
                              setPrompt(
                                isHebrew
                                  ? `צור קריאייטיב עבור ${product.name}. תיאור: ${product.shortDesc}`
                                  : `Create creative for ${product.name}. Description: ${product.shortDesc}`
                              );
                            }
                          }}
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-gray-500 truncate">{product.shortDesc}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'image'
                    ? (isHebrew ? 'תאר את התמונה שברצונך ליצור' : 'Describe the image you want to create')
                    : (isHebrew ? 'מהו המוצר וקהל היעד?' : 'What is the product and target audience?')}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    activeTab === 'image'
                      ? (isHebrew
                        ? 'לדוגמה: צילום מקצועי של נעלי ריצה אדומות על רחוב עירוני רטוב בלילה, אורות ניאון משתקפים...'
                        : 'Example: professional photo of red running shoes on a wet city street at night with reflected neon lights...')
                      : (isHebrew
                        ? 'לדוגמה: ליין חדש של נעלי ריצה לרצי מרתון, מתמקד בנוחות ועמידות...'
                        : 'Example: new running shoe line for marathon runners, focused on comfort and durability...')
                  }
                  className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-sm"
                />
              </div>

              {activeTab === 'image' && (
                <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-indigo-900">
                      {isHebrew ? 'העלה תמונת מוצר (מהמחשב / מהמובייל)' : 'Upload product photo (from device)'}
                    </label>
                    {uploadedProductImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => { setUploadedProductImageDataUrl(null); }}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        {isHebrew ? 'הסר' : 'Remove'}
                      </button>
                    )}
                  </div>
                  {uploadedProductImageDataUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-indigo-200 bg-white">
                      <img src={uploadedProductImageDataUrl} alt="uploaded" className="w-full h-32 object-contain" />
                      <div className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {isHebrew ? 'מוכן לשינוי רקע' : 'Ready for background swap'}
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 py-4 cursor-pointer text-indigo-600 hover:text-indigo-700">
                      <UploadCloud className="w-8 h-8 opacity-60" />
                      <span className="text-xs font-medium">{isHebrew ? 'לחץ לבחירת קובץ' : 'Click to select file'}</span>
                      <input
                        ref={uploadImageInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleProductImageUpload}
                      />
                    </label>
                  )}
                  <p className="mt-2 text-[11px] text-indigo-700">
                    {isHebrew
                      ? 'המערכת תחליף את הרקע לפי אופי המוצר מבלי לגעת במוצר עצמו.'
                      : 'The system will replace the background based on product type without touching the product.'}
                  </p>
                </div>
              )}

              {activeTab === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'יחס גובה-רוחב' : 'Aspect ratio'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAspectRatio('1:1')}
                      className={cn("px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50", aspectRatio === '1:1' ? "bg-white ring-2 ring-indigo-500/30" : "")}
                    >
                      {isHebrew ? '1:1 (ריבוע)' : '1:1 (Square)'}
                    </button>
                    <button
                      onClick={() => setAspectRatio('9:16')}
                      className={cn("px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50", aspectRatio === '9:16' ? "bg-white ring-2 ring-indigo-500/30" : "")}
                    >
                      {isHebrew ? '9:16 (סטורי)' : '9:16 (Story)'}
                    </button>
                    <button
                      onClick={() => setAspectRatio('16:9')}
                      className={cn("px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50", aspectRatio === '16:9' ? "bg-white ring-2 ring-indigo-500/30" : "")}
                    >
                      {isHebrew ? '16:9 (לרוחב)' : '16:9 (Landscape)'}
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
                    {isHebrew ? 'מייצר...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    {isHebrew ? 'ייצר' : 'Generate'} {activeTab === 'image' ? (isHebrew ? 'תמונות' : 'images') : (isHebrew ? 'טקסט' : 'text')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 h-full min-h-[420px] sm:min-h-[500px] flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {isHebrew ? 'תוצאות' : 'Results'}
            </h2>

            {!generatedContent && !isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <Wand2 className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-gray-900 font-medium mb-1">{isHebrew ? 'מוכן ליצירה' : 'Ready to create'}</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {isHebrew
                    ? 'בחר מוצר מ-WooCommerce או הזן תיאור בצד ימין כדי ליצור קריאייטיבים או קופירייטינג ממירים באמצעות בינה מלאכותית.'
                    : 'Pick a WooCommerce product or enter a prompt to generate AI creatives and conversion-focused ad copy.'}
                </p>
              </div>
            )}

            {isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                <div>
                  <h3 className="text-gray-900 font-medium mb-1">{isHebrew ? 'הבינה המלאכותית עובדת...' : 'AI is working...'}</h3>
                  <p className="text-sm text-gray-500">
                    {isHebrew ? 'זמן ריצה' : 'Runtime'}: {(elapsedMs / 1000).toFixed(1)} {isHebrew ? 'שניות' : 'seconds'}
                  </p>
                </div>
                <div className="w-full max-w-md mx-auto text-start space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20 font-bold text-gray-600">שלב 1</span>
                    <span className="flex-1 h-1.5 rounded-full bg-emerald-200 overflow-hidden">
                      <span className="block h-full bg-emerald-500" style={{ width: `${Math.min(100, elapsedMs / 300)}%` }} />
                    </span>
                    <span className="text-gray-400">קריאת מנועי AI</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20 font-bold text-gray-600">שלב 2</span>
                    <span className="flex-1 h-1.5 rounded-full bg-indigo-200 overflow-hidden">
                      <span className="block h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, (elapsedMs - 800) / 300))}%` }} />
                    </span>
                    <span className="text-gray-400">עיבוד תוצאה ויצירת הצעה</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20 font-bold text-gray-600">שלב 3</span>
                    <span className="flex-1 h-1.5 rounded-full bg-purple-200 overflow-hidden">
                      <span className="block h-full bg-purple-500" style={{ width: `${Math.min(100, Math.max(0, (elapsedMs - 1600) / 300))}%` }} />
                    </span>
                    <span className="text-gray-400">הכנת התצוגה למסך</span>
                  </div>
                </div>
              </div>
            )}

            {generatedContent?.type === 'image' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                {/* Background-change prompt display */}
                {generatedContent.bgPrompt && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-violet-900">
                        {isHebrew ? 'פרומט שינוי רקע (לשליחה למנוע AI)' : 'Background-change prompt (send to AI engine)'}
                      </span>
                      <button
                        onClick={() => handleCopyText(generatedContent.bgPrompt)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-violet-200 text-xs text-violet-700 hover:bg-violet-50"
                      >
                        <Copy className="w-3 h-3" />
                        {isHebrew ? 'העתק' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[11px] text-violet-800 leading-relaxed whitespace-pre-line line-clamp-4">
                      {generatedContent.bgPrompt}
                    </p>
                  </div>
                )}
                {/* Launch Campaign button */}
                <button
                  onClick={launchCampaign}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  {isHebrew ? 'עבור ליצירת קמפיין מהתמונה הזו' : 'Launch campaign from this image'}
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">הוסף כותרת ו-CTA לתמונה</p>
                    <input
                      type="text"
                      value={overlayHeadline}
                      onChange={(e) => setOverlayHeadline(e.target.value)}
                      placeholder="כותרת על התמונה"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                    />
                    <input
                      type="text"
                      value={overlayCta}
                      onChange={(e) => setOverlayCta(e.target.value)}
                      placeholder="קריאה לפעולה (למשל: קנה עכשיו)"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                    />
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setOverlayPosition(pos)}
                          className={cn("px-3 py-1.5 rounded-lg text-sm font-medium", overlayPosition === pos ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700")}
                        >
                          {pos === 'top' ? 'למעלה' : pos === 'center' ? 'מרכז' : 'למטה'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      <button
                        onClick={() => handleCopyText(`${overlayHeadline}${overlayCta ? '\n' + overlayCta : ''}`)}
                        disabled={!overlayHeadline && !overlayCta}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 border border-gray-200 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                      >
                        <Copy className="w-3 h-3" />
                        {isHebrew ? 'העתק טקסט' : 'Copy text'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={exportImageWithOverlay}
                        className="w-full sm:w-auto px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                      >
                        ייצא תמונה עם טקסט
                      </button>
                      <button
                        onClick={handleSaveAdImageClick}
                        disabled={isWorkspaceReadOnly}
                        className="w-full sm:w-auto px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Save className="w-4 h-4" /> שמור מודעה
                      </button>
                      <button
                        onClick={() => handlePublishTo('meta')}
                        disabled={isWorkspaceReadOnly}
                        className="w-full sm:w-auto px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" /> פרסם Meta
                      </button>
                      <button
                        onClick={() => handlePublishTo('google')}
                        disabled={isWorkspaceReadOnly}
                        className="w-full sm:w-auto px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" /> פרסם Google
                      </button>
                      <button
                        onClick={() => handlePublishTo('tiktok')}
                        disabled={isWorkspaceReadOnly}
                        className="w-full sm:w-auto px-3 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" /> פרסם TikTok
                      </button>
                      <button
                        onClick={handleSuggestOverlayFromAI}
                        className="w-full sm:w-auto px-3 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-50 flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-4 h-4" /> הצעת כותרת ו‑CTA מה‑AI
                      </button>
                    </div>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <canvas ref={canvasRef} className="w-full h-auto max-h-[400px] object-contain" width={800} height={800} />
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  {/* Persistent action bar above image */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-bold text-gray-700 flex-1">
                      {isHebrew ? 'תמונה ראשית' : 'Main image'}
                    </span>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = generatedContent.url;
                        a.download = 'creative-main.jpg';
                        a.click();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isHebrew ? 'הורד' : 'Download'}
                    </button>
                  </div>
                  <div className="relative group">
                  <img src={generatedContent.url} alt="Generated Ad" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 flex-wrap">
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = generatedContent.url;
                        a.download = 'creative-main.jpg';
                        a.click();
                      }}
                      className="px-4 py-2 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> הורדה
                    </button>
                    <button
                      onClick={() => handlePublishTo('meta')}
                      disabled={isWorkspaceReadOnly}
                      className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" /> פרסם ב-Meta
                    </button>
                    <button
                      onClick={() => handlePublishTo('google')}
                      disabled={isWorkspaceReadOnly}
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" /> פרסם ב-Google
                    </button>
                    <button
                      onClick={() => handlePublishTo('tiktok')}
                      disabled={isWorkspaceReadOnly}
                      className="px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" /> פרסם ב-TikTok
                    </button>
                  </div>
                  </div>{/* close relative group */}
                </div>{/* close outer rounded-xl */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {generatedContent.variations.map((url: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `creative-variation-${idx + 1}.jpg`;
                        a.click();
                      }}
                      className="relative rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-indigo-500 transition-all"
                    >
                      <img src={url} alt={`Variation ${idx + 1}`} className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
                {exportedImageUrl && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleDownloadComposite}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                    >
                      <Download className="w-4 h-4" /> הורד את גרסת ה‑AI עם הטקסט
                    </button>
                  </div>
                )}
              </div>
            )}

            {generatedContent?.type === 'copy' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                  <h4 className="text-sm font-bold text-indigo-900 mb-1">קופירייטינג מבוסס AI - ניתן לעריכה</h4>
                  <p className="text-xs text-indigo-700">ערוך את השדות, שמור מודעה או שלח לפרסום ב-Google, Meta או TikTok.</p>
                  <button
                    onClick={launchCampaign}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {isHebrew ? 'עבור ליצירת קמפיין עם הטקסט הזה' : 'Launch campaign with this copy'}
                  </button>
                </div>
                
                <div className="space-y-4">
                  {generatedContent.options.map((option, idx: number) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">אופציה {idx + 1}</span>
                      <div className="flex flex-wrap gap-2" dir="ltr">
                          <button
                            onClick={() => setEditingCopyIndex(editingCopyIndex === idx ? null : idx)}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            title="ערוך"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyText(`${option.headline}\n${option.primaryText}\n${option.description}`)}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            title="העתק"
                          >
                            <Type className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSaveAdCopy(option)}
                            disabled={isWorkspaceReadOnly}
                            className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors disabled:opacity-40"
                            title="שמור מודעה"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePublishTo('meta')}
                            disabled={isWorkspaceReadOnly}
                            className="p-1.5 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 disabled:opacity-40"
                            title="פרסם Meta"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePublishTo('google')}
                            disabled={isWorkspaceReadOnly}
                            className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 disabled:opacity-40"
                            title="פרסם Google"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePublishTo('tiktok')}
                            disabled={isWorkspaceReadOnly}
                            className="p-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-40"
                            title="פרסם TikTok"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {editingCopyIndex === idx ? (
                        <div className="space-y-2">
                          <input
                            value={option.headline}
                            onChange={(e) => updateCopyOption(idx, 'headline', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold"
                            placeholder="כותרת"
                          />
                          <textarea
                            value={option.primaryText}
                            onChange={(e) => updateCopyOption(idx, 'primaryText', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                            placeholder="טקסט ראשי"
                            rows={3}
                          />
                          <input
                            value={option.description}
                            onChange={(e) => updateCopyOption(idx, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500"
                            placeholder="תיאור / CTA"
                          />
                        </div>
                      ) : (
                        <>
                          <h4 className="text-base font-bold text-gray-900 leading-tight mb-2">{option.headline}</h4>
                          <p className="text-sm text-gray-700 leading-relaxed">{option.primaryText}</p>
                          <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                        </>
                      )}
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
                  {generatedContent.script.map((scene, idx: number) => (
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
                
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button className="w-full sm:flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> הורד תסריט
                  </button>
                  <button className="w-full sm:flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2">
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
