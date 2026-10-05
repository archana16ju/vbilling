const fs = require('fs');
let c = fs.readFileSync('store/useTerminalStore.ts', 'utf8');
c = c.replace('const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();\r\n        return `BILL-${todayStr}-${String(nextCount).padStart(3, \'0\')}-${randomSuffix}`', 'return `BILL-${todayStr}-${String(nextCount).padStart(3, \'0\')}`');
c = c.replace('const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();\n        return `BILL-${todayStr}-${String(nextCount).padStart(3, \'0\')}-${randomSuffix}`', 'return `BILL-${todayStr}-${String(nextCount).padStart(3, \'0\')}`');
fs.writeFileSync('store/useTerminalStore.ts', c);
