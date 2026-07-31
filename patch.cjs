const fs = require('fs');
let content = fs.readFileSync('src/components/AutomacaoPanel.tsx', 'utf8');

// replace fetchConfig controller
content = content.replace(/const controller = new AbortController\(\);\s*const timer = setTimeout\(\(\) => controller\.abort\(\), 15000\);\s*const res = await fetchApi\('\/api\/automacao\/config', \{ signal: controller\.signal \}\);\s*clearTimeout\(timer\);/, "const res = await fetchApi('/api/automacao/config');");

// replace fetchPreview controller
content = content.replace(/const controller = new AbortController\(\);\s*const timer = setTimeout\(\(\) => controller\.abort\(\), 15000\);\s*const res = await fetchApi\('\/api\/automacao\/preview-clients', \{ signal: controller\.signal \}\);\s*clearTimeout\(timer\);/, "const res = await fetchApi('/api/automacao/preview-clients');");

// replace handleSaveConfig controller
content = content.replace(/const controller = new AbortController\(\);\s*const timer = setTimeout\(\(\) => controller\.abort\(\), 15000\);\s*const res = await fetchApi\('\/api\/automacao\/config', \{/g, "const res = await fetchApi('/api/automacao/config', {");
content = content.replace(/signal: controller\.signal\s*\}\);\s*clearTimeout\(timer\);/g, "});");

// replace handleRunManualTest controller
content = content.replace(/const controller = new AbortController\(\);\s*const timer = setTimeout\(\(\) => controller\.abort\(\), 25000\);\s*try \{\s*const res = await fetchApi\('\/api\/automacao\/test-sms', \{/g, "try {\n      const res = await fetchApi('/api/automacao/test-sms', {");
content = content.replace(/signal: controller\.signal\s*\}\);\s*clearTimeout\(timer\);/g, "});");

fs.writeFileSync('src/components/AutomacaoPanel.tsx', content);
