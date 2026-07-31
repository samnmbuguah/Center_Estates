import math

EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    value = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(value))


def classify_geofence(point_lat, point_lon, site_lat, site_lon, radius_m):
    if point_lat is None or point_lon is None or site_lat is None or site_lon is None:
        return "unknown", None
    distance = haversine_m(point_lat, point_lon, site_lat, site_lon)
    if radius_m is None:
        return "unknown", distance
    return ("inside" if distance <= radius_m else "outside"), distance
