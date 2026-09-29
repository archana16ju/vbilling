const fs = require('fs');
const content = fs.readFileSync('.next/server/app/dashboard/page.js', 'utf8');
const actionMatch = content.match(/[a-f0-9]{40}/g);
console.log(actionMatch ? [...new Set(actionMatch)] : 'none');
