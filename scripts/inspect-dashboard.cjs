const http = require('http');

http.get('http://127.0.0.1:3000/dashboard', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Headers:', res.headers);
    if (res.headers.location) {
      console.log('Redirect location:', res.headers.location);
    }
    const scripts = d.match(/<script[^>]+src=[^>]+>/g);
    console.log('Script tags count:', scripts ? scripts.length : 0);
    if (scripts) {
      console.log(scripts.slice(0, 10));
    }
  });
}).on('error', err => {
  console.error('Error connecting to port 3000:', err.message);
});
