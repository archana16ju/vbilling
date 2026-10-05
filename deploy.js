const { execSync } = require('child_process');

const pem = '"C:\\Users\\ADMIN\\Documents\\vserver\\VSEYAL-CLIENTS.pem"';

function scp(local, remote) {
  const cmd = `scp -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} "${local}" ubuntu@65.2.7.157:~/vbilling/skbriyani/${remote}`;
  console.log('Running: ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

scp('components/settings/PrinterDesignPanel.tsx', 'components/settings/');
scp('store/usePrinterDesignStore.ts', 'store/');
scp('lib/printSystem.ts', 'lib/');
scp('store/useTerminalStore.ts', 'store/');
scp('package.json', '');
scp('app/(dashboard)/settings/page.tsx', 'app/\\(dashboard\\)/settings/');
scp('app/(dashboard)/sales/page.tsx', 'app/\\(dashboard\\)/sales/');

console.log('Restarting PM2...');
execSync(`ssh -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} ubuntu@65.2.7.157 "cd ~/vbilling/skbriyani && npm install && npm run build && pm2 restart skbriyani"`, { stdio: 'inherit' });
