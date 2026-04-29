const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'public', 'assets');
const outputFilePath = path.join(__dirname, 'src', 'constants', 'assets.js');

function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(file => !file.startsWith('.'));
}

const stickDir = path.join(assetsDir, 'STICK');
const sticks = getFiles(stickDir);

const liscioDir = path.join(assetsDir, 'BARATTOLI', 'LISCIO', 'new');
const liscioJars = getFiles(liscioDir);

const ammDir = path.join(assetsDir, 'BARATTOLI', 'AMM', 'new');
const ammJars = getFiles(ammDir);

const graficheDir = path.join(assetsDir, 'GRAFICHE');
const grafiche = getFiles(graficheDir);

const assetsData = `
export const STICKS = ${JSON.stringify(sticks, null, 2)};

export const LISCIO_JARS = ${JSON.stringify(liscioJars, null, 2)};

export const AMM_JARS = ${JSON.stringify(ammJars, null, 2)};

export const GRAFICHE = ${JSON.stringify(grafiche, null, 2)};
`;

if (!fs.existsSync(path.dirname(outputFilePath))) {
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
}

fs.writeFileSync(outputFilePath, assetsData);
console.log('Assets constants generated successfully!');
