import asyncpg
from config import DATABASE_URL

pool = None

async def init_db():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)

    async with pool.acquire() as conn:
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks(
            id SERIAL PRIMARY KEY,
            text TEXT,
            done BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS goals(
            id SERIAL PRIMARY KEY,
            text TEXT
        );

        CREATE TABLE IF NOT EXISTS facts(
            id SERIAL PRIMARY KEY,
            info TEXT
        );

        CREATE TABLE IF NOT EXISTS logs(
            id SERIAL PRIMARY KEY,
            action TEXT,
            created TIMESTAMP DEFAULT NOW()
        );
        """)
