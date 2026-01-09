import asyncio

from download.update import update


if __name__ == "__main__":
    asyncio.run(update())