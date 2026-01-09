# Copyright (C) 2026 zizanibot
# See LICENSE file for extended copyright information.
# This file is part of MyDeputeFr project from https://github.com/zizanibot/InterpelMail.
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, AsyncIterator, Optional
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import aiohttp
import aiofiles

from common.config import UPDATE_PROGRESS_SECOND
from common.logger import logger


def show_progress(
        p_url: str,
        p_content_length: Optional[str],
        p_chunk_size: int,
        p_nb_chunks_wrote: int,
        p_last_show: Optional[datetime]) -> datetime:
    """Show progress of download in log"""
    now = datetime.now()
    update_second = UPDATE_PROGRESS_SECOND
    if not p_last_show or (update_second != 0 and (now - p_last_show).seconds > update_second):
        size_wrote_chunks_mb = ((p_chunk_size * p_nb_chunks_wrote) / 1024) / 1024
        ct_length_mb = (int(p_content_length) / 1024) / 1024 if p_content_length else "???"
        logger.info("Download %s : %.2f MB / %.2f MB",
                   os.path.basename(p_url),
                   size_wrote_chunks_mb,
                   ct_length_mb)
        return now
    return p_last_show


async def download_file_async(url: str, file_path: Path) -> None:
    """
    Download a file from url to file path asynchronously.
    Progress will show every DOWNLOAD_UPDATE_SECOND seconds (default 2).
    To hide progress set DOWNLOAD_UPDATE_SECOND to 0.

    Parameters:
        url (str) : The url of file to download.
        file_path (Path) : 
            The path where the file must write. 
            Path must be writable and the parents folder must exist.
    """
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url) as response:
                response.raise_for_status()
                content_length: str = response.headers.get("content-length", "0")

                chunk_size: int = 4096
                nb_chunks_wrote: int = 0
                last_show: Optional[datetime] = None
                with open(file_path, "wb") as f:
                    logger.info("Downloading %s to %s", url, file_path)
                    while True:
                        chunk = await response.content.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        nb_chunks_wrote += 1
                        last_show = show_progress(url, content_length,
                                                  chunk_size, nb_chunks_wrote, last_show)
        except (aiohttp.ClientConnectionError, aiohttp.InvalidURL):
            logger.error("Connection error from %s", url)
            raise
        except aiohttp.ClientResponseError:
            logger.error("Invalid response from %s", url)
            raise
        except FileNotFoundError:
            logger.error("Invalid path %s", file_path)
            raise

    logger.info("Download done")


def unzip_file(path: Path, dst_folder: Path) -> None :
    """
    Unzip a zip file to destination folder.

    Parameters:
        path (Path): The path of the zip file.
        dst_folder (Path) : The path of the destination folder.
    """
    logger.info("Unzipping file %s to %s", path, dst_folder)
    try:
        with zipfile.ZipFile(path, "r") as zip_ref:
            zip_ref.extractall(dst_folder)
    except zipfile.BadZipFile:
        logger.error("%s is not a correct Zip File.", path)
        raise
    except FileNotFoundError:
        logger.error("%s does not exist.", path)
        raise
    logger.info("Unzip done")


async def unzip_file_async(path: Path, dst_folder: Path) -> None:
    """
    Unzip a zip file to destination folder asynchronously.

    Parameters:
        path (Path): The path of the zip file.
        dst_folder (Path) : The path of the destination folder.
    """
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor() as pool:
        await loop.run_in_executor(
            pool,
            unzip_file, path, dst_folder
        )


async def read_file(file_path: Path) -> Any:
    async with aiofiles.open(file_path, mode="r", encoding="utf-8") as f:
        contents = await f.read()
        return json.loads(contents)


async def read_files_from_directory(directory: Path) -> AsyncIterator[Any]:
    """
    Reads and yields the Any data of each file in a given directory.
    Skips files that cannot be read or parsed.

    Parameters:
        directory (Path): The directory containing the files to be read.

    Yields:
        Any: The parsed Any data from each file.
    """
    for file in os.listdir(directory):
        file_path = directory / file
        try:
            yield await read_file(file_path)
        except (OSError, json.JSONDecodeError) as e:
            logger.error("Error reading %s: %s", file, e)
            continue