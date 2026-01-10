export async function onRequestPost(context) {
    try {

        const proposeData = await context.request.json();
        const owner = 'zizanibot';
        const repo = 'InterpelMail';

        // Validation
        if (!proposeData.title || !proposeData.subject || !proposeData.description || !proposeData.body) {
            return new Response('Missing fields', { status: 400 });
        }

        const issueBody = `\`\`\`yaml
${proposeData.title}:
  title: ${proposeData.title}
  subject: ${proposeData.subject}
  date: ${new Date().getFullYear()}
  description: ${proposeData.desc}
  body: ${proposeData.body}
\`\`\`
---
*Soumis via le formulaire de proposition*`;

        const issueTitle = `[Proposition] ${proposeData.title}`;

        const issueResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${context.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'InterpelMail'
            },
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody
            })
        });

        if (!issueResponse.ok) {
            const errorText = await issueResponse.text();
            console.error('GitHub error:', errorText);
            throw new Error('Failed to create issue');
        }

        const issue = await issueResponse.json();

        return new Response(JSON.stringify({ 
            success: true, 
            issueUrl: issue.html_url 
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // If needed for CORS
            }
        });

    } catch(error) {

        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Server error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });

    }
}