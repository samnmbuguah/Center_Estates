from rest_framework.throttling import UserRateThrottle

class WriteRateThrottle(UserRateThrottle):
    scope = 'api_write'


class QMChatRateThrottle(UserRateThrottle):
    """Protect the metered AI provider while keeping normal ERP reads fast."""

    scope = 'qm_chat'
