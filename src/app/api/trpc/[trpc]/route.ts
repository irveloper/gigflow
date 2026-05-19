import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import type { NextRequest } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { appRouter } from "@/server/routers"
import { createTRPCContext } from "@/server/trpc"

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError({ error, path, type }) {
      // Only capture unexpected errors — not user-facing TRPCErrors like NOT_FOUND, UNAUTHORIZED
      if (error.code === "INTERNAL_SERVER_ERROR") {
        Sentry.captureException(error, {
          tags: { trpcPath: path ?? "unknown", trpcType: type },
        })
      }
    },
  })

export { handler as GET, handler as POST }
