'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Product } from "@/lib/mock-data"
import { 
  Package, Plus, Edit2, Trash2, RefreshCw, Trash, Layers, Check, 
  Barcode as BarcodeIcon, Printer, QrCode, AlertCircle, PlusCircle, CheckCircle2,
  X, Search, Tag
} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { createProduct, updateProduct, deleteProduct as deleteProductDb, getProducts, getCategories } from "@/lib/actions/db"
import { getRawMaterials } from "@/lib/actions/inventory"
import { getAddonGroups } from "@/lib/actions/addons"
import { getNextInternalBarcodeAction, checkBarcodeUniqueAction } from "@/lib/actions/barcodes"
import { RawMaterial, RecipeItem, ProductUnit, BarcodeFormat, ProductBarcode } from "@/types/product"
import { AddonGroup } from "@/types/addons"
import { 
  generateBarcodeSvg, 
  validateEAN13, 
  validateUPCA, 
  validateCode128, 
  detectBarcodeFormat 
} from "@/lib/barcode-generator"
import { BarcodePrintModal, BarcodePrintItem } from "@/components/products/BarcodePrintModal"

interface MfgBarcodeEntry {
  barcode: string
  format: BarcodeFormat
}

export default function ProductsPage() {
  const { products, addProduct, editProduct, deleteProduct, categories, setProducts, setCategories } = useTerminalStore()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([])
  const [currentRecipe, setCurrentRecipe] = useState<RecipeItem[]>([])
  const [availableAddonGroups, setAvailableAddonGroups] = useState<AddonGroup[]>([])
  const [selectedAddonGroupIds, setSelectedAddonGroupIds] = useState<string[]>([])

  // Barcode Management State
  const [barcodeTab, setBarcodeTab] = useState<'INTERNAL' | 'MANUFACTURER'>('INTERNAL')
  const [internalBarcode, setInternalBarcode] = useState<string>('')
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false)
  const [internalUniqueStatus, setInternalUniqueStatus] = useState<{ checked: boolean; isUnique: boolean; conflictName?: string }>({ checked: false, isUnique: true })

  // Manufacturer Barcodes State
  const [mfgBarcodes, setMfgBarcodes] = useState<MfgBarcodeEntry[]>([])
  const [newMfgBarcode, setNewMfgBarcode] = useState<string>('')
  const [newMfgFormat, setNewMfgFormat] = useState<BarcodeFormat | 'AUTO'>('AUTO')
  const [mfgValidationError, setMfgValidationError] = useState<string | null>(null)
  const [isCheckingMfgBarcode, setIsCheckingMfgBarcode] = useState(false)

  // Barcode Printing State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printItems, setPrintItems] = useState<BarcodePrintItem[]>([])

  // Table search & filter
  const [tableSearch, setTableSearch] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dbProducts, dbCategories, dbMaterials, dbAddonGroups] = await Promise.all([
        getProducts(),
        getCategories(),
        getRawMaterials().catch(() => []),
        getAddonGroups().catch(() => []),
      ])
      setProducts(dbProducts)
      setCategories(dbCategories)
      setAvailableMaterials(dbMaterials)
      setAvailableAddonGroups(dbAddonGroups || [])
    } catch (e) {
      console.error('Failed to load products from DB:', e)
    } finally {
      setLoading(false)
    }
  }

  // Always fetch fresh from DB on page load
  useEffect(() => {
    fetchData()
  }, [])

  const maxPlates = useMemo(() => {
    if (currentRecipe.length === 0) return null;
    let min = Infinity;
    
    const CONVERSION_RATES: Record<string, number> = { 
      'kg->g': 1000, 'g->kg': 0.001, 'liter->ml': 1000, 'ml->liter': 0.001,
      'tsp->ml': 5, 'ml->tsp': 0.2, 'tbsp->ml': 15, 'ml->tbsp': 1/15, 'cup->ml': 240, 'ml->cup': 1/240,
      'tbsp->tsp': 3, 'tsp->tbsp': 1/3, 'cup->tbsp': 16, 'tbsp->cup': 1/16, 'cup->tsp': 48, 'tsp->cup': 1/48 
    };

    for (const item of currentRecipe) {
      if (!item.rawMaterialId || !item.quantity) return 0;
      const material = availableMaterials.find(m => m.id === item.rawMaterialId);
      if (!material) continue;
      
      let reqQty = item.quantity;
      if (item.unit !== material.unit) {
        const rate = CONVERSION_RATES[`${item.unit}->${material.unit}`];
        if (rate) reqQty = reqQty * rate;
      }
      
      const possible = material.currentStock / reqQty;
      if (possible < min) min = possible;
    }
    
    return min === Infinity ? 0 : Math.floor(min);
  }, [currentRecipe, availableMaterials]);

  const handleOpenForm = async (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setCurrentRecipe(product.rawMaterials || [])
      setSelectedAddonGroupIds(product.addonGroupIds || [])

      // Load existing barcodes
      const existingInternal = (product.barcodes || []).find(b => b.barcodeType === 'INTERNAL');
      const existingMfgs = (product.barcodes || []).filter(b => b.barcodeType === 'MANUFACTURER');

      if (existingInternal) {
        setInternalBarcode(existingInternal.barcode);
      } else if (product.barcode && !existingMfgs.some(m => m.barcode === product.barcode)) {
        // Fallback to legacy single barcode
        setInternalBarcode(product.barcode);
      } else {
        setInternalBarcode('');
      }

      setMfgBarcodes(existingMfgs.map(m => ({ barcode: m.barcode, format: m.barcodeFormat })));
      setBarcodeTab(existingInternal || product.barcode ? 'INTERNAL' : existingMfgs.length > 0 ? 'MANUFACTURER' : 'INTERNAL');
      setInternalUniqueStatus({ checked: true, isUnique: true });
    } else {
      setEditingProduct(null)
      setCurrentRecipe([])
      setSelectedAddonGroupIds([])
      setMfgBarcodes([])
      setBarcodeTab('INTERNAL')
      setNewMfgBarcode('')
      setMfgValidationError(null)
      
      // Auto-fetch the next sequential internal barcode starting from 100001
      setIsGeneratingBarcode(true)
      try {
        const nextCode = await getNextInternalBarcodeAction();
        setInternalBarcode(nextCode);
        setInternalUniqueStatus({ checked: true, isUnique: true });
      } catch (err) {
        console.error('Failed to get next barcode:', err);
        setInternalBarcode('100001');
      } finally {
        setIsGeneratingBarcode(false);
      }
    }
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
    setSelectedAddonGroupIds([])
    setInternalBarcode('')
    setMfgBarcodes([])
    setNewMfgBarcode('')
    setMfgValidationError(null)
  }

  // Generate Internal Barcode button handler
  const handleManualGenerateBarcode = async () => {
    setIsGeneratingBarcode(true)
    try {
      const nextCode = await getNextInternalBarcodeAction();
      setInternalBarcode(nextCode);
      setInternalUniqueStatus({ checked: true, isUnique: true });
    } catch (err) {
      console.error('Failed to generate barcode:', err);
    } finally {
      setIsGeneratingBarcode(false);
    }
  }

  // Validate and Add Manufacturer Barcode
  const handleAddMfgBarcode = async () => {
    const raw = (newMfgBarcode || '').trim();
    if (!raw) {
      setMfgValidationError('Please enter or scan a barcode number.');
      return;
    }

    // Check if already in current list
    if (mfgBarcodes.some(m => m.barcode.toLowerCase() === raw.toLowerCase()) || internalBarcode === raw) {
      setMfgValidationError('This barcode is already added to this product.');
      return;
    }

    // Detect format if AUTO
    const detected = newMfgFormat === 'AUTO' ? detectBarcodeFormat(raw) : newMfgFormat;

    // Validate format
    if (detected === 'EAN13' && !validateEAN13(raw)) {
      setMfgValidationError('Invalid EAN-13 barcode: must be 13 digits with valid check digit.');
      return;
    }
    if (detected === 'UPCA' && !validateUPCA(raw)) {
      setMfgValidationError('Invalid UPC-A barcode: must be 12 digits with valid check digit.');
      return;
    }
    if (detected === 'CODE128' && !validateCode128(raw)) {
      setMfgValidationError('Invalid Code 128 barcode format: unsupported characters.');
      return;
    }

    // Check database uniqueness
    setIsCheckingMfgBarcode(true);
    setMfgValidationError(null);
    try {
      const res = await checkBarcodeUniqueAction(raw, editingProduct?.id);
      if (!res.isUnique) {
        setMfgValidationError(`Barcode "${raw}" is already assigned to "${res.conflictProduct?.name || 'another product'}".`);
        setIsCheckingMfgBarcode(false);
        return;
      }

      // Add to list
      setMfgBarcodes(prev => [...prev, { barcode: raw, format: detected }]);
      setNewMfgBarcode('');
      setNewMfgFormat('AUTO');
      setMfgValidationError(null);
    } catch (err) {
      console.error('Error checking barcode uniqueness:', err);
      // Fallback add
      setMfgBarcodes(prev => [...prev, { barcode: raw, format: detected }]);
      setNewMfgBarcode('');
    } finally {
      setIsCheckingMfgBarcode(false);
    }
  }

  const handleRemoveMfgBarcode = (index: number) => {
    setMfgBarcodes(prev => prev.filter((_, idx) => idx !== index));
  }

  // Single Product Print Handler
  const handlePrintSingleProduct = (product: Product, specificBarcode?: string, specificFormat?: BarcodeFormat) => {
    const code = specificBarcode || product.barcode || (product.barcodes && product.barcodes[0]?.barcode) || '';
    if (!code) {
      alert('This product does not have any barcode assigned.');
      return;
    }
    const fmt = specificFormat || (product.barcodes?.find(b => b.barcode === code)?.barcodeFormat as BarcodeFormat) || 'CODE128';
    const bType = product.barcodes?.find(b => b.barcode === code)?.barcodeType || 'INTERNAL';

    setPrintItems([{
      product,
      barcode: code,
      barcodeType: bType as 'INTERNAL' | 'MANUFACTURER',
      barcodeFormat: fmt,
      copies: 1,
    }]);
    setIsPrintModalOpen(true);
  }

  // Bulk Print Handler for All or Filtered Products
  const handleOpenBulkPrint = () => {
    const itemsToPrint: BarcodePrintItem[] = [];

    const sourceProducts = tableFilteredProducts;
    sourceProducts.forEach(p => {
      const primaryBc = (p.barcodes || []).find(b => b.barcodeType === 'INTERNAL') || (p.barcodes && p.barcodes[0]);
      const barcodeStr = primaryBc?.barcode || p.barcode;
      if (barcodeStr) {
        itemsToPrint.push({
          product: p,
          barcode: barcodeStr,
          barcodeType: (primaryBc?.barcodeType || 'INTERNAL') as 'INTERNAL' | 'MANUFACTURER',
          barcodeFormat: (primaryBc?.barcodeFormat || 'CODE128') as BarcodeFormat,
          copies: Math.max(1, Math.min(10, Math.floor(p.stock || 1))), // default copies to stock or 1
        });
      }
    });

    if (itemsToPrint.length === 0) {
      alert('No products with barcodes found to print.');
      return;
    }

    setPrintItems(itemsToPrint);
    setIsPrintModalOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUploading(true)
    const formData = new FormData(e.currentTarget)
    let imageUrl = editingProduct?.image || ""
    const file = formData.get("imageFile") as File
    if (file && file.size > 0) {
      const uploadData = new FormData()
      uploadData.append("file", file)
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        })
        const data = await res.json()
        if (data.url) {
          imageUrl = data.url
        }
      } catch (err) {
        console.error("Failed to upload image", err)
      }
    }

    // Build consolidated barcodes array
    const compiledBarcodes: ProductBarcode[] = [];
    const cleanInternal = internalBarcode.trim();
    if (cleanInternal) {
      compiledBarcodes.push({
        id: 'bc_' + Date.now() + '_int',
        companyId: editingProduct?.companyId || '',
        productId: editingProduct?.id || '',
        barcode: cleanInternal,
        barcodeType: 'INTERNAL',
        barcodeFormat: 'CODE128',
        isPrimary: true,
      });
    }

    mfgBarcodes.forEach((m, idx) => {
      compiledBarcodes.push({
        id: 'bc_' + Date.now() + '_mfg_' + idx,
        companyId: editingProduct?.companyId || '',
        productId: editingProduct?.id || '',
        barcode: m.barcode.trim(),
        barcodeType: 'MANUFACTURER',
        barcodeFormat: m.format,
        isPrimary: compiledBarcodes.length === 0, // primary if no internal barcode
      });
    });

    // Primary barcode value for backward compatibility
    const primaryBarcodeValue = cleanInternal || (mfgBarcodes[0] ? mfgBarcodes[0].barcode : '');

    if (editingProduct) {
      const updates: Partial<Product> = {
        name: formData.get("name") as string,
        sku: formData.get("sku") as string,
        barcode: primaryBarcodeValue,
        barcodes: compiledBarcodes,
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        unit: formData.get("unit") as string as ProductUnit,
        quantityStep: Number(formData.get("quantityStep")),
        categoryId: formData.get("categoryId") as string,
        tax: Number(formData.get("tax")),
        discount: Number(formData.get("discount")),
        image: imageUrl,
        rawMaterials: currentRecipe,
        addonGroupIds: selectedAddonGroupIds,
      };
      await updateProduct(editingProduct.id, updates);
      editProduct(editingProduct.id, updates);
    } else {
      const newProductPayload: Omit<Product, 'id'> = {
        name: formData.get("name") as string,
        sku: formData.get("sku") as string,
        barcode: primaryBarcodeValue || String(Math.floor(100001 + Math.random() * 900000)),
        barcodes: compiledBarcodes,
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        unit: formData.get("unit") as string as ProductUnit,
        quantityStep: Number(formData.get("quantityStep")),
        categoryId: formData.get("categoryId") as string,
        tax: Number(formData.get("tax")),
        discount: Number(formData.get("discount")),
        image: imageUrl,
        rawMaterials: currentRecipe,
        addonGroupIds: selectedAddonGroupIds,
      };
      const created = await createProduct(newProductPayload);
      addProduct(created);
    }
    
    handleCloseForm()
    setIsUploading(false)
  }

  // Filtered products for table
  const tableFilteredProducts = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const skuMatch = (p.sku || '').toLowerCase().includes(q);
      const primaryBcMatch = (p.barcode || '').toLowerCase().includes(q);
      const extraBcMatch = (p.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(q));
      return nameMatch || skuMatch || primaryBcMatch || extraBcMatch;
    });
  }, [products, tableSearch]);

  return (
    <div className="space-y-6">
      {/* Top Header with Dynamic Theme Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Package className="h-6 w-6 text-pink-300" />
              Products & Barcodes
            </h1>
            <p className="text-xs text-pink-100/70 mt-1">
              Manage menu items, Code 128 / EAN-13 barcodes, label printing, add-ons, pricing & stock.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-pink-400/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/60 hover:text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Refresh Products & Barcodes"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleOpenBulkPrint}
              className="flex items-center gap-1.5 rounded-xl border border-pink-400/40 bg-pink-950/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-pink-900/60 hover:text-white transition shadow-sm cursor-pointer"
              title="Print Barcode Labels for Inventory"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Barcodes</span>
            </button>
            <button 
              onClick={() => handleOpenForm()}
              style={{ color: '#0f172a' }}
              className="flex items-center gap-2 rounded-xl bg-white text-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-pink-100 active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200 no-scrollbar">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-theme-accent" />
                <span>{editingProduct ? "Edit Product" : "New Product"}</span>
              </h2>
              <button 
                type="button" 
                onClick={handleCloseForm}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6 w-full">
              {/* Left Column: Product Details & Barcode Management (65%) */}
              <div className="w-full md:w-[65%] space-y-4">
                
                {/* Basic fields grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Name</label>
                    <input required defaultValue={editingProduct?.name} name="name" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">SKU</label>
                    <input required defaultValue={editingProduct?.sku} name="sku" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Price (₹)</label>
                    <input required defaultValue={editingProduct?.price} type="number" step="0.01" name="price" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Stock</label>
                    <input required defaultValue={editingProduct?.stock} type="number" name="stock" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Unit</label>
                    <input required defaultValue={editingProduct?.unit} name="unit" placeholder="e.g. piece, kg" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Quantity Step</label>
                    <input required defaultValue={editingProduct?.quantityStep || 1} type="number" step="0.01" name="quantityStep" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Tax (%)</label>
                    <input required defaultValue={editingProduct?.tax || 0} type="number" step="0.01" name="tax" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Discount (%)</label>
                    <input required defaultValue={editingProduct?.discount || 0} type="number" step="0.01" name="discount" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Category</label>
                    <select defaultValue={editingProduct?.categoryId} name="categoryId" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white focus:border-pink-500 focus:outline-none">
                      {categories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300">Image</label>
                    <input type="file" accept="image/*" name="imageFile" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer" />
                  </div>
                </div>

                {/* =========================================================================
                    Barcode Management Section
                    ========================================================================= */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarcodeIcon className="h-4 w-4 text-theme-accent" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-pink-300">
                        Barcode Management
                      </h3>
                    </div>
                    
                    {/* Barcode Type Segmented Tabs */}
                    <div className="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setBarcodeTab('INTERNAL')}
                        className={`px-3 py-1 rounded-md transition ${
                          barcodeTab === 'INTERNAL'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Internal Barcode
                      </button>
                      <button
                        type="button"
                        onClick={() => setBarcodeTab('MANUFACTURER')}
                        className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                          barcodeTab === 'MANUFACTURER'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <span>Manufacturer Barcode</span>
                        {mfgBarcodes.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[9px]">
                            {mfgBarcodes.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* INTERNAL BARCODE PANEL */}
                  {barcodeTab === 'INTERNAL' && (
                    <div className="space-y-3 pt-1">
                      <p className="text-[11px] text-zinc-400">
                        Sequential internal barcode starting from <strong>100001</strong> using Code 128 format.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                            Internal Barcode Number (Code 128)
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={internalBarcode}
                              onChange={(e) => setInternalBarcode(e.target.value.trim())}
                              placeholder="e.g. 100001"
                              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-3 pr-20 text-xs font-mono font-bold text-white focus:border-pink-500 focus:outline-none"
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] uppercase font-bold text-pink-400/80 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                              Code 128
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-5 flex gap-2">
                          <button
                            type="button"
                            onClick={handleManualGenerateBarcode}
                            disabled={isGeneratingBarcode}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition disabled:opacity-50"
                            title="Generate next sequential internal barcode"
                          >
                            <RefreshCw className={`h-3 w-3 ${isGeneratingBarcode ? 'animate-spin' : ''}`} />
                            <span>Generate</span>
                          </button>

                          {internalBarcode && (
                            <button
                              type="button"
                              onClick={() => {
                                setPrintItems([{
                                  product: editingProduct || {
                                    id: 'temp',
                                    companyId: '', barcode: '',
                                    name: (document.querySelector('input[name="name"]') as HTMLInputElement)?.value || 'Sample Product',
                                    price: Number((document.querySelector('input[name="price"]') as HTMLInputElement)?.value) || 0,
                                    stock: 1,
                                    unit: 'piece',
                                    quantityStep: 1,
                                    categoryId: '',
                                    sku: '',
                                  },
                                  barcode: internalBarcode,
                                  barcodeType: 'INTERNAL',
                                  barcodeFormat: 'CODE128',
                                  copies: 1,
                                }]);
                                setIsPrintModalOpen(true);
                              }}
                              className="px-3 py-2 rounded-xl border border-pink-500/40 bg-pink-950/40 hover:bg-pink-900/60 text-pink-300 text-xs font-bold transition flex items-center gap-1"
                              title="Print barcode label"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Print</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Live Barcode SVG Preview */}
                      {internalBarcode && (
                        <div className="mt-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 font-semibold">
                            Live Barcode Preview (Code 128)
                          </span>
                          <div
                            className="bg-white p-2.5 rounded-lg shadow-sm border border-zinc-200 max-w-[240px] w-full flex items-center justify-center"
                            dangerouslySetInnerHTML={{
                              __html: generateBarcodeSvg({
                                value: internalBarcode,
                                format: 'CODE128',
                                width: 1.8,
                                height: 38,
                                fontSize: 11,
                                displayValue: true,
                                quietZone: 6,
                              }),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* MANUFACTURER BARCODE PANEL */}
                  {barcodeTab === 'MANUFACTURER' && (
                    <div className="space-y-3 pt-1">
                      <p className="text-[11px] text-zinc-400">
                        Scan with a USB barcode scanner or type an existing product barcode (EAN-13, UPC-A, or Code 128).
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                            Scan / Enter Manufacturer Barcode
                          </label>
                          <input
                            type="text"
                            value={newMfgBarcode}
                            onChange={(e) => {
                              setNewMfgBarcode(e.target.value);
                              setMfgValidationError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddMfgBarcode();
                              }
                            }}
                            placeholder="Scan with scanner or enter digits..."
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs font-mono font-bold text-white focus:border-pink-500 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-zinc-300 mb-1">Format</label>
                          <select
                            value={newMfgFormat}
                            onChange={(e) => setNewMfgFormat(e.target.value as any)}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                          >
                            <option value="AUTO">Auto Detect</option>
                            <option value="EAN13">EAN-13 (13 digits)</option>
                            <option value="UPCA">UPC-A (12 digits)</option>
                            <option value="CODE128">Code 128</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <button
                            type="button"
                            onClick={handleAddMfgBarcode}
                            disabled={isCheckingMfgBarcode || !newMfgBarcode.trim()}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition disabled:opacity-50"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span>{isCheckingMfgBarcode ? 'Validating...' : 'Add Barcode'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Error or validation alert */}
                      {mfgValidationError && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-300">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                          <span>{mfgValidationError}</span>
                        </div>
                      )}

                      {/* List of Attached Manufacturer Barcodes */}
                      {mfgBarcodes.length === 0 ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center text-xs text-zinc-500">
                          No manufacturer barcodes added yet. Scan or enter above to add.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                          {mfgBarcodes.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-white text-xs">{item.barcode}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 uppercase font-mono border border-zinc-700">
                                  {item.format}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrintItems([{
                                      product: editingProduct || {
                                        id: 'temp',
                                        companyId: '', barcode: '',
                                        name: (document.querySelector('input[name="name"]') as HTMLInputElement)?.value || 'Sample Product',
                                        price: Number((document.querySelector('input[name="price"]') as HTMLInputElement)?.value) || 0,
                                        stock: 1,
                                        unit: 'piece',
                                        quantityStep: 1,
                                        categoryId: '',
                                        sku: '',
                                      },
                                      barcode: item.barcode,
                                      barcodeType: 'MANUFACTURER',
                                      barcodeFormat: item.format,
                                      copies: 1,
                                    }]);
                                    setIsPrintModalOpen(true);
                                  }}
                                  className="text-zinc-400 hover:text-pink-300 transition p-1"
                                  title="Print this manufacturer barcode"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMfgBarcode(idx)}
                                  className="text-zinc-500 hover:text-rose-400 transition p-1"
                                  title="Remove barcode"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* =========================================================================
                    Product Add-ons Section
                    ========================================================================= */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-pink-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-theme-accent" />
                      <span>Product Add-ons</span>
                    </h3>
                    <span className="text-[11px] font-mono text-theme-accent font-bold">
                      {selectedAddonGroupIds.length} groups assigned
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-3">
                    Select add-on groups to prompt the cashier when this product is clicked in Terminal.
                  </p>

                  {availableAddonGroups.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center text-xs text-zinc-500">
                      No add-on groups found. Create groups in the Add-ons collection first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar p-1">
                      {availableAddonGroups.map((g) => {
                        const isAssigned = selectedAddonGroupIds.includes(g.id);
                        return (
                          <div
                            key={g.id}
                            onClick={() => {
                              setSelectedAddonGroupIds((prev) =>
                                prev.includes(g.id)
                                  ? prev.filter((id) => id !== g.id)
                                  : [...prev, g.id]
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer select-none transition ${
                              isAssigned
                                ? 'bg-theme-badge border-theme ring-1 ring-theme'
                                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  isAssigned
                                    ? 'border-theme-accent bg-theme-accent text-white'
                                    : 'border-zinc-700 bg-zinc-800'
                                }`}
                              >
                                {isAssigned && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <div className="truncate">
                                <span className="font-bold text-white block truncate">{g.name}</span>
                                <span className="text-[10px] text-zinc-400">
                                  {g.isRequired ? 'Required' : 'Optional'} • {(g.itemIds || g.items || []).length} items
                                </span>
                              </div>
                            </div>
                            {isAssigned && (
                              <span className="text-[10px] font-bold text-theme-accent uppercase tracking-wider shrink-0">
                                Assigned
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Form Buttons */}
                <div className="flex gap-2 pt-2">
                  <button disabled={isUploading} type="submit" className="rounded-xl btn-theme-primary px-5 py-2 text-xs text-white shadow-lg disabled:opacity-50 font-bold cursor-pointer">
                    {isUploading ? "Saving..." : "Save Product"}
                  </button>
                  <button disabled={isUploading} type="button" onClick={handleCloseForm} className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 font-bold cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right Column: Recipe / Ingredients (35%) */}
              <div className="w-full md:w-[35%] rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 h-fit flex flex-col">
                <h3 className="font-bold text-pink-300 mb-3 text-xs uppercase tracking-wider">Recipe / Ingredients</h3>
                
                <div className="space-y-2 mb-3">
                  {currentRecipe.map((item, index) => {
                    const material = availableMaterials.find(m => m.id === item.rawMaterialId);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                        <select 
                          value={item.rawMaterialId} 
                          onChange={(e) => {
                            const newR = [...currentRecipe];
                            newR[index].rawMaterialId = e.target.value;
                            const selectedMat = availableMaterials.find(m => m.id === e.target.value);
                            if(selectedMat) newR[index].unit = selectedMat.unit;
                            setCurrentRecipe(newR);
                          }}
                          className="flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none py-1"
                        >
                          <option value="" className="bg-zinc-900">Select...</option>
                          {availableMaterials
                            .filter(m => !currentRecipe.some((r, i) => i !== index && r.rawMaterialId === m.id))
                            .map(m => (
                            <option key={m.id} value={m.id} className="bg-zinc-900">{m.name} ({m.unit})</option>
                          ))}
                        </select>
                        
                        <div className="flex items-center bg-zinc-950 rounded-lg px-2 py-1 border border-zinc-800 w-20 shrink-0">
                          <input 
                            type="number" 
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const newR = [...currentRecipe];
                              newR[index].quantity = Number(e.target.value);
                              setCurrentRecipe(newR);
                            }}
                            className="w-full bg-transparent text-xs text-right text-white focus:outline-none" 
                            placeholder="0" 
                          />
                          <span className="ml-1 text-xs font-semibold text-zinc-400">{item.unit || material?.unit || '-'}</span>
                        </div>
                        
                        <button type="button" onClick={() => {
                          const newR = [...currentRecipe];
                          newR.splice(index, 1);
                          setCurrentRecipe(newR);
                        }} className="text-zinc-500 hover:text-rose-400 transition-colors p-1 cursor-pointer">
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                
                <button type="button" onClick={() => setCurrentRecipe([...currentRecipe, { rawMaterialId: '', quantity: 0, unit: 'kg' }])} className="text-xs font-bold text-pink-400 hover:text-pink-300 self-start cursor-pointer">
                  + Add ingredient
                </button>

                {maxPlates !== null && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <div className="text-xs text-zinc-400 mb-1">Makes: <strong className="text-white">1 plate/unit</strong></div>
                    <div className={`text-xs px-2.5 py-1.5 rounded-xl font-bold border ${maxPlates > 0 ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'}`}>
                      Available: {maxPlates} plates (stock)
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Products Table View */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg overflow-hidden">
        {/* Table Search Toolbar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none"
            />
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            Showing <strong className="text-white">{tableFilteredProducts.length}</strong> of {products.length} products
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-5 py-4 font-bold">Product Name</th>
                <th className="px-4 py-4 font-bold">Barcode(s)</th>
                <th className="px-4 py-4 font-bold">SKU</th>
                <th className="px-4 py-4 font-bold">Category</th>
                <th className="px-4 py-4 font-bold">Price</th>
                <th className="px-4 py-4 font-bold">Stock</th>
                <th className="px-4 py-4 font-bold">Add-ons</th>
                <th className="px-5 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                    Loading products...
                  </td>
                </tr>
              ) : tableFilteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    <Package className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                    No products found matching your search.
                  </td>
                </tr>
              ) : tableFilteredProducts.map((p) => {
                const assignedGroups = (p.addonGroupIds || [])
                  .map((gId) => availableAddonGroups.find((g) => g.id === gId))
                  .filter(Boolean) as AddonGroup[];

                // Barcodes attached
                const internalBc = (p.barcodes || []).find(b => b.barcodeType === 'INTERNAL');
                const mfgBcs = (p.barcodes || []).filter(b => b.barcodeType === 'MANUFACTURER');
                const displayBc = internalBc?.barcode || p.barcode || (mfgBcs[0]?.barcode);

                return (
                  <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-9 w-9 rounded-xl object-cover border border-zinc-700" />
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-500 font-bold">
                            {p.name.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <span>{p.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Barcodes Column */}
                    <td className="px-4 py-3.5 text-xs">
                      {displayBc ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 font-mono text-[11px] text-zinc-200 font-bold">
                            <BarcodeIcon className="h-3 w-3 text-pink-400" />
                            {displayBc}
                          </span>
                          {mfgBcs.length > 0 && internalBc && (
                            <span className="text-[10px] font-mono text-zinc-400 pl-1" title={mfgBcs.map(m => `${m.barcode} (${m.barcodeFormat})`).join(', ')}>
                              +{mfgBcs.length} mfg
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic text-xs">None</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-xs text-zinc-400">{p.sku}</td>
                    <td className="px-4 py-3.5 text-xs">
                      <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-zinc-300">
                        {categories.find(c => c.id === p.categoryId)?.name || p.categoryId}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-black font-mono text-pink-300">₹{p.price}</td>
                    <td className="px-4 py-3.5 text-zinc-300 font-medium">{p.stock} {p.unit}</td>
                    <td className="px-4 py-3.5 text-xs">
                      {assignedGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedGroups.map((g) => (
                            <span
                              key={g.id}
                              className="inline-flex items-center gap-1 rounded-md bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 text-[11px] text-purple-300 font-medium"
                            >
                              <Layers className="h-2.5 w-2.5" />
                              {g.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic">None</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Print Barcode Action */}
                        <button
                          onClick={() => handlePrintSingleProduct(p)}
                          className="text-zinc-400 hover:text-pink-300 transition cursor-pointer p-1"
                          title="Print Barcode Label"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenForm(p)} 
                          className="text-zinc-400 hover:text-white transition cursor-pointer p-1" 
                          title="Edit Product"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={async () => { 
                            if(confirm(`Delete "${p.name}"?`)) {
                              await deleteProductDb(p.id);
                              deleteProduct(p.id);
                            } 
                          }} 
                          className="text-zinc-500 hover:text-rose-400 transition cursor-pointer p-1" 
                          title="Delete Product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Print Modal */}
      <BarcodePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        currencySymbol="₹"
      />
    </div>
  )
}
