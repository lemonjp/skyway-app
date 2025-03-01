/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // テストファイルを除外
    config.module.rules.push({
      test: /\.test\.(js|jsx|ts|tsx)$/,
      loader: 'ignore-loader',
    });
    return config;
  },
  eslint: {
    // テストファイルをESLintのチェック対象から除外
    ignoreDuringBuilds: true,
    dirs: ['src/app', 'src/components', 'src/utils'].filter(dir => !dir.includes('__tests__')),
  }
};

module.exports = nextConfig;
