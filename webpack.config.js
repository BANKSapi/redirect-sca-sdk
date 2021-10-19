const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, './src/redirect-sca-sdk.js'),
  module: {
    rules: [{
      test: /\.m?js$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader"
      }
    }]
  },
  resolve: {
    extensions: ['*', '.js']
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'redirect-sca-sdk.js',
    library: 'redirectSca',
    clean: true
  },
  devServer: {
    static: {
      directory: path.join(__dirname, './dist'),
    },
    port: 9000,
  },
  mode: 'production'
};