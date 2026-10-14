/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // El paquete compartido se publica como TypeScript fuente dentro del monorepo.
  transpilePackages: ['@smartcommerce/shared'],
};

export default nextConfig;
