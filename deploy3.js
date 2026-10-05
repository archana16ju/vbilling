const { execSync } = require('child_process');
const pem = '"C:\\Users\\ADMIN\\Documents\\vserver\\VSEYAL-CLIENTS.pem"';
const cmd = `scp -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} "components/settings/PrinterDesignPanel.tsx" ubuntu@65.2.7.157:~/vbilling/skbriyani/components/settings/`;
execSync(cmd, { stdio: 'inherit' });
execSync(`ssh -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} ubuntu@65.2.7.157 "cd ~/vbilling/skbriyani && npm run build && pm2 restart skbriyani"`, { stdio: 'inherit' });
