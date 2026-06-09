// extractTranslations.js
import fs from 'fs';

const rawText = fs.readFileSync('Translations.setting', 'utf-8');
const lines = rawText.split(/\r?\n/);

const referenceDict = {};
let currentGuid = null;
let currentKey = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  if (line.startsWith('=GUID:')) {
    currentGuid = 'g' + line.substring(6).trim();
  } else if (line.startsWith('=Key:') && currentGuid !== null) {
    currentKey = line.substring(5).trim();
  } else if (line.startsWith('=Value:') && currentGuid !== null) {
    referenceDict[currentGuid] = {
      text: line.substring(7).trim(),
      key: currentKey
    };
    currentGuid = null; 
    currentKey = '';
  }
}

fs.writeFileSync('englishReference.json', JSON.stringify(referenceDict, null, 2));
console.log(`Successfully extracted ${Object.keys(referenceDict).length} strings with developer keys.`);