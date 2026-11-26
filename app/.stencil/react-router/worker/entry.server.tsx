import type { AppLoadContext, EntryContext, HandleErrorFunction } from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import appHooks from "~/auth-hooks.server";
import { registerAuthHooks } from "~stencil/auth/hooks";

// `~/auth-hooks.server` loads here, with the server build on the first request:
// never in the client graph, and never at worker startup, where the app code
// behind the hooks has no request to run against.
registerAuthHooks(appHooks);

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
        }
      },
    }
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

// Logged as a string: the Workers trace of a logged Error object keeps only its
// `name: message`, and the stack frames are what locates the failing loader or action.
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  if (isRouteErrorResponse(error)) {
    if (error.status < 500) return;
    error = (error as { error?: unknown }).error ?? `${error.status} ${error.statusText}`;
  }
  console.error(error instanceof Error ? error.stack || `${error.name}: ${error.message}` : String(error));
};
