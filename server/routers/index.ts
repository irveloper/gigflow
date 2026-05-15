import { router } from "@/server/trpc"
import { authRouter } from "./auth"
import { adminRouter } from "./admin"
import { eventsRouter } from "./events"
import { hotelsRouter } from "./hotels"
import { musiciansRouter } from "./musicians"
import { notificationsRouter } from "./notifications"

export const appRouter = router({
  auth: authRouter,
  admin: adminRouter,
  events: eventsRouter,
  hotels: hotelsRouter,
  musicians: musiciansRouter,
  notifications: notificationsRouter,
})

export type AppRouter = typeof appRouter
