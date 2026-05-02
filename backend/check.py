from app.config import settings
url = settings.DATABASE_URL
# Extract and print each part
parts = url.split('@')
userpass = parts[0].replace('postgresql+psycopg://', '')
hostport = parts[1]
user = userpass.split(':')[0]
host = hostport.split(':')[0]
port = hostport.split(':')[1].split('/')[0]
print('User:    ', user)
print('Host:    ', host)
print('Port:    ', port)
