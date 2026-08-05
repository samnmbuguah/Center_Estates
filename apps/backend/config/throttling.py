from rest_framework.throttling import UserRateThrottle

class WriteRateThrottle(UserRateThrottle):
    scope = 'api_write'
