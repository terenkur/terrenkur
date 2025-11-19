declare module "event-source-polyfill" {
  interface EventSourcePolyfillInit extends EventSourceInit {
    heartbeatTimeout?: number;
    connectionTimeout?: number;
    lastEventIdQueryParameterName?: string;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    disableRequestRedirect?: boolean;
    fetch?: typeof fetch;
  }

  export class EventSourcePolyfill extends EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourcePolyfillInit);
    close(): void;
  }

  export default EventSourcePolyfill;
}
