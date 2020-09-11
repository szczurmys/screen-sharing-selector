const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: [
        './src/index.ts'
    ],
    output: {
        filename: 'main.js',
        library: "screenSharingCropping",
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(html)$/,
                use: 'raw-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(css)$/,
                use: ['raw-loader'],
                exclude: /node_modules/,
            },
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    devServer: {
        contentBase: './dist',
    },
    plugins: [
        new CopyWebpackPlugin([
            { from: 'assets', to: 'assets' },
            { from: 'index.html', to: 'index.html' }
        ]),
    ]
};