const line = 'MONGODB_URI=mongodb://foo?appName=Cluster0\r';
const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
console.log('Match 1:', match[1]);
console.log('Match 2:', match[2], 'Length:', match[2].length);
