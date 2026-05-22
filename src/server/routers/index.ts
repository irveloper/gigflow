import { router } from "@/server/trpc"
import { authRouter } from "./auth"
import { adminRouter } from "./admin"
import { bandsRouter } from "./bands"
import { billingRouter } from "./billing"
import { eventAuditLogsRouter } from "./event-audit-logs"
import { eventsRouter } from "./events"
import { hotelsRouter } from "./hotels"
import { musiciansRouter } from "./musicians"
import { notificationsRouter } from "./notifications"
import { organizationsRouter } from "./organizations"
import { reportsRouter } from "./reports"

export const appRouter = router({
  auth: authRouter,
  admin: adminRouter,
  bands: bandsRouter,
  billing: billingRouter,
  eventAuditLogs: eventAuditLogsRouter,
  events: eventsRouter,
  hotels: hotelsRouter,
  musicians: musiciansRouter,
  notifications: notificationsRouter,
  organizations: organizationsRouter,
  reports: reportsRouter,
})

export type AppRouter = typeof appRouter
