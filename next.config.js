/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static exports if needed for deployment
    // output: 'standalone',

    // Image optimization
    images: {
        remotePatterns: [],
    },

    // Ignore backend folder during build
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
        };
        return config;
    },
};

module.exports = nextConfig;
