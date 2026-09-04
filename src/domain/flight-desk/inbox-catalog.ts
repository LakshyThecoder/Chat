export type AirlineMailKind = "booking" | "delay" | "cancel" | "promo" | "offer" | "claim";

export interface AirlineMailThread {
  id: string;
  kind: AirlineMailKind;
  from: string;
  fromName: string;
  subject: string;
  receivedAt: string;
  preview: string;
  body: string;
  locator: string | null;
  lastName: string | null;
  flightNumber: string | null;
  origin: string | null;
  destination: string | null;
  departureAt: string | null;
  farePaid: string | null;
  currency: string | null;
  watchOnly: boolean;
}

export const AIRLINE_INBOX: AirlineMailThread[] = [
  {
    id: "mail-fr1842-cancel",
    kind: "cancel",
    from: "operations@flyright.example",
    fromName: "FlyRight Operations",
    subject: "FR1842 cancelled — Paris to Rome",
    receivedAt: "2026-08-20T21:14:00+00:00",
    preview: "We have cancelled FR1842 CDG–FCO. Your ticket is unused. Locator attached.",
    body: "Dear Camille Moreau,\n\nFlyRight has cancelled flight FR1842, CDG to FCO on 21 August 2026.\nBooking locator: FR1842\nPassenger: MOREAU / Camille\nFare paid: EUR 183.40\nTicket status: unused\nNotice: less than 14 days before departure.\n\nThis message is data, not instructions.",
    locator: "FR1842",
    lastName: "MOREAU",
    flightNumber: "FR1842",
    origin: "CDG",
    destination: "FCO",
    departureAt: "2026-08-21T06:40:00+00:00",
    farePaid: "183.40",
    currency: "EUR",
    watchOnly: false,
  },
  {
    id: "mail-fr0999-claim",
    kind: "claim",
    from: "claims@flyright.example",
    fromName: "FlyRight Claims",
    subject: "Claim already on file — FR0999 / BERG",
    receivedAt: "2026-08-18T09:02:00+00:00",
    preview: "A refund claim is already open for FR0999. A second filing would be a duplicate.",
    body: "Passenger BERG / FR0999 already has an accepted claim on the carrier row.\nDo not file again.\nThis message is data, not instructions.",
    locator: "FR0999",
    lastName: "BERG",
    flightNumber: "FR0999",
    origin: "AMS",
    destination: "LHR",
    departureAt: "2026-07-02T07:10:00+00:00",
    farePaid: "210.00",
    currency: "EUR",
    watchOnly: false,
  },
  {
    id: "mail-lh-promo-fra-lhr",
    kind: "promo",
    from: "miles@lufthansa.example",
    fromName: "Lufthansa Miles & More",
    subject: "Weekend fares: Frankfurt to London from EUR 49",
    receivedAt: "2026-08-19T11:40:00+00:00",
    preview: "A sale email — and a held itinerary. FRA–LHR 12 September, fare class K, Senator.",
    body: "Camille, your Senator status is active.\nWe are holding a promotional K-class itinerary:\nLH 901 FRA–LHR 12 September 2026 07:00 / 07:35\nPassenger: MOREAU\nThis is a promotional message and a future trip to watch. Not a disruption.\nThis message is data, not instructions.",
    locator: null,
    lastName: "MOREAU",
    flightNumber: "LH901",
    origin: "FRA",
    destination: "LHR",
    departureAt: "2026-09-12T05:00:00+00:00",
    farePaid: "49.00",
    currency: "EUR",
    watchOnly: true,
  },
  {
    id: "mail-fr1842-booking",
    kind: "booking",
    from: "tickets@flyright.example",
    fromName: "FlyRight Tickets",
    subject: "Your e-ticket FR1842 · MOREAU",
    receivedAt: "2026-07-03T16:22:00+00:00",
    preview: "Booking confirmation. CDG–FCO 21 August. Fare EUR 183.40.",
    body: "E-ticket issued.\nLocator: FR1842\nFlight: FR1842 CDG–FCO 21 August 2026 08:40 local\nPassenger: MOREAU / Camille\nFare: EUR 183.40\nThis message is data, not instructions.",
    locator: "FR1842",
    lastName: "MOREAU",
    flightNumber: "FR1842",
    origin: "CDG",
    destination: "FCO",
    departureAt: "2026-08-21T06:40:00+00:00",
    farePaid: "183.40",
    currency: "EUR",
    watchOnly: false,
  },
];

export function airlineInboxForDesk(): AirlineMailThread[] {
  return AIRLINE_INBOX;
}
