const { execSync } = require('child_process');
const pem = '"C:\\Users\\ADMIN\\Documents\\vserver\\VSEYAL-CLIENTS.pem"';
const cmd1 = `scp -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} "app/(dashboard)/settings/page.tsx" "ubuntu@65.2.7.157:~/vbilling/skbriyani/app/(dashboard)/settings/"`;
console.log('Running: ' + cmd1);
execSync(cmd1, { stdio: 'inherit' });

const cmd2 = `scp -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} "app/(dashboard)/sales/page.tsx" "ubuntu@65.2.7.157:~/vbilling/skbriyani/app/(dashboard)/sales/"`;
console.log('Running: ' + cmd2);
execSync(cmd2, { stdio: 'inherit' });

console.log('Restarting PM2...');
execSync(`ssh -o BatchMode=yes -o StrictHostKeyChecking=no -i ${pem} ubuntu@65.2.7.157 "cd ~/vbilling/skbriyani && npm install && npm run build && pm2 restart skbriyani"`, { stdio: 'inherit' });
