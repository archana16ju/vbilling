const fs = require('fs');
const path = require('path');
const nodeExe = process.execPath;
const target = path.join(__dirname, '..', 'node.exe');
console.log('Copying Node runtime from ' + nodeExe + ' to ' + target);
fs.copyFileSync(nodeExe, target);