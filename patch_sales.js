const fs = require('fs');
let c = fs.readFileSync('app/(dashboard)/sales/page.tsx', 'utf8');
const imports = "import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';\nimport { generateReceiptHtml } from '@/lib/printSystem';\n";
c = imports + c;

const salesStart = c.indexOf('{/* Thermal Receipt Preview */}');
const salesEnd = c.indexOf('</div>\n            </div>\n          </div>\n        </div>\n      )}\n    </div>\n  )\n}', salesStart);

const rep = `{/* Thermal Receipt Preview */}
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

c = c.substring(0, salesStart) + rep + c.substring(salesEnd + 83);
fs.writeFileSync('app/(dashboard)/sales/page.tsx', c);
