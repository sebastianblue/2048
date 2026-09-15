import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const logs = path.resolve('playtests');
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname === '/api/playtest' && req.method === 'POST') {
    if (req.headers.origin !== 'http://127.0.0.1:4178' && req.headers.origin !== 'http://localhost:4178') {res.writeHead(403).end();return;}
    let body='';
    req.on('data',chunk=>{body+=chunk;if(body.length>65536)req.destroy();});
    req.on('end',()=>{try{
      const event=JSON.parse(body);
      if(typeof event.type!=='string'||typeof event.at!=='string'||!event.state||typeof event.runId!=='string'){res.writeHead(400).end();return;}
      fs.mkdirSync(logs,{recursive:true});
      fs.appendFileSync(path.join(logs,new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify(event)+'\n');
      res.writeHead(204).end();
    }catch{res.writeHead(400).end();}});return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(err,data) => {
    if (err) {res.writeHead(404).end('Not found');return;}
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'})[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');res.end(data);
  });
}).listen(4178, '127.0.0.1', () => console.log('http://127.0.0.1:4178'));
