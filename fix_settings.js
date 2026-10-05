const fs = require('fs');
let c = fs.readFileSync('app/(dashboard)/settings/page.tsx', 'utf8');
const search1 = "import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';\r\nimport PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';";
const search2 = "import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';\nimport PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';";
c = c.replace(search1, "import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';");
c = c.replace(search2, "import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';");
fs.writeFileSync('app/(dashboard)/settings/page.tsx', c);
