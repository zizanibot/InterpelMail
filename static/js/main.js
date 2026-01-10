let circonscriptionsData = null;

let selectedAddress = null;
let selectedDeputy = null;

let suggestionsTimer = null;

const addressData = {};

document.addEventListener('DOMContentLoaded', async function() {

    try {
        const response = await fetch('geojson/circonscriptions-legislatives-p20.geojson');
        circonscriptionsData = await response.json();
        console.log('Circonscriptions loaded:', circonscriptionsData.features.length);
    } catch (error) {
        console.error('Error loading circonscriptions:', error);
        alert('Erreur lors du chargement des données des circonscriptions');
    }

    const suggestions = document.getElementById('suggestions');

    // Show campaign info when campaigns code selected
    document.getElementById('campaign').addEventListener('change', function() {
	setCampaign(this.value);
    });

    // Show deputy info
    document.getElementById('find-deputy').addEventListener('click', findDeputyFromAddress);
    document.getElementById('address').addEventListener('input', function(e) {
	
	document.getElementById('deputy-info').style.display = 'none';
	document.getElementById('send-email').style.display = 'none';
	selectedDeputy = null;

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

async function findDeputyFromAddress() {
    const deputyInfo = document.getElementById('deputy-info');
    const sendButton = document.getElementById('send-email');

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
            throw new Error('Circonscription non trouvée pour cette e');
        }
        const circoCode = foundCirco.properties.codeCirconscription;
        console.log('Circo found:', circoCode);

        const deputy = window.siteData.deputies["deputies"][circoCode];

        if (!deputy) {
            throw new Error(`Député non trouvé pour la circonscription ${circoCode}`);
        }

        selectedDeputy = deputy;
        deputyInfo.innerHTML = `<strong>Ta.on député.e est :</strong> ${deputy.first_name} ${deputy.last_name} (${deputy.gp_abv})`;
        deputyInfo.style.display = 'block';
        sendButton.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        alert(`Erreur: ${error.message}`);
    }
}

function sendEmail() {
    const campaignKey = document.getElementById('campaign').value;

    if (!campaignKey) {
        alert('Veuillez sélectionner une campagne');
        return;
    }

    if (!selectedDeputy) {
        alert('Veuillez d\'abord trouver votre député');
        return;
    }

    const campaign = window.siteData.campaigns[campaignKey];
    const mailtoLink = `mailto:${selectedDeputy.email}?subject=${encodeURIComponent(campaign.subject)}&body=${encodeURIComponent(campaign.body)}`;

    window.location.href = mailtoLink;
}
