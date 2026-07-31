const fs = require('fs');
let content = fs.readFileSync('api/automacao/run-now.ts', 'utf8');
content = content.replace(/new Promise\(resolve => setTimeout\(\(\) => resolve\(\{ data: null \}\), 3000\)\)/g, "new Promise(resolve => { const t = setTimeout(() => resolve({ data: null }), 3000); configPromise.finally(() => clearTimeout(t)); })");
content = content.replace(/new Promise\(resolve => setTimeout\(\(\) => resolve\(\{ data: \[\] \}\), 4000\)\)/g, "new Promise(resolve => { const t = setTimeout(() => resolve({ data: [] }), 4000); clientsPromise.finally(() => clearTimeout(t)); })");
content = content.replace(/new Promise\(resolve => setTimeout\(\(\) => resolve\(\{ data: null \}\), 2000\)\)/g, "new Promise(resolve => { const t = setTimeout(() => resolve({ data: null }), 2000); pixPromise.finally(() => clearTimeout(t)); })");
fs.writeFileSync('api/automacao/run-now.ts', content);
