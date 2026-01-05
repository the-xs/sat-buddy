/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static exports if needed for deployment
    // output: 'standalone',

    // Exclude react-email from bundling to fix Html component conflict
    serverExternalPackages: ['@react-email/components', '@react-email/render'],

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
