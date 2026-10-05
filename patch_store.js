const fs = require('fs');
let c = fs.readFileSync('store/useTerminalStore.ts', 'utf8');
const imports = "import { usePrinterDesignStore } from './usePrinterDesignStore';\nimport { generateReceiptHtml } from '@/lib/printSystem';\n";
c = imports + c;

const htmlStart = c.indexOf('const htmlContent = `');
const htmlEnd = c.indexOf('</html>`;', htmlStart) + 9;

const rep = "const design = usePrinterDesignStore.getState();\n    const htmlContent = generateReceiptHtml({ ...saleData, id: fullBillId, timestamp: Date.now() }, design);";

c = c.substring(0, htmlStart) + rep + c.substring(htmlEnd);
fs.writeFileSync('store/useTerminalStore.ts', c);
