from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        # drf-spectacular discovers custom generator extensions when their
        # module is imported during application startup.
        from . import schema  # noqa: F401
