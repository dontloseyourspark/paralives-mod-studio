// extractTranslations.js
import fs from 'fs';

const rawText = fs.readFileSync('Translations.setting', 'utf-8');
const lines = rawText.split(/\r?\n/);

const referenceDict = {};
let currentGuid = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  if (line.startsWith('=GUID:')) {
    // Prepend 'g' to match the key format used in your mod translations
    currentGuid = 'g' + line.substring(6).trim();
  } else if (line.startsWith('=Value:') && currentGuid !== null) {
    // Extract the text and reset the tracker
    referenceDict[currentGuid] = line.substring(7).trim();
    currentGuid = null; 
  }
}

fs.writeFileSync('englishReference.json', JSON.stringify(referenceDict, null, 2));
console.log(`Successfully extracted ${Object.keys(referenceDict).length} strings.`);