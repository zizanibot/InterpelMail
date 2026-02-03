let circonscriptionsData = null;

let selectedAddress = null;
let selectedElectedKey = null;
let selectedElected = [];
let locationInformation = null;
let institutionInformation = null;

let suggestionsTimer = null;

const electedType = {}
const addressData = {};
let departements = null;

document.addEventListener("DOMContentLoaded", async function() {

	try {
		const response = await fetch("geojson/circonscriptions-legislatives-p20.geojson");
		circonscriptionsData = await response.json();
		console.log("Circonscriptions loaded:", circonscriptionsData.features.length);
	} catch (error) {
		console.error("Error loading circonscriptions:", error);
		alert("Erreur lors du chargement des données des circonscriptions");
	}

	const departementsUnsorted = new Map();
	// construct additional maps for selection
	Object.values(window.siteData.deputies).forEach(deputy => {
		if (deputy.departement_num && !departementsUnsorted.get(deputy.departement_num)) {
			departementsUnsorted.set(deputy.departement_num, deputy.departement_name);
		}
	});
	// sort it
	departements = new Map([...departementsUnsorted].sort((a, b) => a[1].localeCompare(b[1])));

	electedType["deputies"] = window.siteData.deputies;
	electedType["senators"] = window.siteData.senators;
	electedType["europals"] = window.siteData.europals;
	selectedElectedKey = "deputies";

	const deps_select = document.getElementById("deps-select");
	departements
		.forEach((name, num, _) => {
			const option = document.createElement("option");
			option.value = num;
			option.textContent = `${name} - ${num}`;
			deps_select.appendChild(option);
		}
		);

	// Show campaign info when campaigns code selected
	document.getElementById("campaign").addEventListener("change", function() {
		setCampaign(this.value);
	});

	// Show selection method
	document.querySelectorAll(".tab-headers").forEach(header => {
		const children = header.children;
		for (var i = 0; i < children.length; i++) {
			const btn = children[i];
			btn.addEventListener("click", () => {
				resetData();
				[...children].forEach(b => b.classList.remove("active"));
				btn.classList.add("active");

				const content = document.getElementById(btn.dataset.tab);
				if (content) {
					document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
					content.classList.add("active");
				}

				if (btn.dataset.value) {
					selectedElectedKey = btn.dataset.value;
				}
			});
		}
	});

	// Show elected info
	document.getElementById("find-elected-address").addEventListener("click", findElectedFromAddress);
	document.getElementById("find-elected-subdivision").addEventListener("click", function() {
		resetData();
		findElectedFromSubdivision(deps_select.value);
	});

	document.getElementById("address").addEventListener("input", function(e) {

		const suggestions = document.getElementById("suggestions");
		resetData();
		clearTimeout(suggestionsTimer);

		if (e.target.value.length < 5) {
			suggestions.style.display = "none";
			return;
		}

		suggestions.style.display = "block";
		suggestions.className = "loading";
		suggestions.textContent = "Recherche...";

		suggestionsTimer = setTimeout(async () => {
			try {
				const searchedValue = document.getElementById("address").value.trim();
				const results = await findAddresses(searchedValue);
				displaySuggestions(results, suggestions);
			} catch (error) {
				const no_result = document.createElement("div");
				no_result.className = "no-results";
				no_result.textContent = "Erreur lors de la recherche d'adresses";
				console.error("Error:", error);
			}
		}, 500);
	});

	// hide suggestions
	document.addEventListener("click", (e) => {
		if (!e.target.closest("address-form")) {
			document.getElementById("suggestions").style.display = "none";
		}
	});

	// Send email
	document.getElementById("send-email").addEventListener("click", sendEmail);
});

function resetData() {

	document.getElementById("elected-info").style.display = "none";
	document.getElementById("send-email").style.display = "none";
	selectedElected = null;
	locationInformation = null;

	const elected_filter = document.getElementById("elected-filter");
	while (elected_filter.lastElementChild) {
		elected_filter.removeChild(elected_filter.lastElementChild);
	}

}

function setCampaign(campaignKey) {

	const campaignInfo = document.getElementById("campaign-info");
	const desc = document.getElementById("desc");

	if (campaignKey) {
		const campaign = window.siteData.campaigns[campaignKey];
		campaignInfo.textContent = `${campaign.title} -- ${campaign.subject}`;
		desc.innerHTML = campaign.description;
		desc.style.display = "block";
	} else {
		desc.style.display = "none";
		campaignInfo.textContent = "";
	}
}

async function findAddresses(input) {

	try {
		const geocodeUrl = `https://data.geopf.fr/geocodage/search/?q=${encodeURIComponent(input)}&limit=5`;
		const geocodeResponse = await fetch(geocodeUrl);
		const geocodeData = await geocodeResponse.json();

		return geocodeData.features;
	} catch (error) {
		console.error("Error:", error);
	}
}

function displaySuggestions(results, suggestions) {

	Object.keys(addressData).forEach(key => delete addressData[key]);
	if (results.length == 0) {
		const no_result = document.createElement("div");
		no_result.className = "no-results";
		no_result.textContent = "Aucune adresse trouvée";
		suggestions.replaceChildren(no_result);
		return;
	}

	results.forEach((elt, index) => {
		addressData[index] = {
			address: elt.properties.label,
			coord: elt.geometry.coordinates,
		}
	});

	suggestions.replaceChildren(
		...results.map(
			(elt, index) => {
				const suggestion_item = document.createElement("div");
				suggestion_item.className = "suggestion-item";
				suggestion_item.dataset.id = index;
				suggestion_item.textContent = elt.properties.label;
				return suggestion_item;
			}
		)
	);

	document.querySelectorAll(".suggestion-item").forEach(elt => {
		elt.addEventListener("click", () => {
			selectAddress(elt.dataset.id);
		});
	});
}

function selectAddress(id) {

	selectedAddress = addressData[id];

	if (!selectedAddress) {
		return;
	}
	const input = document.getElementById("address");
	input.value = selectedAddress.address;
	document.getElementById("suggestions").style.display = "none";
}

function displayElected(electeds) {

	const electedInfo = document.getElementById("elected-info");
	const sendButton = document.getElementById("send-email");

	const strong = document.createElement("strong");

	let stringBuilder = "";
	if (electeds.length == 1) {
		stringBuilder += "Votre élu.e est :";

	} else {
		stringBuilder += "Vos élu.es sont :"
	}
	strong.textContent = stringBuilder;
	electedInfo.replaceChildren(strong);
	electedInfo.insertAdjacentElement("beforeend", document.createElement("br"));
	electeds.forEach(elected => {
		electedInfo.insertAdjacentText("beforeend", `${elected.first_name} ${elected.last_name} (`);
		electedInfo.insertAdjacentElement("beforeend", createTooltipForGroup(elected.group_abv, elected.group_name));
		electedInfo.insertAdjacentText("beforeend", ")");
		electedInfo.insertAdjacentElement("beforeend", document.createElement("br"));
	});

	selectedElected = electeds;
	electedInfo.style.display = "block";
	sendButton.style.display = "block";
}

async function findElectedFromAddress() {

	if (!selectedAddress) {
		alert("Veuillez sélectionner une adresse valide.");
		return;
	}

	if (!circonscriptionsData) {
		alert("Les données des circonscriptions ne sont pas encore chargées");
		return;
	}

	try {
		console.log(selectedAddress);
		const coordinates = selectedAddress.coord;
		console.log("Coordinates [lon, lat] found:", coordinates);

		const point = turf.point(coordinates);
		let foundDivision = null;

		for (const feature of circonscriptionsData.features) {
			if (turf.booleanPointInPolygon(point, feature)) {
				foundDivision = feature;
				break;
			}
		}

		if (!foundDivision) {
			throw new Error("Division administrative non trouvée pour cette adresse");
		}

		let code = null;
		let electeds = null;
		const allElecteds = electedType[selectedElectedKey];

		switch (selectedElectedKey) {
			case "deputies":
				code = foundDivision.properties.codeCirconscription;
				electeds = [allElecteds[code]];
				if (!electeds || electeds.length == 0) {
					throw new Error(`Député.e non trouvé.e pour la circonscription ${code}`);
				}
				locationInformation = `la ${electeds[0].circonscription_name}`;
				institutionInformation = "l'assemblée nationale";
				break;
			case "senators":
				code = foundDivision.properties.codeDepartement;
				electeds = Object.values(allElecteds).filter(elected => elected.departement_num == code);
				if (!electeds || electeds.length == 0) {
					throw new Error(`Sénateur.rices non trouvé.es pour le département ${code}`);
				}
				locationInformation = electeds[0].departement_name;
				institutionInformation = "le sénat";
				break;
			case "europals":
				break;

			default:
				throw new Error(`Invalid key ${selectedElectedKey}`);
		}

		if (electeds.length > 1) createGroupFilterForDepartement(electeds, code);
		displayElected(electeds);
	} catch (error) {
		console.error("Error:", error);
		alert(`Erreur: ${error.message}`);
	}
}

function findElectedFromSubdivision(depKey) {

	if (!depKey) {
		alert("Veuillez sélectionner un département valide.");
		return;
	}
	const allElecteds = electedType[selectedElectedKey];
	const electeds = Object.values(allElecteds).filter(elected => elected.departement_num == depKey);

	if (!electeds || electeds.length == 0) {
		throw new Error(`Elu.es non trouvé pour le département ${depKey}`);
	}

	locationInformation = electeds[0].departement_name;

	switch (selectedElectedKey) {
		case "deputies":
			institutionInformation = "l'assemblée nationale";
			break;
		case "senators":
			institutionInformation = "le sénat";
			break;
		case "europals":
			break;

		default:
			throw new Error(`Invalid key ${selectedElectedKey}`);
	}

	if (electeds.length > 1) createGroupFilterForDepartement(electeds, depKey);
	displayElected(electeds);
}

function createGroupFilterForDepartement(electeds, depKey) {
	// find all groups
	const groups = new Map();
	Object.values(electeds).forEach(elected => {
		if (elected.group_abv && !groups.get(elected.group_abv)) {
			groups.set(elected.group_abv, elected.group_name);
		}
	});

	// clean old filters
	const electedFilter = document.getElementById("elected-filter");
	while (electedFilter.lastElementChild) {
		electedFilter.removeChild(electedFilter.lastElementChild);
	}

	// no filter if no group or only one
	if (groups.size <= 1) {
		return;
	}

	// for each group create a filter
	groups
		.forEach((name, abv, _) => {
			const label = document.createElement("label");
			label.className = "elected-filter-element";
			const input = document.createElement("input");
			input.type = "checkbox";
			input.value = abv;
			input.checked = "true";
			input.addEventListener("change", function() {
				if (this.checked) {
					AddGroup(depKey, this.value);
				} else {
					RemoveGroup(this.value);
				}
			});
			label.appendChild(input);
			label.appendChild(createTooltipForGroup(abv, name));
			label.style.textAlign = "center";
			electedFilter.appendChild(label);
		}
		);
}

function createTooltipForGroup(groupAbv, groupName) {
	const textWitTooltip = document.createElement("div");
	textWitTooltip.className = "tooltip";
	const toolTipText = document.createElement("span");
	toolTipText.className = "tooltiptext";

	toolTipText.appendChild(document.createTextNode(groupName));
	textWitTooltip.appendChild(document.createTextNode(groupAbv));
	textWitTooltip.appendChild(toolTipText);

	return textWitTooltip;
}

function RemoveGroup(groupKey) {
	const electeds = selectedElected.filter(elected => elected.group_abv != groupKey);
	displayElected(electeds);
}

function AddGroup(depKey, groupKey) {
	const allElecteds = electedType[selectedElectedKey];
	const newElecteds = Object.values(allElecteds)
		.filter(elected => elected.group_abv == groupKey && elected.departement_num == depKey);

	displayElected(selectedElected.concat(newElecteds));
}

function sendEmail() {
	const campaignKey = document.getElementById("campaign").value;

	if (!campaignKey) {
		alert("Veuillez sélectionner une campagne");
		return;
	}

	if (selectedElected.length == 0) {
		alert("Veuillez d\"abord trouver au moins un.e élu.e");
		return;
	}

	const campaign = window.siteData.campaigns[campaignKey];
	const names = selectedElected.map(elected => `${elected.civ} ${elected.first_name} ${elected.last_name}`).join(", ");
	const body = campaign.body
		.replace("[CIRCONSCRIPTION]", locationInformation) // temp
		.replace("[ELU]", names)
		.replace("[INSTITUTION]", institutionInformation);

	const mailtoLink = `mailto:${selectedElected
		.map(elected => elected.email)
		.join(",")}?subject=${encodeURIComponent(campaign.subject)}&body=${encodeURIComponent(body)}`;

	window.location.href = mailtoLink;
}
