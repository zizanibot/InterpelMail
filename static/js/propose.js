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
        const title = document.getElementById('title').value;
        const subject = document.getElementById('subject').value;
        const desc = document.getElementById('desc').value;
        const body = document.getElementById('body').value;
        const contact = document.getElementById('contact').value;

        // Honeypot check
        if (honeypot) {
            console.log('Bot detected');
            return;
        }

        await submitToGitHub(title, subject, desc, body);
    });

    async function submitToGitHub(title, subject, desc, body) {
        const message = document.getElementById('form-message');
        const owner = 'zizanibot';
        const repo = 'InterpelMail';

        const issueBody = `\`\`\`yaml
${title}:
  title: ${title}
  subject: ${subject}
  date: ${new Date().getFullYear()}
  description: ${desc}
  body: ${body}
\`\`\`
---
*Soumis via le formulaire de proposition*`;

        const issueTitle = `[Proposition] ${title}`;

        try {
            message.innerHTML = "Envoi en cours...";
            message.style.color = '#666';

            const issue = `https://github.com/${owner}/${repo}/issues/new?body=${issueBody}&title=${issueTitle}`;
            console.log(issue);

            message.innerHTML = `Proposition soumise avec succès ! <a href="${issue}" target="_blank">Voir la proposition</a>`;
            message.style.color = 'green';
            
        } catch (error) {
            message.innerHTML = 'Erreur lors de l\'envoi. Réessaye plus tard.';
            message.style.color = 'red';
            console.error(error);
        }
    }
});