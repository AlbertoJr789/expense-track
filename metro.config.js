const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite on web imports wa-sqlite.wasm. Metro only resolves extensions
// listed as assets or source, and wasm is in neither by default.
config.resolver.assetExts.push('wasm');

// wa-sqlite needs SharedArrayBuffer, which the browser only exposes when
// these cross-origin headers are present.
const previousEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = previousEnhance ? previousEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(req, res, next);
  };
};

module.exports = config;
