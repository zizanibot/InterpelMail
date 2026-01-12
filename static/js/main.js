let circonscriptionsData = null;

let selectedAddress = null;
let selectedDeputies = null;

let suggestionsTimer = null;

const addressData = {};
const groups = {};
const deps = {};

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
	Object.values(window.siteData.deputies["deputies"]).forEach(dep => {
		if (dep.group_abv && !groups[dep.group_abv]) {
			groups[dep.group_abv] = dep.group_name;
		}
	});

	const groups_select = document.getElementById('groups-select');
	Object.entries(groups)
		.sort((a, b) => a[1].localeCompare(b[1]))
		.forEach(([abv, name]) => {
			const option = document.createElement('option');
			option.value = abv;
			option.textContent = `${abv} - ${name}`;
			groups_select.appendChild(option);
		}
		);

	Object.values(window.siteData.deputies["deputies"]).forEach(dep => {
		if (dep.departement_num && !deps[dep.departement_num]) {
			deps[dep.departement_num] = dep.departement_name;
		}
	});

	const deps_select = document.getElementById('deps-select');
	Object.entries(deps)
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
		findDeputiesFromSubdivision(document.getElementById('deps-select').value);
	});
	document.getElementById('find-deputy-group').addEventListener('click', function() {
		resetData();
		findDeputiesFromGroup(document.getElementById('groups-select').value);
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
		suggestions.innerHTML = '<div class="loading">Recherche...</div>';

		suggestionsTimer = setTimeout(async () => {
			try {
				const searchedValue = document.getElementById('address').value.trim();
				const results = await findAddresses(searchedValue);
				displaySuggestions(results, suggestions);
			} catch (error) {
				suggestions.innerHTML = '<div class="no-results">Erreur lors de la recherche d\'adresses</div>';
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

}

function setCampaign(campaignKey) {

	const campaignInfo = document.getElementById('campaign-info');
	const desc = document.getElementById('desc');

	if (campaignKey) {
		const campaign = window.siteData.campaigns[campaignKey];
		campaignInfo.innerHTML = `<h1>Interpelle tes élu·es:<br>${campaign.title} -- ${campaign.subject}</h1>`;
		desc.innerHTML = `${campaign.description}`;
		desc.style.display = 'block';
	} else {
		campaignInfo.innerHTML = `<h1>Interpelle tes élu·es:</h1>`;
		desc.style.display = 'none';
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
		suggestions.innerHTML = '<div class="no-results">Aucune adresse trouvée</div>';
		return;
	}

	results.forEach((elt, index) => {
		addressData[index] = {
			address: elt.properties.label,
			coord: elt.geometry.coordinates,
		}
	});

	suggestions.innerHTML = results.map(
		(elt, index) => `
<div class="suggestion-item" data-id="${index}">${elt.properties.label}</div>`
	).join('');

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

	deputyInfo.innerHTML = `<strong>Tes député.es sont :</strong><br>`
	deputies.forEach(deputy => {
		deputyInfo.innerHTML += `${deputy.first_name} ${deputy.last_name} (${deputy.group_abv} - ${deputy.departement_num})<br>`;
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

	displayDeputies(deputies);
}

function findDeputiesFromGroup(groupKey) {

	if (!groupKey) {
		alert('Veuillez sélectionner un groupe parlementaire valide.');
		return;
	}
	const deputies = Object.values(window.siteData.deputies["deputies"]).filter(deputy => deputy.group_abv == groupKey);

	if (!deputies) {
		throw new Error(`Député.es non trouvé pour le département ${depKey}`);
	}

	displayDeputies(deputies);
}

function sendEmail() {
	const campaignKey = document.getElementById('campaign').value;

	if (!campaignKey) {
		alert('Veuillez sélectionner une campagne');
		return;
	}

	if (!selectedDeputies) {
		alert('Veuillez d\'abord trouver au moins un.e député.e');
		return;
	}

	const campaign = window.siteData.campaigns[campaignKey];
	const names = selectedDeputies.map(deputy => `${deputy.civ} ${deputy.first_name} ${deputy.last_name}`).join(', ');
	const body = campaign.body
		.replace("[CIRCONSCRIPTION]", `la ${selectedDeputies[0].circonscription_name}`) // temp
		.replace("[DEPUTE]", names);

	const mailtoLink = `mailto:${selectedDeputies.map(deputy => deputy.email).join(',')}?subject=${encodeURIComponent(campaign.subject)}&body=${encodeURIComponent(body)}`;

	window.location.href = mailtoLink;
}
