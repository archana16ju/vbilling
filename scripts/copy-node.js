const fs = require('fs');
const path = require('path');
const nodeExe = process.execPath;
const target = path.join(__dirname, '..', 'node.exe');
try {
  console.log('Copying Node runtime from ' + nodeExe + ' to ' + target);
  fs.copyFileSync(nodeExe, target);
} catch (e) {
  if (fs.existsSync(target)) {
    console.log('Target node.exe already exists and is locked. Reusing existing node.exe.');
  } else {
    throw e;
  }
}