const fs = require('fs');

const content = `
export function getApiUrl(path: string): string {
  let savedSettings: any = null;
  try {
    const localSettings = typeof window !== 'undefined' ? localStorage.getItem('gpm_system_settings') : null;
    if (localSettings) {
      savedSettings = JSON.parse(localSettings);
    }
  } catch (e) {
    console.error("Error parsing gpm_system_settings", e);
  }
  
  const localBackend = savedSettings?.backendUrl;
  const envBackend = import.meta.env.VITE_BACKEND_URL || import.meta.env.NEXT_PUBLIC_BACKEND_URL;
  const backendUrl = localBackend || envBackend || '';
  
  if (backendUrl) {
    const base = backendUrl.replace(/\\/$/, '');
    const formattedPath = path.startsWith('/') ? path : \`/\${path}\`;
    return \`\${base}\${formattedPath}\`;
  }
  return path;
}

export async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const isCustomUrl = url !== path && path.startsWith('/');

  if (isCustomUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const abortListener = () => controller.abort();
    if (options?.signal) {
      options.signal.addEventListener('abort', abortListener);
    }

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (options?.signal) options.signal.removeEventListener('abort', abortListener);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (options?.signal) options.signal.removeEventListener('abort', abortListener);
      
      if (options?.signal?.aborted) {
        throw err;
      }
      
      console.warn(\`[fetchApi] Falha ou timeout em \${url}. Re-tentando rota relativa \${path}...\`);
      return await fetch(path, { ...options, headers });
    }
  }

  return await fetch(url, { ...options, headers });
}
`;

fs.writeFileSync('src/lib/api.ts', content.trim() + '\n');
