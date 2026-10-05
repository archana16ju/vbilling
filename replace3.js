const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/sales/page.tsx', 'utf8');

const startIdx = content.indexOf('{/* Thermal Receipt Preview */}');
const endIdxStr = '*** Thank You, Visit Again! ***\n              </div>\n            </div>';
const endIdx = content.indexOf(endIdxStr) + endIdxStr.length;

const replacement = `{/* Thermal Receipt Preview */}
            <div className="bg-white overflow-hidden shadow-sm" style={{ width: '80mm', minHeight: '300px', margin: '0 auto', border: '1px solid #e4e4e7' }}>
              <iframe
                 title="Receipt Preview"
                 srcDoc={generateReceiptHtml(selectedSale, usePrinterDesignStore())}
                 className="w-full h-full border-0"
                 style={{ minHeight: '400px' }}
               />
            </div>`;

let newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
newContent = "import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';\nimport { generateReceiptHtml } from '@/lib/printSystem';\n" + newContent;

fs.writeFileSync('app/(dashboard)/sales/page.tsx', newContent);
