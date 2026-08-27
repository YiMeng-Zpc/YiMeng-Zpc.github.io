import { OAuthProxy } from "keystatic-cloud-oauth-proxy";

const proxy = new OAuthProxy({
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return proxy.handle(request, env);
  },
};
