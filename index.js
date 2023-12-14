window.onload = init;

function init() {
  refreshType()
};

function refreshType() {
  let typeAvailable = Object.keys(gear);
  let s = "";
  typeAvailable.forEach((e) => {
    s += '<option value="' + e + '">' + e + '</option>\n';
  });

  let typeSelector = document.getElementById('calculator-type');
  typeSelector.innerHTML = s;

  refreshPiece()
};

function refreshPiece() {
  let gearType = document.getElementById('calculator-type').value;
  let pieceAvailable = Object.keys(gear[gearType]);
  let s = "";
  pieceAvailable.forEach((e) => {
    s += '<option value="' + e + '">' + e + '</option>\n';
  });

  let pieceSelector = document.getElementById('calculator-piece');
  pieceSelector.innerHTML = s;  

  refreshStat()
};

function refreshStat() {
  let gearType = document.getElementById('calculator-type').value;
  let pieceType = document.getElementById('calculator-piece').value;
  let statAvailable = Object.keys(gear[gearType][pieceType]['Stats']);
  let s = "";
  statAvailable.forEach((e) => {
    s += '<option value="' + e + '">' + e + '</option>\n';
  });

  let statSelector;
  for (let i = 1; i < 6; i++) {
    statSelector = document.getElementById('calculator-stat-' + i);
    statSelector.innerHTML = s;
    statSelector.selectedIndex = i-1;
  };

  let maxDI = gear[gearType][pieceType]["DI"];
  let statDI = document.getElementById('calculator-max-di');
  statDI.innerHTML = maxDI + "%";

  refreshTiers();
  refreshScore();
};

function refreshTiers() {
  let gearType = document.getElementById('calculator-type').value;
  let pieceType = document.getElementById('calculator-piece').value;
  let tierType;
  if (gearType === 'Armor') {
    tierType = pieceType === 'Helmet' ? 'Type B' : 'Type A';
  };
  let tierEquivalence = tiers[gearType][tierType];
  let tierAvailable = Object.keys(tierEquivalence);

  let s = "<table><tr><th>Score</th><th>Tier</th><th>Single</th><th>Duo</th><th>Trio</th><th>Quad</th><th>Penta</th></tr>";
  tierAvailable.forEach((e) => {
    cT = tierEquivalence[e];
    sM = '</td><td>';
    s += '<tr><td>' + cT['Score'] + sM + e + sM + cT['Single'] + sM + cT['Duo'] + sM + cT['Trio'] + sM + cT['Quad'] + sM + cT['Penta'] + '</td></tr>\n';
  });

  s += '</table'
  let tierTable = document.getElementById('equivalence-table');
  tierTable.innerHTML = s;
};

function refreshScore() {
  let gearType = document.getElementById('calculator-type').value;
  let pieceType = document.getElementById('calculator-piece').value;
  let tierType;
  if (gearType === 'Armor') {
    tierType = pieceType === 'Helmet' ? 'Type B' : 'Type A';
  };
  let tierEquivalence = tiers[gearType][tierType];
  let tierAvailable = Object.keys(tierEquivalence);

  totalDI = 0;
  for (let i = 1; i < 6; i++) {
    let statType = document.getElementById('calculator-stat-' + i).value;
    let statValue = document.getElementById('calculator-stat-' + i + '-input').value;
    let maxValue = gear[gearType][pieceType]["Stats"][statType]["Value"];
    let maxDI = gear[gearType][pieceType]["Stats"][statType]["DI"];
    let result = statValue / maxValue * maxDI;
    totalDI += result;
  };

  let itemDI = parseInt(totalDI / gear[gearType][pieceType]["DI"] * 100);
  let resultPercent = document.getElementById('calculator-percent')
  resultPercent.innerHTML = 'Score: ' + itemDI + '%'
  let resultDI = document.getElementById('calculator-di');
  resultDI.innerHTML = 'DI: ' + totalDI.toFixed(2) + '%';
  

  let finalTier = 'F';
  tierAvailable.forEach((e) => {
    if (itemDI >= parseInt(tierEquivalence[e]['Penta'])) {
      finalTier = e;
    }
  });

  let resultTier = document.getElementById('calculator-tier');
  resultTier.innerHTML = finalTier + ' tier';

  refreshValues();
};

function refreshValues() {
  let gearType = document.getElementById('calculator-type').value;
  let pieceType = document.getElementById('calculator-piece').value;

  let s = "<table><tr><th>Stat</th><th>Max Value</th><th>Your %</th><th>Your DI</th><th>Max DI</th></tr>\n";
  for (let i = 1; i < 6; i++) {
    let statType = document.getElementById('calculator-stat-' + i).value;
    let statValue = document.getElementById('calculator-stat-' + i + '-input').value;
    let maxValue = gear[gearType][pieceType]["Stats"][statType]["Value"];
    let maxDI = gear[gearType][pieceType]["Stats"][statType]["DI"];
    let currPerc = statValue / maxValue;
    let currDI = currPerc * maxDI;

    let sM = '</td><td>';
    let addVal = i === 5 ? 0.8 : 1;
    s += '<td>' + statType + sM + maxValue + sM + parseInt(currPerc * 100) + '%' + sM + currDI.toFixed(2) + '%' + sM + (maxDI * addVal).toFixed(2) + '%' + '</td></tr>';
  };

  s += '</table>';

  let valueTable = document.getElementById('calculator-values');
  valueTable.innerHTML = s;
};

function updateValues(enchants, value) {
  let gearType = document.getElementById('calculator-type').value;
  let pieceType = document.getElementById('calculator-piece').value;

  for (let i = 1; i < 6; i++) {
    let statType = document.getElementById('calculator-stat-' + i).value;
    let statValue = document.getElementById('calculator-stat-' + i + '-input');
    let maxValue = gear[gearType][pieceType]["Stats"][statType]["Value"];

    if (enchants >= i) {
      statValue.value = ['Normal Amp', 'Boss Amp'].includes(statType) ? (value * maxValue / 100).toFixed(2) : parseInt(value * maxValue / 100);
    } else {
      statValue.value = "";
    };
  }

  refreshScore();
}