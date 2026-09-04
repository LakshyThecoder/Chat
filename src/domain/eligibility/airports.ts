export interface AirportCoord {
  iata: string;
  name: string;
  lat: number;
  lon: number;
  region: "EU" | "UK" | "US" | "OTHER";
}

/** Compact IATA table for statutory-distance math. Not a live aviation database. */
export const AIRPORTS: Record<string, AirportCoord> = {
  CDG: { iata: "CDG", name: "Paris Charles de Gaulle", lat: 49.0097, lon: 2.5479, region: "EU" },
  ORY: { iata: "ORY", name: "Paris Orly", lat: 48.7233, lon: 2.3794, region: "EU" },
  FCO: { iata: "FCO", name: "Rome Fiumicino", lat: 41.8003, lon: 12.2389, region: "EU" },
  AMS: { iata: "AMS", name: "Amsterdam Schiphol", lat: 52.3105, lon: 4.7683, region: "EU" },
  BER: { iata: "BER", name: "Berlin Brandenburg", lat: 52.3667, lon: 13.5033, region: "EU" },
  FRA: { iata: "FRA", name: "Frankfurt", lat: 50.0379, lon: 8.5622, region: "EU" },
  MUC: { iata: "MUC", name: "Munich", lat: 48.3537, lon: 11.775, region: "EU" },
  MAD: { iata: "MAD", name: "Madrid Barajas", lat: 40.4983, lon: -3.5676, region: "EU" },
  BCN: { iata: "BCN", name: "Barcelona", lat: 41.2974, lon: 2.0833, region: "EU" },
  LIN: { iata: "LIN", name: "Milan Linate", lat: 45.4451, lon: 9.2767, region: "EU" },
  LHR: { iata: "LHR", name: "London Heathrow", lat: 51.47, lon: -0.4543, region: "UK" },
  LGW: { iata: "LGW", name: "London Gatwick", lat: 51.1537, lon: -0.1821, region: "UK" },
  MAN: { iata: "MAN", name: "Manchester", lat: 53.3537, lon: -2.275, region: "UK" },
  EDI: { iata: "EDI", name: "Edinburgh", lat: 55.95, lon: -3.3725, region: "UK" },
  JFK: { iata: "JFK", name: "New York JFK", lat: 40.6413, lon: -73.7781, region: "US" },
  EWR: { iata: "EWR", name: "Newark", lat: 40.6895, lon: -74.1745, region: "US" },
  BOS: { iata: "BOS", name: "Boston Logan", lat: 42.3656, lon: -71.0096, region: "US" },
  LAX: { iata: "LAX", name: "Los Angeles", lat: 33.9416, lon: -118.4085, region: "US" },
  SFO: { iata: "SFO", name: "San Francisco", lat: 37.6213, lon: -122.379, region: "US" },
  ORD: { iata: "ORD", name: "Chicago O'Hare", lat: 41.9742, lon: -87.9073, region: "US" },
};

const EARTH_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function lookupAirport(iata: string | null | undefined): AirportCoord | null {
  if (!iata) return null;
  return AIRPORTS[iata.trim().toUpperCase()] ?? null;
}

/** Great-circle distance in whole kilometres. */
export function greatCircleKm(originIata: string | null, destinationIata: string | null): number | null {
  const origin = lookupAirport(originIata);
  const destination = lookupAirport(destinationIata);
  if (!origin || !destination) return null;

  const dLat = toRad(destination.lat - origin.lat);
  const dLon = toRad(destination.lon - origin.lon);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_KM * c);
}

export function regionForAirport(iata: string | null | undefined): "EU" | "UK" | "US" | "OTHER" {
  return lookupAirport(iata)?.region ?? "OTHER";
}
