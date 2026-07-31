const fs = require('fs');
let content = fs.readFileSync('api/automacao/config.ts', 'utf8');

// Replace setTimeout in GET with clearTimeout
content = content.replace(/const timeoutPromise = new Promise\(\(resolve\) => \{\s*timer = setTimeout\(\(\) => resolve\(\{ data: null, error: \{ message: 'Timeout' \} \}\), 2000\);\s*\}\);/, "const timeoutPromise = new Promise((resolve) => {\n            timer = setTimeout(() => resolve({ data: null, error: { message: 'Timeout' } }), 4000);\n          });");

// Replace setTimeout in POST queryPromise with clearTimeout
content = content.replace(/const resRace: any = await Promise\.race\(\[\s*queryPromise, \s*new Promise\(resolve => setTimeout\(\(\) => resolve\(\{ data: null \}\), 2000\)\)\s*\]\);/g, "let t; const resRace: any = await Promise.race([\n            queryPromise, \n            new Promise(resolve => { t = setTimeout(() => resolve({ data: null }), 4000); })\n          ]); clearTimeout(t);");

fs.writeFileSync('api/automacao/config.ts', content);
