export type EnvMap = Record<string, string | undefined>;

export interface CoreApiResolveOptions {
  isServer?: boolean;
  hostname?: string;
  protocol?: string;
  explicitBaseUrl?: string;
  domainMap?: Record<string, string>;
  env?: EnvMap;
}

export function parseDomainOriginMap(raw?: string): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, string> = {};
    for (const [domain, origin] of Object.entries(parsed)) {
      if (typeof origin === 'string' && origin.trim()) {
        clean[domain.trim().toLowerCase()] = origin.trim().replace(/\/+$/, '');
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function matchDomainOrigin(
  hostname: string,
  domainMap: Record<string, string>,
): string | null {
  const host = hostname.trim().toLowerCase();
  if (!host) return null;
  if (domainMap[host]) return domainMap[host];
  for (const [domain, origin] of Object.entries(domainMap)) {
    if (host.endsWith(`.${domain}`)) {
      return origin;
    }
  }
  return null;
}

function getDefaultEnv(): EnvMap {
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
}

export function resolveCoreApiBase(options: CoreApiResolveOptions = {}): string {
  const env = options.env ?? getDefaultEnv();
  const isServer = options.isServer ?? typeof window === 'undefined';
  const nodeEnv = env.NODE_ENV || 'development';
  const corePort = (env.NEXT_PUBLIC_CORE_PORT || '6101').trim();
  const envCoreUrl = (env.NEXT_PUBLIC_CORE_API_URL || '').trim().replace(/\/+$/, '');
  const internalUrl = (env.CORE_API_INTERNAL_URL || '').trim().replace(/\/+$/, '');

  if (options.explicitBaseUrl && options.explicitBaseUrl.trim()) {
    return options.explicitBaseUrl.trim().replace(/\/+$/, '');
  }

  if (isServer) {
    if (internalUrl) return internalUrl;
    if (envCoreUrl) return envCoreUrl;
    if (nodeEnv === 'production') {
      throw new Error(
        'NEXT_PUBLIC_CORE_API_URL or CORE_API_INTERNAL_URL is required in production builds',
      );
    }
    return `http://localhost:${corePort}`;
  }

  const hostname =
    options.hostname ??
    (typeof window !== 'undefined' ? window.location?.hostname || '' : '');
  const protocol =
    options.protocol ??
    (typeof window !== 'undefined' ? window.location?.protocol || 'http:' : 'http:');

  const domainMap =
    options.domainMap ?? parseDomainOriginMap(env.NEXT_PUBLIC_CORE_ORIGIN_MAP);
  const mappedOrigin = matchDomainOrigin(hostname, domainMap);
  if (mappedOrigin) {
    return mappedOrigin;
  }

  const isLocalHost =
    !hostname || hostname === 'localhost' || hostname === '127.0.0.1';
  if (envCoreUrl && (!envCoreUrl.includes('localhost') || isLocalHost)) {
    return envCoreUrl;
  }

  if (nodeEnv === 'production') {
    throw new Error(
      'NEXT_PUBLIC_CORE_API_URL or NEXT_PUBLIC_CORE_ORIGIN_MAP is required in production',
    );
  }

  return `${protocol}//${hostname || 'localhost'}:${corePort}`;
}

export function resolveAssetsBase(options: { env?: EnvMap; explicitBaseUrl?: string } = {}): string {
  if (options.explicitBaseUrl && options.explicitBaseUrl.trim()) {
    return options.explicitBaseUrl.trim().replace(/\/+$/, '');
  }
  const env = options.env ?? getDefaultEnv();
  return (env.NEXT_PUBLIC_ASSETS_BASE_URL || env.ASSETS_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
}

export function resolveLocalOrigin(port: number): string {
  return `http://localhost:${port}`;
}

export function resolvePublicSiteUrl(options: { env?: EnvMap; explicitSiteUrl?: string } = {}): string {
  if (options.explicitSiteUrl && options.explicitSiteUrl.trim()) {
    return options.explicitSiteUrl.trim().replace(/\/+$/, '');
  }
  const env = options.env ?? getDefaultEnv();
  return (env.NEXT_PUBLIC_SITE_URL || env.SITE_URL || '')
    .trim()
    .replace(/\/+$/, '');
}

