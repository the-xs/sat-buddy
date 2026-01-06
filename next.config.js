/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static exports if needed for deployment
    // output: 'standalone',

    // Exclude native/problematic modules from bundling
    experimental: {
        serverComponentsExternalPackages: [
            '@react-email/components',
            '@react-email/render',
            'pdf-to-img',
            'canvas',
            'sharp',
            'pdfjs-dist',
        ],
    },

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
