'use client';

import React, { useState } from 'react';
import { Product } from '@/types/product';
import { generateBarcodeSvg } from '@/lib/barcode-generator';
import { Printer, X, Settings2, Eye, Copy, RefreshCw, Check, Send } from 'lucide-react';
import { useBarcodePrinterStore } from '@/store/useBarcodePrinterStore';
import { generateRawCommands, BarcodeFormatType, BarcodeLabelConfig, BarcodePrintPayloadItem } from '@/lib/barcode-printer-languages';

export interface BarcodePrintItem {
  product: Product;
  barcode: string;
  barcodeType: 'internal' | 'manufacturer' | 'INTERNAL' | 'MANUFACTURER';
  barcodeFormat: BarcodeFormatType | 'CODE128' | 'EAN13' | 'UPCA';
  copies: number;
}

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BarcodePrintItem[];
  currencySymbol?: string;
  companyName?: string;
}

type LabelSize = '50x25' | '38x25' | '50x38' | 'a4' | 'thermal58';

const LABEL_SIZES: { id: LabelSize; name: string; desc: string; widthMm: number; heightMm: number }[] = [
  { id: '50x25', name: '50 × 25 mm', desc: 'Standard 2" × 1" Label', widthMm: 50, heightMm: 25 },
  { id: '38x25', name: '38 × 25 mm', desc: 'Compact 1.5" × 1" Label', widthMm: 38, heightMm: 25 },
  { id: '50x38', name: '50 × 38 mm', desc: 'Large 2" × 1.5" Label', widthMm: 50, heightMm: 38 },
  { id: 'thermal58', name: '58 mm Thermal', desc: 'Continuous Roll Printer', widthMm: 54, heightMm: 30 },
  { id: 'a4', name: 'A4 Sheet (3 × 8)', desc: '24 Labels per Page', widthMm: 63.5, heightMm: 33.9 },
];

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  items: initialItems,
  currencySymbol = '₹',
  companyName: propCompanyName,
}) => {
  const [items, setItems] = useState<BarcodePrintItem[]>(initialItems);
  const [labelSize, setLabelSize] = useState<LabelSize>('50x25');
  const [companyName, setCompanyName] = useState<string>(propCompanyName || '');
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showProductCode, setShowProductCode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [globalCopies, setGlobalCopies] = useState<number>(1);

  const printerSettings = useBarcodePrinterStore();
  const [directPrinting, setDirectPrinting] = useState(false);
  const [directPrintMsg, setDirectPrintMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Sync when initialItems changes
  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Sync default label preferences from printer store if available
  React.useEffect(() => {
    if (printerSettings.companyName && !propCompanyName) {
      setCompanyName(printerSettings.companyName);
    }
  }, [printerSettings.companyName, propCompanyName]);

  // Load company name if not provided
  React.useEffect(() => {
    if (propCompanyName) {
      setCompanyName(propCompanyName);
      return;
    }
    if (printerSettings.companyName) {
      setCompanyName(printerSettings.companyName);
      return;
    }
    fetch('/api/companies/active')
      .then((res) => res.json())
      .then((data) => {
        if (data?.activeCompany?.name) {
          setCompanyName(data.activeCompany.name);
        }
      })
      .catch(() => {});
  }, [propCompanyName, printerSettings.companyName, isOpen]);

  if (!isOpen || items.length === 0) return null;

  const updateItemCopies = (index: number, newCopies: number) => {
    const validated = Math.max(1, Math.min(500, newCopies || 1));
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], copies: validated };
      return copy;
    });
  };

  const applyGlobalCopies = (val: number) => {
    setGlobalCopies(val);
    setItems((prev) => prev.map((item) => ({ ...item, copies: Math.max(1, val) })));
  };

  const totalLabels = items.reduce((acc, it) => acc + (it.copies || 1), 0);
  const currentSizeConfig = LABEL_SIZES.find((s) => s.id === labelSize) || LABEL_SIZES[0];

  // Flatten items for printing according to copies
  const flattenedLabels: {
    product: Product;
    barcode: string;
    barcodeFormat: BarcodeFormatType;
    barcodeType: string;
  }[] = [];
  items.forEach((item) => {
    const c = Math.max(1, item.copies || 1);
    for (let i = 0; i < c; i++) {
      flattenedLabels.push({
        product: item.product,
        barcode: item.barcode,
        barcodeFormat: (item.barcodeFormat || 'CODE128') as BarcodeFormatType,
        barcodeType: item.barcodeType,
      });
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDirectPrintToBarcodePrinter = async () => {
    if (!printerSettings.networkIp) {
      alert('Network printer IP is not set. Please configure it in Settings > Printer Settings > Barcode Label Printer.');
      return;
    }
    setDirectPrinting(true);
    setDirectPrintMsg(null);
    try {
      const config: BarcodeLabelConfig = {
        widthMm: currentSizeConfig.widthMm,
        heightMm: currentSizeConfig.heightMm,
        gapMm: printerSettings.labelGapMm,
        marginTopMm: printerSettings.marginTopMm,
        marginLeftMm: printerSettings.marginLeftMm,
        density: printerSettings.density,
        speed: printerSettings.speed,
        dpi: printerSettings.dpi,
        orientation: printerSettings.orientation,
        format: (flattenedLabels[0]?.barcodeFormat || printerSettings.defaultBarcodeFormat) as BarcodeFormatType,
        showCompanyName,
        companyName: companyName || printerSettings.companyName,
        showProductName,
        showProductCode,
        showPrice,
        showBarcodeText,
        currencySymbol,
      };

      const payloadItems: BarcodePrintPayloadItem[] = flattenedLabels.map((lbl) => ({
        name: lbl.product.name,
        code: lbl.product.sku || (lbl.product as any).code || lbl.barcode,
        barcode: lbl.barcode,
        price: lbl.product.price,
        copies: 1,
      }));

      const allCommands = generateRawCommands(printerSettings.printerLanguage, config, payloadItems);

      const res = await fetch('/api/printer/barcode-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-raw',
          ip: printerSettings.networkIp,
          port: printerSettings.networkPort || 9100,
          commands: allCommands,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDirectPrintMsg({ success: true, text: `Sent ${flattenedLabels.length} labels directly to printer!` });
        setTimeout(() => setDirectPrintMsg(null), 4000);
      } else {
        setDirectPrintMsg({ success: false, text: data.error || 'Direct print failed.' });
      }
    } catch (e: any) {
      setDirectPrintMsg({ success: false, text: e.message || 'Direct print failed.' });
    } finally {
      setDirectPrinting(false);
    }
  };

  return (
    <>
      {/* Hidden printable area formatted strictly for print styles */}
      <div id="barcode-print-section" className="hidden print:block">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #barcode-print-section, #barcode-print-section * {
              visibility: visible !important;
            }
            #barcode-print-section {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }
            @page {
              size: ${labelSize === 'a4' ? 'A4 portrait' : `${currentSizeConfig.widthMm}mm ${currentSizeConfig.heightMm}mm`};
              margin: ${labelSize === 'a4' ? '8mm' : '1mm'};
            }
            .barcode-label-print-unit {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              ${labelSize === 'a4' 
                ? `width: ${currentSizeConfig.widthMm}mm; height: ${currentSizeConfig.heightMm}mm; display: inline-flex; float: left; margin: 1.5mm;` 
                : `width: 100%; height: 98vh; display: flex; page-break-after: always; break-after: page;`
              }
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 2mm 3mm;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #000;
            }
            .barcode-label-print-unit:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
          }
        `}} />

        <div className={labelSize === 'a4' ? 'w-full block clearfix' : 'w-full'}>
          {flattenedLabels.map((lbl, idx) => {
            const svgContent = generateBarcodeSvg({
              value: lbl.barcode,
              format: lbl.barcodeFormat,
              width: labelSize === '38x25' ? 1.4 : 1.8,
              height: labelSize === '50x38' ? 44 : labelSize === '38x25' ? 30 : 36,
              displayValue: showBarcodeText,
              fontSize: 10,
              lineColor: '#000000',
              textColor: '#000000',
              quietZone: 6,
            });

            return (
              <div key={idx} className="barcode-label-print-unit">
                {showCompanyName && (companyName || (lbl.product as any).companyName) && (
                  <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.8mm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {companyName || (lbl.product as any).companyName}
                  </div>
                )}

                {showProductName && (
                  <div style={{ fontSize: '9pt', fontWeight: 700, lineHeight: 1.1, marginBottom: '1mm', maxHeight: '2.4em', overflow: 'hidden' }}>
                    {lbl.product.name}
                  </div>
                )}

                {showProductCode && (lbl.product.sku || (lbl.product as any).code || lbl.barcode) && (
                  <div style={{ fontSize: '7.5pt', fontWeight: 600, fontFamily: 'monospace', color: '#111', marginBottom: '1mm' }}>
                    Code: {lbl.product.sku || (lbl.product as any).code || lbl.barcode}
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: '96%' }}
                     dangerouslySetInnerHTML={{ __html: svgContent }} />

                {showPrice && (
                  <div style={{ fontSize: '9pt', fontWeight: 800, marginTop: '1.2mm' }}>
                    {currencySymbol}{lbl.product.price.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Screen Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
        <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Print Barcode Labels</h2>
                <p className="text-xs text-muted-foreground">
                  Printing {totalLabels} {totalLabels === 1 ? 'label' : 'labels'} for {items.length} {items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content - 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
            
            {/* Left Column: Settings & Items List */}
            <div className="md:col-span-5 p-5 border-r border-border overflow-y-auto space-y-5 bg-card/60 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              
              {/* Label Size Selection */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Label Paper Size
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {LABEL_SIZES.map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setLabelSize(size.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all ${
                        labelSize === size.id
                          ? 'border-primary bg-primary/10 font-semibold text-primary shadow-sm'
                          : 'border-border/70 hover:border-border hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-xs">{size.name}</div>
                        <div className="text-[11px] text-muted-foreground">{size.desc}</div>
                      </div>
                      {labelSize === size.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Elements to Display */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Display On Label
                </label>
                <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border/60">
                  <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCompanyName}
                      onChange={(e) => setShowCompanyName(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Company Name
                  </label>
                  <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showProductName}
                      onChange={(e) => setShowProductName(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Product Name
                  </label>
                  <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showProductCode}
                      onChange={(e) => setShowProductCode(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Code
                  </label>
                  <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Product Price ({currencySymbol})
                  </label>
                  <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBarcodeText}
                      onChange={(e) => setShowBarcodeText(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Barcode Digits / Number
                  </label>
                </div>
              </div>

              {/* Global Copies / Quick Copies */}
              {items.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Set Copies for All
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => applyGlobalCopies(num)}
                          className="px-2 py-0.5 text-xs font-semibold rounded bg-muted hover:bg-muted/80 border border-border"
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={globalCopies}
                    onChange={(e) => applyGlobalCopies(parseInt(e.target.value) || 1)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Selected Products Copies List */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Items to Print ({items.length})
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {items.map((it, idx) => (
                    <div
                      key={it.product.id + '-' + it.barcode}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold truncate">{it.product.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-mono">
                          <span>{it.barcode}</span>
                          <span className="text-[10px] px-1 py-0.2 rounded bg-muted uppercase">
                            {String(it.barcodeType || '').toLowerCase() === 'internal' ? 'Internal' : 'Mfg'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-muted-foreground">Qty:</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={it.copies}
                          onChange={(e) => updateItemCopies(idx, parseInt(e.target.value) || 1)}
                          className="w-14 text-center font-bold text-xs h-7 px-1 rounded border border-input bg-background"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Live Label Preview */}
            <div className="md:col-span-7 p-6 flex flex-col bg-muted/10 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Eye className="w-4 h-4 text-primary" />
                  Live Preview ({currentSizeConfig.name})
                </div>
                <div className="text-xs text-muted-foreground">
                  Showing first {Math.min(6, flattenedLabels.length)} of {totalLabels}
                </div>
              </div>

              {/* Preview Container */}
              <div className="flex-1 flex flex-wrap items-center justify-center gap-4 p-4 rounded-xl border border-dashed border-border bg-background/50 overflow-y-auto min-h-[300px] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {flattenedLabels.slice(0, 6).map((lbl, idx) => {
                  const svg = generateBarcodeSvg({
                    value: lbl.barcode,
                    format: lbl.barcodeFormat,
                    width: labelSize === '38x25' ? 1.4 : 1.8,
                    height: labelSize === '50x38' ? 44 : labelSize === '38x25' ? 30 : 36,
                    displayValue: showBarcodeText,
                    fontSize: 10,
                    lineColor: '#111827',
                    textColor: '#111827',
                    quietZone: 6,
                  });

                  return (
                    <div
                      key={idx}
                      className="bg-white text-gray-900 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center p-3 text-center transition-transform hover:scale-105"
                      style={{
                        width: labelSize === '38x25' ? '170px' : labelSize === '50x38' ? '210px' : '200px',
                        minHeight: labelSize === '50x38' ? '150px' : '120px',
                      }}
                    >
                      {showCompanyName && (companyName || (lbl.product as any).companyName) && (
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700 truncate w-full mb-0.5">
                          {companyName || (lbl.product as any).companyName}
                        </div>
                      )}

                      {showProductName && (
                        <div className="text-xs font-bold text-gray-900 truncate w-full mb-0.5">
                          {lbl.product.name}
                        </div>
                      )}

                      {showProductCode && (lbl.product.sku || (lbl.product as any).code || lbl.barcode) && (
                        <div className="text-[10px] font-mono font-semibold text-gray-600 truncate w-full mb-1">
                          Code: {lbl.product.sku || (lbl.product as any).code || lbl.barcode}
                        </div>
                      )}
                      
                      <div
                        className="w-full flex items-center justify-center my-0.5 overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />

                      {showPrice && (
                        <div className="text-xs font-black text-gray-900 mt-1">
                          {currencySymbol}{lbl.product.price.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 text-[11px] text-muted-foreground text-center">
                Labels are automatically scaled and rendered as vector SVGs for razor-sharp thermal or laser printing.
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border bg-muted/40 gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Ready to print <span className="font-bold text-foreground">{totalLabels}</span> {totalLabels === 1 ? 'label' : 'labels'} on {currentSizeConfig.name}</span>
              {directPrintMsg && (
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${directPrintMsg.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {directPrintMsg.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-input bg-background hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              {printerSettings.connectionType === 'network' && (
                <button
                  type="button"
                  disabled={directPrinting}
                  onClick={handleDirectPrintToBarcodePrinter}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 shadow-sm transition active:scale-95 disabled:opacity-50"
                  title={`Send directly via ${printerSettings.printerLanguage.toUpperCase()} to ${printerSettings.networkIp}`}
                >
                  <Send className="w-3.5 h-3.5 text-pink-400" />
                  <span>{directPrinting ? 'Sending...' : 'Direct Thermal Print'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Print Labels ({totalLabels})
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
