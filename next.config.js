/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
