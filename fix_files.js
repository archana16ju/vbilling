const fs = require('fs');

// Patch store
let cStore = fs.readFileSync('store/useTerminalStore.ts', 'utf8');
const storeImports = "import { usePrinterDesignStore } from './usePrinterDesignStore';\nimport { generateReceiptHtml } from '@/lib/printSystem';\n";
cStore = storeImports + cStore;

const htmlStart = cStore.indexOf('const htmlContent = `');
const htmlEnd = cStore.indexOf('</html>`;', htmlStart) + 9;

const storeReplacement = "const design = usePrinterDesignStore.getState();\n    const htmlContent = generateReceiptHtml({ ...saleData, id: fullBillId, timestamp: Date.now() }, design);";

cStore = cStore.substring(0, htmlStart) + storeReplacement + cStore.substring(htmlEnd);
fs.writeFileSync('store/useTerminalStore.ts', cStore);


// Patch sales
let cSales = fs.readFileSync('app/(dashboard)/sales/page.tsx', 'utf8');
const salesImports = "import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';\nimport { generateReceiptHtml } from '@/lib/printSystem';\n";
cSales = salesImports + cSales;

const salesStart = cSales.indexOf('{/* Thermal Receipt Preview */}');
const salesEnd = cSales.indexOf('</div>\n            </div>\n          </div>\n        </div>\n      )}\n    </div>\n  )\n}', salesStart);

const salesReplacement = `{/* Thermal Receipt Preview */}
            <div className="bg-white overflow-hidden shadow-sm" style={{ width: '80mm', minHeight: '300px', margin: '0 auto', border: '1px solid #e4e4e7' }}>
              <iframe
                 title="Receipt Preview"
                 srcDoc={generateReceiptHtml(selectedSale, usePrinterDesignStore())}
                 className="w-full h-full border-0"
                 style={{ minHeight: '400px' }}
               />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}`;

cSales = cSales.substring(0, salesStart) + salesReplacement + cSales.substring(salesEnd + 83);
fs.writeFileSync('app/(dashboard)/sales/page.tsx', cSales);
console.log('Patched cleanly!');
