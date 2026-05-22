/**
 * Hotels Feature Scenarios
 *
 * Source of truth for hotel management behavior.
 */

import { allHotels, hotelFixtures } from "@/specs/fixtures"

export const hotelsScenarios = {
  loading: {
    "loads hotels on demand": {
      given: "empty $hotels store",
      when: "loadHotels is triggered",
      then: ["loadHotelsFx is called", "$hotels is populated", "$activeHotels reflects active subset"],
      expectedCount: allHotels.length,
    },
  },

  crud: {
    "manager creates a hotel": {
      given: {
        input: {
          name: "Hotel Fiesta",
          email: "eventos@fiesta.mx",
          phone: "+52 998 555 1111",
          address: "Av. Tulum 123",
          city: "Cancún",
          state: "Quintana Roo",
          stateCode: "ROO",
          countryCode: "MX",
          country: "Mexico",
          postalCode: "77500",
          contactPerson: "Paola Rivera",
          isActive: true,
        },
      },
      when: "hotelCreated is triggered",
      then: ["new hotel is added to $hotels with generated id and createdAt"],
    },

    "hotel with non-Mexico country displays correct location label": {
      given: { hotel: "grandHyatt fixture (US, New York, NY)" },
      when: "hotel card is rendered",
      then: ["location displays as 'New York, New York, United States'"],
    },

    "manager toggles hotel active state": {
      given: { hotelId: hotelFixtures.iberostar.id },
      when: "hotelStatusToggled is triggered",
      then: ["matching hotel flips isActive"],
    },
  },
} as const
