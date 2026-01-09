# Copyright (C) 2026 zizanibot
# See LICENSE file for extended copyright information.
# This file is part of MyDeputeFr project from https://github.com/zizanibot/InterpelMail.

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class MissingEnvException(Exception):
    """Exception raised when an environment variable is missing."""


def __load_env(name: str, default: str) -> str:
    """Loads an environment variable either from the environment or from a default generating function."""
    value = os.getenv(name)
    return value if value else default


# Updates
UPDATE_URL_DOWNLOAD_ACTEUR_ORGANE = __load_env(
    "UPDATE_URL_DOWNLOAD_ACTEUR_ORGANE",
    "https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/"
    "AMO10_deputes_actifs_mandats_actifs_organes.json.zip") # URL to update acteur et organe
UPDATE_PROGRESS_SECOND = int(__load_env("UPDATE_DOWNLOAD_PROGRESS_SECOND", "2")) # Download progress update in second, if 0 is disabled

DATA_FOLDER = Path(__load_env("DATA_FOLDER", "data"))  # Path to "data" folder

# Logs
LOG_PATH = __load_env("LOG_PATH", "interpelmail_update.log")  # Path to the log file
LOG_LEVEL = __load_env("LOG_LEVEL", "INFO").upper()  # Logging level (INFO, DEBUG...)
