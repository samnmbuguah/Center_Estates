/**
 * On-site weather service for Clerk of Works daily site diary.
 * Uses Open-Meteo free public meteorological API (no API key required).
 */

export interface SiteWeatherData {
  condition: "Sunny" | "Cloudy" | "Overcast" | "Light rain" | "Heavy rain" | "Windy" | "Hot" | "Dusty";
  tempC: number;
  precipitationMm: number;
  windSpeedKmH: number;
  hasRain: boolean;
  summary: string;
}

export function mapWmoToCondition(code: number, windKmH: number, tempC: number): SiteWeatherData["condition"] {
  if (windKmH >= 35) return "Windy";
  if (tempC >= 32) return "Hot";

  // WMO codes:
  // 0: Clear
  // 1-2: Partly cloudy
  // 3: Overcast
  // 51-55, 61-63: Drizzle / Light rain
  // 65+, 80-82, 95+: Heavy rain / Showers / Thunderstorm
  if (code === 0) return "Sunny";
  if (code === 1 || code === 2) return "Cloudy";
  if (code === 3) return "Overcast";
  if (code >= 51 && code <= 63) return "Light rain";
  if (code >= 65 || code >= 80) return "Heavy rain";

  return "Sunny";
}

export async function fetchSiteWeather(
  latitude: number,
  longitude: number,
  fetchFn: typeof fetch = fetch
): Promise<SiteWeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m`;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

  try {
    const res = await fetchFn(url, { signal: controller ? controller.signal : undefined });
    if (!res.ok) {
      throw new Error(`Weather service returned ${res.status}`);
    }
    const data = await res.json();
    const current = data.current;
    if (!current) {
      throw new Error("No current weather data available");
    }

    const tempC = Math.round(Number(current.temperature_2m) * 10) / 10;
    const precipMm = Math.round(Number(current.precipitation) * 10) / 10;
    const windKmH = Math.round(Number(current.wind_speed_10m) * 10) / 10;
    const code = Number(current.weather_code) || 0;

    const condition = mapWmoToCondition(code, windKmH, tempC);
    const hasRain = precipMm > 0 || condition === "Light rain" || condition === "Heavy rain";

    return {
      condition,
      tempC,
      precipitationMm: precipMm,
      windSpeedKmH: windKmH,
      hasRain,
      summary: `${tempC}°C · ${condition} · ${precipMm} mm rain · ${windKmH} km/h wind`,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
