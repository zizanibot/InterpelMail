# Copyright (C) 2026 zizanibot
# See LICENSE file for extended copyright information.
# This file is part of MyDeputeFr project from https://github.com/zizanibot/InterpelMail.
from __future__ import annotations

import asyncio
from pathlib import Path
import tempfile

from common.config import UPDATE_URL_DOWNLOAD_ACTEUR_ORGANE
from download.core import download_file_async, unzip_file_async
from common.logger import logger
from download.process import process_file_async


def show_error_on_exception(msg: str, exception: Exception) -> None:
    """Standard log output when an exception occur"""
    logger.error("Update failed : %s", msg)
    logger.error("Error : %s", str(exception))


async def update_acteur_organe(download_temp: Path, zip_temp: Path) -> None:
    """
    Update the data folder with fresh data from UPDATE_URL_DOWNLOAD_ACTEUR_ORGANE.
    """
    # Download File to zip download folder
    zip_file_acteur_organe: Path = download_temp / "data_acteur_organe.zip"
    try:
        await download_file_async(UPDATE_URL_DOWNLOAD_ACTEUR_ORGANE, zip_file_acteur_organe)
    except Exception as e:
        show_error_on_exception("download failed", e)
        raise e

    await asyncio.sleep(0.1)

    # Unzip File to zip temp folder
    zip_temp_acteur_organe: Path = zip_temp / "acteur_organe"
    try:
        await unzip_file_async(zip_file_acteur_organe, zip_temp_acteur_organe)
    except Exception as e:
        show_error_on_exception("unzipping failed", e)
        raise e
    
    temp_acteur: Path = zip_temp_acteur_organe / "json" / "acteur"
    temp_organe: Path = zip_temp_acteur_organe / "json" / "organe"
    try:
        await process_file_async(temp_acteur, temp_organe, zip_temp_acteur_organe)
    except Exception as e:
        show_error_on_exception("process failed", e)
        raise e


async def update_async() -> None:
    """
    Update the data folder with fresh data from 
    UPDATE_URL_DOWNLOAD_ACTEUR_ORGANE.
    """

    logger.info("=== Update starting ===")

    with tempfile.TemporaryDirectory() as download_temp, tempfile.TemporaryDirectory() as zip_temp:
        download_path: Path = Path(download_temp)
        zip_path: Path = Path(zip_temp)
        try:
            await update_acteur_organe(download_path, zip_path)
        except Exception as e:
            logger.error("=== Update acteur failed ===")
            raise e

    logger.info("=== Update success ===")


async def update() -> None:
    """Async version of update ot make it compatible with asyncio"""
    try:
        await update_async()
    except Exception:
        logger.error("=== Update failed ===")
