const fs = require('fs');
let c = fs.readFileSync('app/(dashboard)/settings/page.tsx', 'utf8');

c = c.replace('import SoftwareUpdatesPanel', "import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';\nimport SoftwareUpdatesPanel");
c = c.replace("{ id: 'printer', label: 'Printer Settings' },", "{ id: 'printer', label: 'Printer Settings' }, { id: 'printer-design', label: 'Printer Design' },");
c = c.replace("{activeTab === 'printer' && (", "{activeTab === 'printer-design' && <PrinterDesignPanel />}\n          {activeTab === 'printer' && (");

fs.writeFileSync('app/(dashboard)/settings/page.tsx', c);
