let circonscriptionsData = null;
let selectedDeputy = null;

document.addEventListener('DOMContentLoaded', async function() {

    try {
        const response = await fetch('geojson/circonscriptions-legislatives-p20.geojson');
        circonscriptionsData = await response.json();
        console.log('Circonscriptions loaded:', circonscriptionsData.features.length);
    } catch (error) {
        console.error('Error loading circonscriptions:', error);
        alert('Erreur lors du chargement des données des circonscriptions');
    }

    const campaignSelect = document.getElementById('campaign');
    const campaignInfo = document.getElementById('campaign-info');
    const desc = document.getElementById('desc');

    // Show campaign info when campaigns code selected
    campaignSelect.onchange = function() {
        const campaignKey = this.value;
        if (campaignKey) {
            const campaign = window.siteData.campaigns[campaignKey];
            campaignInfo.innerHTML = `<h1>Interpelle tes élu·es:<br>${campaign.title} -- ${campaign.subject}</h1>`;
            desc.innerHTML = `${campaign.description}`;
            desc.style.display = 'block';
        } else {
            campaignInfo.innerHTML = `<h1>Interpelle tes élu·es:</h1>`;
            desc.style.display = 'none';
        }
    };

    // Show deputy info
    document.getElementById('find-deputy').addEventListener('click', findDeputyFromAddress);
    document.getElementById('adress').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            findDeputyFromAddress();
        }
    });

    // Send email
    document.getElementById('send-email').addEventListener('click', sendEmail);
});

async function findDeputyFromAddress() {
    const address = document.getElementById('adress').value.trim();
    const deputyInfo = document.getElementById('deputy-info');
    const sendButton = document.getElementById('send-email');

    if (!address) {
        alert('Veuillez entrer une adresse');
        return;
    }
    
    if (!circonscriptionsData) {
        alert('Les données des circonscriptions ne sont pas encore chargées');
        return;
    }

    deputyInfo.style.display = 'none';
    sendButton.style.display = 'none';

    try {
        const geocodeUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (!geocodeData.features || geocodeData.features.length === 0) {
            throw new Error('Adresse non trouvée');
        }
        
        const coordinates = geocodeData.features[0].geometry.coordinates;
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