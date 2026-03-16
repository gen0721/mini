import asyncpg
from config import DATABASE_URL

pool = None

async def init_db():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)

    async with pool.acquire() as conn:
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS notes(
            id SERIAL PRIMARY KEY,
            text TEXT,
            created TIMESTAMP DEFAULT NOW()
        );
        """)

async def save_note(text):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO notes(text) VALUES($1)", text
        )

async def get_notes():
    async with pool.acquire() as conn:
        return await conn.fetch("SELECT * FROM notes ORDER BY id DESC")
