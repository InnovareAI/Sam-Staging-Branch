import { deploymentLogger } from '../lib/services/deployment-logger.ts';

/**
 * CLI Deployment Logger
 * 
 * Usage: node scripts/log-deployment.mjs --name "My Deployment" --type "feature"
 */

async function main() {
    const args = process.argv.slice(2);
    const params = {};

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        params[key] = value;
    }

    if (!params.name || !params.type) {
        console.error('Usage: node scripts/log-deployment.mjs --name "..." --type "feature|hotfix|integration|config"');
        process.exit(1);
    }

    console.log(`🚀 Logging deployment: ${params.name}...`);

    const id = await deploymentLogger.logDeployment({
        name: params.name,
        type: params.type,
        status: 'success',
        mode: 'production'
    });

    if (id) {
        console.log(`✅ Success! Deployment ID: ${id}`);
        process.exit(0);
    } else {
        console.error('❌ Failed to log deployment.');
        process.exit(1);
    }
}

main();
