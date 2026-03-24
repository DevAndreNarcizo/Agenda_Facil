import fs from 'fs';

const envVars = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].trim();
  return acc;
}, {});

const url = envVars.VITE_SUPABASE_URL;
const key = envVars.VITE_SUPABASE_ANON_KEY;

async function checkProfiles() {
  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=*&limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Profiles data structure:', data.length > 0 ? Object.keys(data[0]) : 'empty table');
    } else {
      console.log('Error:', await res.text());
    }
  } catch(e) { console.error(e) }
}

async function checkCompanies() {
  try {
    const res = await fetch(`${url}/rest/v1/organizations?select=*&limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (res.ok) {
        const data = await res.json();
        console.log('Organizations data structure:', data.length > 0 ? Object.keys(data[0]) : 'empty table');
    }
  } catch(e) { console.error(e) }
}

checkProfiles().then(checkCompanies);
