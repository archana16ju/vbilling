const fs = require('fs');
let lines = fs.readFileSync('app/(dashboard)/sales/page.tsx', 'utf8').split('\n');

const repLines = `            {/* Thermal Receipt Preview */}
            <div className="bg-white overflow-hidden shadow-sm" style={{ width: '80mm', minHeight: '300px', margin: '0 auto', border: '1px solid #e4e4e7' }}>
              <iframe
                 title="Receipt Preview"
                 srcDoc={generateReceiptHtml(selectedSale, usePrinterDesignStore())}
                 className="w-full h-full border-0"
                 style={{ minHeight: '400px' }}
               />
            </div>`.split('\n');

lines.splice(235, 49, ...repLines);

const final = "import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';\nimport { generateReceiptHtml } from '@/lib/printSystem';\n" + lines.join('\n');
fs.writeFileSync('app/(dashboard)/sales/page.tsx', final);
console.log('Replaced cleanly!');
