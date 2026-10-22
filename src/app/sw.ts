import { NavigationRoute, NetworkOnly, Serwist } from "serwist";

declare const self: {
  __SW_MANIFEST: (string | { url: string; revision?: string | null })[];
  skipWaiting: () => Promise<void>;
  addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [],
});

serwist.registerRoute(new NavigationRoute(new NetworkOnly(), { denylist: [/^\/api\//] }));
serwist.setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") return (await serwist.matchPrecache("/offline.html")) ?? Response.error();
  return Response.error();
});

self.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

serwist.addEventListeners();
