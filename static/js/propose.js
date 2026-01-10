document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('desc').addEventListener('input', function() {
        document.getElementById('char-count-desc').textContent = this.value.length;
    });

    document.getElementById('body').addEventListener('input', function() {
        document.getElementById('char-count-body').textContent = this.value.length;
    });

    document.getElementById('campaign-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const honeypot = document.getElementById('website').value;
        const message = document.getElementById('form-message');

        // Honeypot check
        if (honeypot) {
            console.log('Bot detected');
            return;
        }

        const proposeData = {
            title: document.getElementById('title').value,
            subject: document.getElementById('subject').value,
            desc: document.getElementById('desc').value,
            body: document.getElementById('contact').value
        };

        try {
            message.innerHTML = "Envoi en cours...";
            message.style.color = '#666';

            const response = await fetch('/submit-proposal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(proposeData)
            });

            const result = await response.json();

            if (response.ok) {
                message.innerHTML = `Proposition soumise avec succès ! <a href="${result.url}" target="_blank">Voir la proposition</a>`;
                message.style.color = 'green';
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            message.innerHTML = 'Erreur lors de l\'envoi. Réessaye plus tard.';
            message.style.color = 'red';
            console.error(error);
        }
    });
});