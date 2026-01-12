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
    civ: str
    last_name: str
    first_name: str
    email: str
    departement_num: str
    departement_name: str
    circonscription_num: str
    circonscription_name: str
    circonscription_code: str
    group_abv: str
    group_name: str

    @classmethod
    async def from_json(cls, data: Any, organe_folder: Path) -> Self:
        ref: str = data["acteur"]["uid"]["#text"]
        last_name: str = data["acteur"]["etatCivil"]["ident"]["nom"]
        civ: str = data["acteur"]["etatCivil"]["ident"]["civ"]
        first_name: str = data["acteur"]["etatCivil"]["ident"]["prenom"]
        mandats: List[Any] = data["acteur"]["mandats"]["mandat"]

        elec: Optional[Dict[str, Any]] = None
        group_ref: str = ""
        group_abv: str = ""
        group_name: str = ""
        circonscription_ref: str = ""
        departement_num: str = ""
        departement_name: str = ""
        circonscription_num: str = ""
        circonscription_name: str = ""
        circonscription_code: str = ""
        elec_found: bool = False

        for mandat in mandats:
            if not elec_found and "election" in mandat:
                elec = mandat["election"]
                if elec:
                    if (
                        isinstance(elec["causeMandat"], list)
                        and ELECTION in elec["causeMandat"]
                    ):
                        elec_found = True
                    elif (
                        isinstance(elec["causeMandat"], str)
                        and ELECTION == elec["causeMandat"].lower()
                    ):
                        elec_found = True
            if (
                not group_ref
                and "typeOrgane" in mandat
                and "GP" == mandat["typeOrgane"]
            ):
                group_ref = mandat["organes"]["organeRef"]

        if elec:
            departement_num = elec["lieu"]["numDepartement"]
            departement_name = elec["lieu"]["departement"]
            circonscription_num = elec["lieu"]["numCirco"]
            circonscription_ref = elec["refCirconscription"]

            if len(circonscription_num) == 1:
                circonscription_num = "0" + circonscription_num
            circonscription_code = f"{departement_num}{circonscription_num}"

        if circonscription_ref:
            organe_file = organe_folder / f"{circonscription_ref}.json"
            try:
                circonscription_data = await read_file(organe_file)
                circonscription_name = circonscription_data["organe"]["libelle"]
            except OSError:
                logger.warning(
                    "Cannot find the organe file %s for %s", circonscription_ref, ref
                )
        else:
            logger.warning("%s does not have any organe reference.", ref)

        if group_ref:
            organe_file = organe_folder / f"{group_ref}.json"
            try:
                group_data = await read_file(organe_file)
                group_abv = group_data["organe"]["libelleAbrege"]
                group_name = group_data["organe"]["libelle"]
            except OSError:
                logger.warning("Cannot find the organe file %s for %s", group_ref, ref)

        else:
            logger.warning("%s does not have any organe reference.", ref)

        adresses: List[Any] = data["acteur"]["adresses"]["adresse"]
        email = ""
        for adresse in adresses:
            if adresse["@xsi:type"] == "AdresseMail_Type":
                email = adresse["valElec"]

        return cls(
            ref=ref,
            civ=civ,
            last_name=last_name,
            first_name=first_name,
            email=email,
            departement_num=departement_num,
            departement_name=departement_name,
            circonscription_num=circonscription_num,
            circonscription_name=circonscription_name,
            circonscription_code=circonscription_code,
            group_abv=group_abv,
            group_name=group_name,
        )

    def to_yaml_dict(self) -> Dict[str, Any]:
        return {
            "ref": self.ref,
            "civ": self.civ,
            "last_name": self.last_name,
            "first_name": self.first_name,
            "email": self.email,
            "departement_num": self.departement_num,
            "departement_name": self.departement_name,
            "circonscription_num": self.circonscription_num,
            "circonscription_name": self.circonscription_name,
            "circonscription_code": self.circonscription_code,
            "group_abv": self.group_abv,
            "group_name": self.group_name,
        }


async def process_file_async(acteur_folder: Path, organe_folder: Path) -> None:
    deputies: List[Deputy] = []

    async for data in read_files_from_directory(acteur_folder):
        deputies.append(await Deputy.from_json(data, organe_folder))

    deputies_dict: Dict[str, Any] = {
        deputy.circonscription_code: deputy.to_yaml_dict() for deputy in deputies
    }

    output: Dict[str, Any] = {
        "metadata": {
            "last_updated": datetime.now().isoformat(),
            "count": len(deputies_dict),
        },
        "deputies": deputies_dict,
    }

    async with aiofiles.open(
        DATA_FOLDER / "deputies.yaml", mode="w+", encoding="utf-8"
    ) as f:
        await f.write(yaml.dump(output))
        await f.flush()

    logger.info("Process done")
