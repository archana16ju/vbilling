const { MongoClient } = require('mongodb');
try {
  new MongoClient('mongodb://foo?appName=Cluster0\r');
  console.log('Success with \\r');
} catch(e) {
  console.log('Error with \\r:', e.message);
}
try {
  new MongoClient('mongodb://foo?appName=Cluster0');
  console.log('Success without \\r');
} catch(e) {
  console.log('Error without \\r:', e.message);
}
