"""One-shot telemetry schema bootstrap entrypoint."""

from __future__ import annotations

import asyncio
import logging

from db import close_pool, get_pool
from schema import assert_schema_ready, bootstrap_schema


async def run_bootstrap() -> None:
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            await bootstrap_schema(conn)
            await assert_schema_ready(conn)
    finally:
        await close_pool()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_bootstrap())


if __name__ == "__main__":
    main()
