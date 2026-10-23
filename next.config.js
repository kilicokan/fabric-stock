/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@radix-ui/react-*"],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.ttf$/,
      type: 'asset/resource',
    });
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native-vector-icons': false,
    };
    return config;
  },
};

module.exports = nextConfig;
