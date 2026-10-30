import os

import whitenoise.storage as whitenoise_storage
from whitenoise.storage import CompressedManifestStaticFilesStorage


class CappedCompressedManifestStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """Whitenoise storage with a bounded compression worker pool.

    Shared cPanel/LVE accounts can enforce a low per-account thread limit. The
    default ThreadPoolExecutor size (derived from the host CPU count) can exceed
    that limit and make collectstatic fail with "can't start new thread".
    """

    def compress_files(self, paths):
        original_executor = whitenoise_storage.ThreadPoolExecutor
        worker_count = max(1, int(os.environ.get('WHITENOISE_COMPRESS_WORKERS', '4')))

        class CappedThreadPoolExecutor(original_executor):
            def __init__(self, max_workers=None, *args, **kwargs):
                super().__init__(max_workers=worker_count, *args, **kwargs)

        whitenoise_storage.ThreadPoolExecutor = CappedThreadPoolExecutor
        try:
            yield from super().compress_files(paths)
        finally:
            whitenoise_storage.ThreadPoolExecutor = original_executor
