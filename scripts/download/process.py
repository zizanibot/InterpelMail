# Copyright (C) 2026 zizanibot
# See LICENSE file for extended copyright information.
# This file is part of MyDeputeFr project from https://github.com/zizanibot/InterpelMail.
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Self

from attrs import define
import aiofiles
import yaml

from common.config import DATA_FOLDER
from common.logger import logger
from download.core import read_file, read_files_from_directory


ELECTION = "\u00e9lections g\u00e9n\u00e9rales"


@define
class Deputy:
    ref: str
    last_name: str
    first_name: str
    email: str
    dep: str
    circo: str
    circo_code: str
    gp_abv: str

    @classmethod
    async def from_json(cls, data: Any, organe_folder: Path) -> Self:

        ref: str = data["acteur"]["uid"]["#text"]
        last_name: str = data["acteur"]["etatCivil"]["ident"]["nom"]
        first_name: str = data["acteur"]["etatCivil"]["ident"]["prenom"]
        mandats: List[Any] = data["acteur"]["mandats"]["mandat"]
        
        elec: Optional[Dict[str, Any]] = None
        gp_ref: str = ""
        gp_abv: str = ""
        dep: str = ""
        circo: str = ""
        circo_code: str = ""
        elec_found: bool = False
    
        for mandat in mandats:
            if not elec_found and "election" in mandat:
                elec = mandat["election"]
                if elec:
                    if isinstance(elec["causeMandat"], list) and ELECTION in elec["causeMandat"]:
                        elec_found = True
                    elif isinstance(elec["causeMandat"], str) and ELECTION == elec["causeMandat"].lower():
                        elec_found = True
            if not gp_ref and "typeOrgane" in mandat and "GP" == mandat["typeOrgane"]:
                gp_ref = mandat["organes"]["organeRef"]

        if elec:
            dep = elec["lieu"]["numDepartement"]
            circo = elec["lieu"]["numCirco"]

            if len(circo) == 1:
                circo = "0" + circo
            circo_code = f"{dep}{circo}"

        if gp_ref:
            organe_file = organe_folder / f"{gp_ref}.json"
            try:
                gp_data = await read_file(organe_file)
                gp_abv = gp_data["organe"]["libelleAbrege"]
            except OSError:
                logger.warning("Cannot find the organe file %s for %s", gp_ref, ref)
                gp_ref = ""
                gp_abv = ""
        else:
            logger.warning("%s does not have any organe reference.", ref)

        adresses: List[Any] = data["acteur"]["adresses"]["adresse"]
        email = ""
        for adresse in adresses:
            if adresse["@xsi:type"] == "AdresseMail_Type":
                email = adresse["valElec"]

        return cls(
            ref=ref,
            last_name=last_name,
            first_name=first_name,
            email=email,
            dep=dep,
            circo=circo,
            circo_code=circo_code,
            gp_abv=gp_abv,
        )
    

    def to_yaml_dict(self) -> Dict[str, Any]:
        return {
            "ref": self.ref,
            "last_name": self.last_name,
            "first_name": self.first_name,
            "email": self.email,
            "gp_abv": self.gp_abv,
        }


async def process_file_async(acteur_folder: Path, organe_folder: Path, export_path: Path) -> None:
    deputies: List[Deputy] = []

    async for data in read_files_from_directory(acteur_folder):
        deputies.append(await Deputy.from_json(data, organe_folder))

    deputies_dict: Dict[str, Any]  = {
        deputy.circo_code: deputy.to_yaml_dict()
        for deputy in deputies
    }

    output: Dict[str, Any] = {
        "metadata": {
            "last_updated": datetime.now().isoformat(),
            "count": len(deputies_dict)
        },
        "deputies": deputies_dict
    }

    async with aiofiles.open(DATA_FOLDER / "deputies.yaml", mode="w+", encoding="utf-8") as f:
        await f.write(yaml.dump(output))
        await f.flush()

    logger.info("Process done")