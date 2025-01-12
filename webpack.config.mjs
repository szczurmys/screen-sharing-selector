import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    mode: 'production',
    entry: [
        './src/index.ts'
    ],
    devtool: 'inline-source-map',
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
                test: /\.s[ac]ss$/i,
                use: [
                    'raw-loader',
                    // Compiles Sass to CSS
                    'sass-loader',
                ],
                exclude: /node_modules/,
            },
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    devServer: {
        static: {
            directory: path.join(__dirname, "./dist")
        }
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "assets", to: "assets" },
                { from: "index.html", to: "index.html" },
            ],
        }),
    ]
};
