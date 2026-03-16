import aiohttp

async def search_info(query):
    async with aiohttp.ClientSession() as s:
        url = f"https://api.duckduckgo.com/?q={query}&format=json"
        async with s.get(url) as r:
            data = await r.json()
            return data.get("AbstractText", "Ничего не найдено")
