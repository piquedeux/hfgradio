#!/usr/bin/env python3
"""Create a local environment once; never replace existing database secrets."""
from pathlib import Path
import secrets

folder = Path(__file__).resolve().parent
target = folder / '.env'
if target.exists():
    raise SystemExit('Existing .env preserved.')
content = (folder / '.env.example').read_text()
content += 'MYSQL_PASSWORD=' + secrets.token_urlsafe(32) + '\n'
content += 'MYSQL_ROOT_PASSWORD=' + secrets.token_urlsafe(32) + '\n'
with target.open('x') as env:
    target.chmod(0o600)
    env.write(content)
print('Created local .env with random database passwords.')
