/**
 * Payments Feature Scenarios
 *
 * Source of truth for payment status management behavior.
 * Update here FIRST when requirements change.
 */

import { eventFixtures } from "@/specs/fixtures"
import { userFixtures } from "@/specs/fixtures"

export const paymentsScenarios = {
  defaultStatus: {
    "new event defaults to pending payment status": {
      given: { user: userFixtures.manager, input: "CreateEventInput" },
      when: "event is created",
      then: ["event.paymentStatus is 'pending'", "event.paymentNotes is null"],
    },
  },

  markPaid: {
    "manager marks a pending event as paid": {
      given: {
        event: { ...eventFixtures.todayAcoustic, paymentStatus: "pending" },
        user: userFixtures.manager,
        notes: "Paid via SPEI ref 12345",
      },
      when: "updatePaymentStatus is called with paymentStatus='paid' and notes",
      then: [
        "event.paymentStatus becomes 'paid'",
        "event.paymentNotes is set to the provided notes",
        "PAYMENT_STATUS_CHANGED audit entry is written with metadata { from: 'pending', to: 'paid', notes }",
      ],
    },

    "manager reverts a paid event to pending": {
      given: {
        event: { ...eventFixtures.completedLatinJazz, paymentStatus: "paid" },
        user: userFixtures.manager,
      },
      when: "updatePaymentStatus is called with paymentStatus='pending'",
      then: [
        "event.paymentStatus becomes 'pending'",
        "PAYMENT_STATUS_CHANGED audit entry is written with metadata { from: 'paid', to: 'pending', notes: null }",
      ],
    },

    "non-manager cannot change payment status": {
      given: {
        event: eventFixtures.todayAcoustic,
        user: userFixtures.musician,
      },
      when: "updatePaymentStatus is called by a musician",
      then: ["UNAUTHORIZED error is thrown", "event.paymentStatus is unchanged"],
      expectedError: "UNAUTHORIZED",
    },
  },

  paymentsQuery: {
    "payments query excludes cancelled events": {
      given: {
        events: [
          eventFixtures.todayAcoustic,        // pending, non-cancelled
          eventFixtures.cancelledClassical,   // cancelled
        ],
        range: { from: "2026-01-01", to: "2026-12-31" },
      },
      when: "reports.payments is called",
      then: [
        "cancelledClassical is not in the returned list",
        "todayAcoustic is in the returned list",
      ],
    },

    "null-price events appear in list but are excluded from totals": {
      given: {
        events: [
          { ...eventFixtures.todayAcoustic, price: null, paymentStatus: "pending" },
          { ...eventFixtures.tomorrowPiano, price: 1600, paymentStatus: "pending" },
        ],
        range: { from: "2026-01-01", to: "2026-12-31" },
      },
      when: "reports.payments is called",
      then: [
        "both events appear in the returned list",
        "pendingTotal is 1600 (null price excluded, not counted as 0)",
        "paidTotal is 0",
      ],
      expectedTotals: { pendingTotal: 1600, paidTotal: 0 },
    },

    "pendingTotal and paidTotal are calculated correctly": {
      given: {
        events: [
          { ...eventFixtures.todayAcoustic, price: 800, paymentStatus: "pending" },
          { ...eventFixtures.tomorrowPiano, price: 1600, paymentStatus: "pending" },
          { ...eventFixtures.completedLatinJazz, price: 1600, paymentStatus: "paid" },
        ],
        range: { from: "2026-01-01", to: "2026-12-31" },
      },
      when: "reports.payments is called",
      then: [
        "pendingTotal is 2400 (800 + 1600)",
        "paidTotal is 1600",
      ],
      expectedTotals: { pendingTotal: 2400, paidTotal: 1600 },
    },
  },

  overdueIndicator: {
    "pending event with past date is present in list (UI derives vencido)": {
      given: {
        event: { ...eventFixtures.pastBoleros, paymentStatus: "pending" },
        today: "2026-05-22",
      },
      when: "reports.payments is called",
      then: [
        "event appears in the returned list with paymentStatus='pending'",
        "event.date is in the past relative to today",
        // overdue badge is derived client-side: isBefore(parseISO(event.date), today)
      ],
    },
  },

  musicianVisibility: {
    "musician can see payment status on their own events (read-only)": {
      given: {
        event: { ...eventFixtures.todayAcoustic, paymentStatus: "paid" },
        user: userFixtures.musician,
      },
      then: [
        "event.paymentStatus is included in the event data returned to the musician",
        "no updatePaymentStatus action is available to the musician",
      ],
    },
  },
} as const
