export { RestClient } from './RestClient';
export { WebsocketClient } from './WebsocketClient';
// Backward-compatible alias — the client now handles trading streams too.
export { WebsocketClient as MarketDataWsClient } from './WebsocketClient';

export { BaseRestClient } from './util/BaseRestClient';
export { DNSEAPIError } from './util/DNSEAPIError';
export { DefaultLogger } from './util/logger';
export {
  buildSigningString,
  formatDateHeader,
  generateNonce,
  signMessage,
  signWsAuth,
  signedHeadersList,
} from './util/node-support';

export * from './types';
export * from './types/ws';
