import { describe, expect, it, vi } from "vitest";
import { fetchSiteWeather, mapWmoToCondition } from "../weather";

describe("weatherService", () => {
  it("maps WMO weather codes correctly", () => {
    expect(mapWmoToCondition(0, 10, 22)).toBe("Sunny");
    expect(mapWmoToCondition(1, 10, 22)).toBe("Cloudy");
    expect(mapWmoToCondition(3, 10, 22)).toBe("Overcast");
    expect(mapWmoToCondition(61, 10, 20)).toBe("Light rain");
    expect(mapWmoToCondition(65, 10, 18)).toBe("Heavy rain");
    expect(mapWmoToCondition(0, 40, 20)).toBe("Windy");
    expect(mapWmoToCondition(0, 10, 35)).toBe("Hot");
  });

  it("fetches site weather and formats summary", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 16.7,
          precipitation: 0.0,
          weather_code: 3,
          wind_speed_10m: 12.7,
        },
      }),
    });

    const result = await fetchSiteWeather(-1.332, 36.758, mockFetch as any);
    expect(result.tempC).toBe(16.7);
    expect(result.condition).toBe("Overcast");
    expect(result.hasRain).toBe(false);
    expect(result.summary).toContain("16.7°C · Overcast");
  });

  it("detects rain when precipitation is positive", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 14.2,
          precipitation: 3.5,
          weather_code: 61,
          wind_speed_10m: 8.0,
        },
      }),
    });

    const result = await fetchSiteWeather(-1.332, 36.758, mockFetch as any);
    expect(result.hasRain).toBe(true);
    expect(result.precipitationMm).toBe(3.5);
    expect(result.condition).toBe("Light rain");
  });
});
