export function getApiUrl(path: string): string {
  // Check if a custom backend URL is saved in local storage
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
    const base = backendUrl.replace(/\/$/, '');
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${formattedPath}`;
  }
  return path;
}

export async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  
  // Set default headers if content-type is json
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    // Se a URL customizada falhou (ex: CORS, backend fora do ar), tenta rota relativa na mesma origem
    if (url !== path && path.startsWith('/')) {
      console.warn(`[fetchApi] Falha ao conectar em ${url}. Re-tentando rota relativa ${path}...`);
      try {
        return await fetch(path, {
          ...options,
          headers,
        });
      } catch (retryErr) {
        throw retryErr;
      }
    }
    throw err;
  }
}
