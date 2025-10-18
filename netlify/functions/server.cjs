/* eslint-disable */
const serverless = require('serverless-http');
const app = require('./dist/src/main').default;
const appPromise = Promise.resolve(serverless(app));

let cachedServer;

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  if (!cachedServer) {
    cachedServer = await appPromise;
  }
  
  return cachedServer(event, context);
};