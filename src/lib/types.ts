export type Severity = 'ok' | 'marginal' | 'poor' | 'none';

/** One grid cell: severity marker, short label, optional detail line. */
export interface Cell {
  severity: Severity;
  label: string;
  detail?: string;
  /** Compact text for the days 3–5 grid. */
  short: string;
}

/** One forecast hour, in the spot's local time. Missing values are null. */
export interface Hour {
  /** Local wall-clock time, "YYYY-MM-DDTHH:00". */
  time: string;
  date: string;
  hour: number;
  precip: number | null;
  code: number | null;
  cape: number | null;
  wind: number | null;
  gust: number | null;
  dir: number | null;
  waveH: number | null;
  waveT: number | null;
  seaLevel: number | null;
  sst: number | null;
}

export interface DayInfo {
  date: string;
  /** Local "YYYY-MM-DDTHH:MM" or null (polar day/night). */
  sunrise: string | null;
  sunset: string | null;
}

export interface Forecast {
  latitude: number;
  longitude: number;
  timezone: string;
  utcOffsetSeconds: number;
  /** Epoch ms of the successful fetch. */
  fetchedAt: number;
  hours: Hour[];
  days: DayInfo[];
}

export interface Spot {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface Place {
  id: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}
