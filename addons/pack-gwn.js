// Pack Prediction and Asteroid addons into .gwn format.
// Usage: node addons/pack-gwn.js
const fs = require('fs')
const path = require('path')

function packOne({ htmlFile, outFile, id, name, icon, version, description }) {
  const htmlPath = path.join(__dirname, '..', 'addon', htmlFile)
  const outPath = path.join(__dirname, outFile)
  const html = fs.readFileSync(htmlPath, 'utf8')
  const manifest = {
    gwn: '1.0',
    id,
    name,
    icon,
    version,
    author: 'GWN',
    description,
    permissions: ['network'],
    html
  }
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8')
  console.log('Packed:', outPath)
  console.log('Size:', fs.statSync(outPath).size, 'bytes')
}

packOne({
  htmlFile: 'predictionCenter.html',
  outFile: 'earth-danger.gwn',
  id: 'prediction-center',
  name: 'Prediction Center',
  icon: '!',
  version: '2.0.0',
  description: 'Earth danger index and prediction analytics.'
})

packOne({
  htmlFile: 'asteroidCenter.html',
  outFile: 'asteroids.gwn',
  id: 'asteroid-center',
  name: 'Asteroid Center',
  icon: '*',
  version: '2.1.0',
  description: 'Dedicated asteroid intelligence page with multi-source live feeds.'
})

packOne({
  htmlFile: 'skyExplorer.html',
  outFile: 'sky-explorer.gwn',
  id: 'sky-explorer',
  name: 'Sky Explorer',
  icon: '🔭',
  version: '1.0.0',
  description: 'Pan-STARRS DR2 sky survey explorer with color imagery, photometry, and preset deep-sky objects.'
})
