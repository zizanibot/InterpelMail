let circonscriptionsData = null;

let selectedAddress = null;
let selectedDeputies = [];
let locationInformation = null;

let suggestionsTimer = null;

const addressData = {};
const departements = {};

document.addEventListener('DOMContentLoaded', async function() {

	try {
		const response = await fetch('geojson/circonscriptions-legislatives-p20.geojson');
		circonscriptionsData = await response.json();
		console.log('Circonscriptions loaded:', circonscriptionsData.features.length);
	} catch (error) {
		console.error('Error loading circonscriptions:', error);
		alert('Erreur lors du chargement des données des circonscriptions');
	}

	// construct additional maps for selection
	Object.values(window.siteData.deputies["deputies"]).forEach(deputy => {
		if (deputy.departement_num && !departements[deputy.departement_num]) {
			departements[deputy.departement_num] = deputy.departement_name;
		}
	});

	const deps_select = document.getElementById('deps-select');
	Object.entries(departements)
		.sort((a, b) => a[1].localeCompare(b[1]))
		.forEach(([num, name]) => {
			const option = document.createElement('option');
			option.value = num;
			option.textContent = `${name} - ${num}`;
			deps_select.appendChild(option);
		}
		);

	// Show campaign info when campaigns code selected
	document.getElementById('campaign').addEventListener('change', function() {
		setCampaign(this.value);
	});

	// Show selection method
	document.querySelectorAll('.tab-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			resetData();
			document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');

			document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
			document.getElementById(btn.dataset.tab).classList.add('active');
		});
	});

	// Show deputy info
	document.getElementById('find-deputy-address').addEventListener('click', findDeputyFromAddress);
	document.getElementById('find-deputy-subdivision').addEventListener('click', function() {
		resetData();
		findDeputiesFromSubdivision(deps_select.value);
	});

	document.getElementById('address').addEventListener('input', function(e) {

		const suggestions = document.getElementById('suggestions');
		resetData();
		clearTimeout(suggestionsTimer);

		if (e.target.value.length < 5) {
			suggestions.style.display = 'none';
			return;
		}

		suggestions.style.display = 'block';
		suggestions.className = 'loading';
		suggestions.textContent = 'Recherche...';

		suggestionsTimer = setTimeout(async () => {
			try {
				const searchedValue = document.getElementById('address').value.trim();
				const results = await findAddresses(searchedValue);
				displaySuggestions(results, suggestions);
			} catch (error) {
				const no_result = document.createElement('div');
				no_result.className = "no-results";
				no_result.textContent = "Erreur lors de la recherche d'adresses";
				console.error('Error:', error);
			}
		}, 500);
	});

	// hide suggestions
	document.addEventListener('click', (e) => {
		if (!e.target.closest('address-form')) {
			suggestions.style.display = 'none';
		}
	});

	// Send email
	document.getElementById('send-email').addEventListener('click', sendEmail);
});

function resetData() {

	document.getElementById('deputy-info').style.display = 'none';
	document.getElementById('send-email').style.display = 'none';
	selectedDeputies = null;
	selectedAddress = null;
	locationInformation = null;

	const deputy_filter = document.getElementById('deputy-filter');
	while (deputy_filter.lastElementChild) {
		deputy_filter.removeChild(deputy_filter.lastElementChild);
	}

}

function setCampaign(campaignKey) {

	const campaignInfo = document.getElementById('campaign-info');
	const desc = document.getElementById('desc');

	if (campaignKey) {
		const campaign = window.siteData.campaigns[campaignKey];
		campaignInfo.textContent = `${campaign.title} -- ${campaign.subject}`;
		desc.innerHTML = campaign.description;
		desc.style.display = 'block';
	} else {
		desc.style.display = 'none';
		campaignInfo.textContent = "";
	}
}

async function findAddresses(input) {

	try {
		const geocodeUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(input)}&limit=5`;
		const geocodeResponse = await fetch(geocodeUrl);
		const geocodeData = await geocodeResponse.json();

		console.log(geocodeData);

		return geocodeData.features;
	} catch (error) {
		console.error('Error:', error);
	}
}

function displaySuggestions(results, suggestions) {

	Object.keys(addressData).forEach(key => delete addressData[key]);
	if (results.length == 0) {
		const no_result = document.createElement('div');
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
				const suggestion_item = document.createElement('div');
				suggestion_item.className = "suggestion-item";
				suggestion_item.dataset.id = index;
				suggestion_item.textContent = elt.properties.label;
				return suggestion_item;
			}
		)
	);

	document.querySelectorAll('.suggestion-item').forEach(elt => {
		elt.addEventListener('click', () => {
			selectAddress(elt.dataset.id);
		});
	});
}

function selectAddress(id) {

	selectedAddress = addressData[id];

	if (!selectedAddress) {
		return;
	}
	const input = document.getElementById('address');
	input.value = selectedAddress.address;
	document.getElementById('suggestions').style.display = 'none';
}

function displayDeputies(deputies) {

	const deputyInfo = document.getElementById('deputy-info');
	const sendButton = document.getElementById('send-email');

	const strong = document.createElement('strong');
	strong.textContent = "Vos député.es sont :";
	deputyInfo.replaceChildren(strong);
	deputyInfo.insertAdjacentElement("beforeend", document.createElement('br'));
	deputies.forEach(deputy => {
		deputyInfo.insertAdjacentText("beforeend", `${deputy.first_name} ${deputy.last_name} (${deputy.group_abv} - ${deputy.circonscription_name})`);
		deputyInfo.insertAdjacentElement("beforeend", document.createElement('br'));
	});

	selectedDeputies = deputies;
	deputyInfo.style.display = 'block';
	sendButton.style.display = 'block';
}

async function findDeputyFromAddress() {

	if (!selectedAddress) {
		alert('Veuillez sélectionner une adresse valide.');
		return;
	}

	if (!circonscriptionsData) {
		alert('Les données des circonscriptions ne sont pas encore chargées');
		return;
	}

	try {

		const coordinates = selectedAddress.coord;
		console.log('Coordinates [lon, lat] found:', coordinates);

		const point = turf.point(coordinates);
		let foundCirco = null;

		for (const feature of circonscriptionsData.features) {
			if (turf.booleanPointInPolygon(point, feature)) {
				foundCirco = feature;
				break;
			}
		}

		if (!foundCirco) {
			throw new Error('Circonscription non trouvée pour cette adresse');
		}
		const circoCode = foundCirco.properties.codeCirconscription;
		console.log('Circo found:', circoCode);

		const deputy = window.siteData.deputies["deputies"][circoCode];

		if (!deputy) {
			throw new Error(`Député.e non trouvé pour la circonscription ${circoCode}`);
		}

		locationInformation = `la ${deputy.circonscription_name}`;
		displayDeputies([deputy]);
	} catch (error) {
		console.error('Error:', error);
		alert(`Erreur: ${error.message}`);
	}
}

function findDeputiesFromSubdivision(depKey) {

	if (!depKey) {
		alert('Veuillez sélectionner un département valide.');
		return;
	}
	const deputies = Object.values(window.siteData.deputies["deputies"]).filter(deputy => deputy.departement_num == depKey);

	if (!deputies) {
		throw new Error(`Député.es non trouvé pour le département ${depKey}`);
	}

	let groups = {}
	Object.values(deputies).forEach(deputy => {
		if (deputy.group_abv && !groups[deputy.group_abv]) {
			groups[deputy.group_abv] = deputy.group_name;
		}
	});

	const deputy_filter = document.getElementById('deputy-filter');
	while (deputy_filter.lastElementChild) {
		deputy_filter.removeChild(deputy_filter.lastElementChild);
	}
	Object.entries(groups)
		.sort((a, b) => a[1].localeCompare(b[1]))
		.forEach(([abv, _]) => {
			const label = document.createElement('label');
			label.className = 'deputy-filter-element';
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.value = abv;
			input.checked = "true";
			input.addEventListener('change', function() {
				if (this.checked) {
					AddGroup(depKey, this.value);
				} else {
					RemoveGroup(this.value);
				}
			});
			label.appendChild(input);
			label.appendChild(document.createTextNode(abv));
			label.style.textAlign = "center";
			deputy_filter.appendChild(label);
		}
		);

	locationInformation = deputies[0].departement_name;
	displayDeputies(deputies);
}

function RemoveGroup(groupKey) {
	const deputies = selectedDeputies.filter(deputy => deputy.group_abv != groupKey);
	displayDeputies(deputies);
}

function AddGroup(depKey, groupKey) {
	const newDeputies = Object.values(window.siteData.deputies["deputies"])
		.filter(deputy => deputy.group_abv == groupKey && deputy.departement_num == depKey);

	displayDeputies(selectedDeputies.concat(newDeputies));
}

function sendEmail() {
	const campaignKey = document.getElementById('campaign').value;

	if (!campaignKey) {
		alert('Veuillez sélectionner une campagne');
		return;
	}

	if (selectedDeputies.length == 0) {
		alert('Veuillez d\'abord trouver au moins un.e député.e');
		return;
	}

	const campaign = window.siteData.campaigns[campaignKey];
	const names = selectedDeputies.map(deputy => `${deputy.civ} ${deputy.first_name} ${deputy.last_name}`).join(', ');
	const body = campaign.body
		.replace("[CIRCONSCRIPTION]", locationInformation) // temp
		.replace("[DEPUTE]", names);

	const mailtoLink = `mailto:${selectedDeputies.map(deputy => deputy.email).join(',')}?subject=${encodeURIComponent(campaign.subject)}&body=${encodeURIComponent(body)}`;

	window.location.href = mailtoLink;
}
