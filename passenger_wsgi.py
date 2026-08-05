import os
import sys

# Add apps/backend to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "apps", "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# QM AI Agent API Key — enables AI-powered companion chat and task intelligence
os.environ.setdefault('OPENCODE_API_KEY', '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')
os.environ.setdefault('OPENAI_API_KEY', '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')

# Initialize PyMySQL driver compatibility if native mysqlclient is missing
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
