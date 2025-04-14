const fs = require('fs');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const prompts = require('prompts');

module.exports = async () => {
  
// 1. Check for GitHub CLI
try {
  execSync('gh --version', { stdio: 'ignore' });
} catch (err) {
  console.error('❌ GitHub CLI (gh) is not installed.\n');
  console.log('👉 Install it from https://cli.github.com/');
  console.log('   macOS:    brew install gh');
  console.log('   Windows:  winget install GitHub.cli');
  console.log('   Ubuntu:   sudo apt install gh\n');
  process.exit(1);
}

// 2. Load and parse .env file
const envPath = '.env';
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found.');
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(envPath));
const tdSecrets = Object.entries(env).filter(([key]) => key.startsWith('TD_'));

if (tdSecrets.length === 0) {
  console.log('ℹ️ No secrets found in .env that start with TD_');
  process.exit(0);
}

// 3. Prompt user for confirmation
(async () => {
  console.log('\n🔐 The following TD_ secrets will be uploaded:');
  tdSecrets.forEach(([key]) => console.log(`- ${key}`));

  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: '\nAre you sure you want to upload these secrets to the current GitHub repo?',
    initial: false,
  });

  if (!response.confirm) {
    console.log('❌ Upload cancelled.');
    process.exit(0);
  }

  // 4. Upload secrets using GitHub CLI
  for (const [key, value] of tdSecrets) {
    try {
      const cmd = `gh secret set ${key} --body "${value}"`;
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Failed to upload ${key}: ${err.message}`);
    }
  }

})();

}
