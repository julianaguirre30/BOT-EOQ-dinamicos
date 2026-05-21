import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack es el bundler por defecto en Next.js 16 (dev).
  // next-pwa inyecta config de webpack; este objeto vacío silencia el aviso.
  turbopack: {},
};

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    // No cachear las rutas de API (solver + chat con Groq)
    runtimeCaching: [
      {
        urlPattern: /^\/api\/.*/i,
        handler: 'NetworkOnly',
      },
    ],
  },
})(nextConfig);
