import psycopg2

conn = psycopg2.connect(host="localhost", port=5432, user="postgres", password="1234", dbname="postgres")
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname = 'CrashLens'")
if not cur.fetchone():
    cur.execute('CREATE DATABASE "CrashLens"')
    print("Database 'CrashLens' created.")
else:
    print("Database 'CrashLens' already exists.")
cur.close()
conn.close()
