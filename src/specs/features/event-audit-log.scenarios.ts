/**
 * Event Audit Log Scenarios
 *
 * Source of truth for event audit log behavior. Each scenario maps directly to:
 *   - A vitest describe/it block in __tests__/features/event-audit-log.test.ts
 *   - A product requirement (see working-on/event-audit-log/osddt.spec.md)
 *
 * When behavior changes, update here FIRST, then update the server layer and tests.
 */

import { eventAuditLogFixtures } from "@/specs/fixtures"

export const eventAuditLogScenarios = {
  instrumentation: {
    "EVENT_CREATED written when manager creates event": {
      given: "a manager calls events.create with valid input",
      when: "the event is persisted",
      then: [
        "eventAuditLog.create is called with action EVENT_CREATED",
        "actorId matches manager session user id",
        "actorRole is manager",
        "eventId matches the newly created event",
        "organizationId matches the manager org",
      ],
      expectedAction: "EVENT_CREATED",
    },

    "MUSICIAN_ASSIGNED written when musician first set on update": {
      given: "an event with no musician, manager updates to set musicianId",
      when: "events.update is called",
      then: [
        "eventAuditLog.create is called with action MUSICIAN_ASSIGNED",
        "metadata contains musicianId and musicianName",
      ],
      expectedAction: "MUSICIAN_ASSIGNED",
    },

    "MUSICIAN_CHANGED written when musician replaced on update": {
      given: "an event already has musician A, manager updates to musician B",
      when: "events.update is called",
      then: [
        "eventAuditLog.create is called with action MUSICIAN_CHANGED",
        "metadata contains from and to musician info",
      ],
      expectedAction: "MUSICIAN_CHANGED",
    },

    "MUSICIAN_REMOVED written when musician cleared on update": {
      given: "an event has a musician, manager sets musicianId to null",
      when: "events.update is called",
      then: [
        "eventAuditLog.create is called with action MUSICIAN_REMOVED",
        "metadata contains the removed musician info",
      ],
      expectedAction: "MUSICIAN_REMOVED",
    },

    "BAND_ASSIGNED written when band first set on update": {
      given: "an event with no band, manager updates to set bandId",
      when: "events.update is called",
      then: ["eventAuditLog.create is called with action BAND_ASSIGNED"],
      expectedAction: "BAND_ASSIGNED",
    },

    "BAND_CHANGED written when band replaced on update": {
      given: "an event already has band A, manager updates to band B",
      when: "events.update is called",
      then: ["eventAuditLog.create is called with action BAND_CHANGED"],
      expectedAction: "BAND_CHANGED",
    },

    "BAND_REMOVED written when band cleared on update": {
      given: "an event has a band, manager sets bandId to null",
      when: "events.update is called",
      then: ["eventAuditLog.create is called with action BAND_REMOVED"],
      expectedAction: "BAND_REMOVED",
    },

    "INVITATION_SENT written when notification created with eventId": {
      given: "a manager calls notifications.create with an eventId",
      when: "the notification is persisted",
      then: [
        "eventAuditLog.create is called with action INVITATION_SENT",
        "eventId and organizationId match the linked event",
      ],
      expectedAction: "INVITATION_SENT",
    },

    "INVITATION_READ written when musician marks event notification as read": {
      given: "a musician calls notifications.markRead on a notification with eventId",
      when: "the notification is updated to read=true",
      then: [
        "eventAuditLog.create is called with action INVITATION_READ",
        "actorId is the musician's user id",
        "organizationId is resolved from the linked event",
      ],
      expectedAction: "INVITATION_READ",
    },

    "INVITATION_READ written for each event-linked notification on markAllRead": {
      given: "a musician has 3 unread notifications, 2 linked to events",
      when: "notifications.markAllRead is called",
      then: [
        "eventAuditLog.create is called twice",
        "each call uses the corresponding eventId and organizationId",
      ],
      expectedAuditCount: 2,
    },

    "CHECK_IN_RECORDED written when checkIn mutation succeeds": {
      given: "a musician calls events.checkIn with timestamp and location",
      when: "the event is updated with check-in data",
      then: [
        "eventAuditLog.create is called with action CHECK_IN_RECORDED",
        "metadata contains time and location",
      ],
      expectedAction: "CHECK_IN_RECORDED",
    },

    "STATUS_CHANGED written when status field changes on update": {
      given: "an event has status scheduled, manager updates to cancelled",
      when: "events.update is called",
      then: [
        "eventAuditLog.create is called with action STATUS_CHANGED",
        "metadata contains from=scheduled and to=cancelled",
      ],
      expectedAction: "STATUS_CHANGED",
    },

    "FIELD_UPDATED written per changed scalar field on update": {
      given: "a manager updates event title and date",
      when: "events.update is called",
      then: [
        "eventAuditLog.create is called twice (once per changed field)",
        "each call has action FIELD_UPDATED with field, from, and to in metadata",
      ],
      expectedAuditCount: 2,
    },

    "PRICE_CHANGED written when price field changes on update": {
      given: "an event has price null, manager sets price to 5000",
      when: "events.update is called",
      then: [
        "eventAuditLog.create is called with action PRICE_CHANGED",
        "metadata contains from=null and to=5000",
      ],
      expectedAction: "PRICE_CHANGED",
    },

    "EVENT_DELETED written before event is hard-deleted": {
      given: "a manager calls events.delete on an existing event",
      when: "the event is deleted",
      then: [
        "eventAuditLog.create is called with action EVENT_DELETED before the delete",
        "metadata contains the event title",
      ],
      expectedAction: "EVENT_DELETED",
    },
  },

  auditFailureIsolation: {
    "primary mutation succeeds even if audit write throws": {
      given: "eventAuditLog.create throws an unhandled error",
      when: "events.create is called",
      then: [
        "the event is still persisted",
        "the error is logged to console but not re-thrown",
        "the caller receives the created event normally",
      ],
    },
  },

  accessControl: {
    "musician role blocked from list query": {
      given: "a user with role musician calls eventAuditLogs.list",
      when: "the query is executed",
      then: ["a FORBIDDEN TRPCError is thrown", "no log entries are returned"],
    },

    "cross-org manager blocked from list query": {
      given: "a manager from org-A calls eventAuditLogs.list with an eventId belonging to org-B",
      when: "the query is executed",
      then: [
        "a FORBIDDEN TRPCError is thrown",
        "no log entries from org-B are returned",
      ],
    },
  },

  pagination: {
    "list returns items and total with correct take and skip": {
      given: "an eventId with 35 audit entries in the DB",
      when: "eventAuditLogs.list is called with limit=20 and offset=0",
      then: [
        "findMany is called with take=20 and skip=0",
        "response contains items (up to 20) and total=35",
      ],
      fixtures: {
        entries: eventAuditLogFixtures,
      },
    },

    "list second page returns correct slice": {
      given: "an eventId with 35 audit entries in the DB",
      when: "eventAuditLogs.list is called with limit=20 and offset=20",
      then: [
        "findMany is called with take=20 and skip=20",
        "response items contain the remaining 15 entries",
      ],
    },
  },
}
