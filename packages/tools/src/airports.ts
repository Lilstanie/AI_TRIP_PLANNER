/**
 * City → IATA airport code, for providers that will not take a city name.
 *
 * SerpApi's Google Flights engine rejects free text: `departure_id` must be a
 * 3-letter code or a Google Knowledge Graph id. This table is the project's
 * answer to "the traveller typed a city".
 *
 * It is deliberately a fixed table rather than a lookup service: the mapping is
 * a product decision, not a fact. A city with several airports resolves to the
 * one this product means (London → LHR, not LGW/STN), and a city with none
 * resolves to its nearest major hub, which is a judgement that belongs in
 * source control where it can be reviewed and tested.
 *
 * Unknown cities throw rather than guess — a wrong airport silently prices the
 * wrong flight, and nothing downstream would catch it.
 */
const AIRPORTS: Record<string, string> = {
  // Australia & New Zealand
  sydney: "SYD",
  melbourne: "MEL",
  brisbane: "BNE",
  perth: "PER",
  adelaide: "ADL",
  "gold coast": "OOL",
  canberra: "CBR",
  hobart: "HBA",
  darwin: "DRW",
  cairns: "CNS",
  auckland: "AKL",
  wellington: "WLG",
  christchurch: "CHC",
  queenstown: "ZQN",

  // East & Southeast Asia
  tokyo: "NRT",
  osaka: "KIX",
  kyoto: "KIX", // No airport of its own; Kansai is the nearest major hub.
  nagoya: "NGO",
  sapporo: "CTS",
  fukuoka: "FUK",
  okinawa: "OKA",
  seoul: "ICN",
  busan: "PUS",
  beijing: "PEK",
  shanghai: "PVG",
  guangzhou: "CAN",
  shenzhen: "SZX",
  chengdu: "CTU",
  "hong kong": "HKG",
  hongkong: "HKG",
  taipei: "TPE",
  singapore: "SIN",
  bangkok: "BKK",
  "chiang mai": "CNX",
  phuket: "HKT",
  "kuala lumpur": "KUL",
  jakarta: "CGK",
  bali: "DPS",
  denpasar: "DPS",
  manila: "MNL",
  hanoi: "HAN",
  "ho chi minh city": "SGN",
  saigon: "SGN",
  "siem reap": "SAI",

  // South & West Asia
  delhi: "DEL",
  "new delhi": "DEL",
  mumbai: "BOM",
  bengaluru: "BLR",
  bangalore: "BLR",
  dubai: "DXB",
  "abu dhabi": "AUH",
  doha: "DOH",
  istanbul: "IST",

  // Europe
  london: "LHR",
  paris: "CDG",
  amsterdam: "AMS",
  frankfurt: "FRA",
  munich: "MUC",
  berlin: "BER",
  zurich: "ZRH",
  vienna: "VIE",
  prague: "PRG",
  rome: "FCO",
  milan: "MXP",
  venice: "VCE",
  barcelona: "BCN",
  madrid: "MAD",
  lisbon: "LIS",
  porto: "OPO",
  dublin: "DUB",
  edinburgh: "EDI",
  copenhagen: "CPH",
  stockholm: "ARN",
  oslo: "OSL",
  helsinki: "HEL",
  reykjavik: "KEF",
  athens: "ATH",
  budapest: "BUD",
  warsaw: "WAW",

  // Americas
  "new york": "JFK",
  nyc: "JFK",
  "los angeles": "LAX",
  "san francisco": "SFO",
  seattle: "SEA",
  chicago: "ORD",
  boston: "BOS",
  "washington dc": "IAD",
  miami: "MIA",
  "las vegas": "LAS",
  honolulu: "HNL",
  toronto: "YYZ",
  vancouver: "YVR",
  montreal: "YUL",
  "mexico city": "MEX",
  "sao paulo": "GRU",
  "rio de janeiro": "GIG",
  "buenos aires": "EZE",
  lima: "LIM",
  santiago: "SCL",

  // Africa & Middle East
  cairo: "CAI",
  "cape town": "CPT",
  johannesburg: "JNB",
  nairobi: "NBO",
  marrakech: "RAK",
  "tel aviv": "TLV",
};

/** Already an airport code, or a Google Knowledge Graph id SerpApi takes as-is. */
const PASSTHROUGH = /^[A-Z]{3}$|^\/[mg]\//;

/** The code a provider needs, or undefined when this project has no mapping. */
export function airportCodeFor(city: string): string | undefined {
  const trimmed = city.trim();
  if (PASSTHROUGH.test(trimmed)) return trimmed;
  // Normalise punctuation and spacing so "Ho Chi Minh  City" and
  // "ho-chi-minh city" reach the same entry.
  const key = trimmed
    .toLowerCase()
    .replace(/[.,'’]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return AIRPORTS[key];
}

/** Every city this project can currently price a flight for. */
export const knownAirportCities = () => Object.keys(AIRPORTS).sort();
