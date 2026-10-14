import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // El paquete compartido se consume desde su fuente TypeScript: la web no depende de que
  // `packages/shared` esté compilado (en Vercel no corre el postinstall del monorepo).
  transpilePackages: ['@smartcommerce/shared'],
  webpack: (config) => {
    config.resolve.alias['@smartcommerce/shared'] = path.join(here, '..', '..', 'packages', 'shared', 'src', 'index.ts');
    config.resolve.extensionAlias = { ...(config.resolve.extensionAlias ?? {}), '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};

export default nextConfig;
