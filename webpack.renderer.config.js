const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production' || process.env.NODE_ENV === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/renderer/app.ts',
    target: 'electron-renderer',
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.wasm$/,
          type: 'asset/resource',
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    output: {
      filename: 'renderer.js',
      path: path.resolve(__dirname, 'dist/renderer'),
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'index.html',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'),
            to: path.resolve(__dirname, 'dist/renderer/sql-wasm.wasm'),
          },
        ],
      }),
    ],
  };
};

