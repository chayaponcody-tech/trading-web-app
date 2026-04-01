const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'src/pages/BinanceTestnet.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Use regex matching to be robust against \r\n and spacing
const searchPattern = /                             <\/td>\r?\n                             <td style=\{\{ padding: '1rem' \}\}>\r?\n                                \{\(\(\) => \{\r?\n                                 const linkedBot/;

if (searchPattern.test(content)) {
    console.log('Match found in activePositions table!');
} else {
    console.log('Match NOT found. Let us try another way.');
    // Find index of 'M: {formatPrice(parseFloat(p.markPrice || 0))}</div>'
    const markPriceIdx = content.indexOf('M: {formatPrice(parseFloat(p.markPrice || 0))}</div>');
    if (markPriceIdx > -1) {
        console.log('Found markPriceIdx', markPriceIdx);
        // We know the </td> is shortly after this.
        const tdIdx = content.indexOf('</td>', markPriceIdx);
        if (tdIdx > -1) {
            const insertPoint = tdIdx + 5; // right after </td>
            // We want to insert our new <td> here
            const newCol = `\n                             <td style={{ padding: '1rem' }}>
                                {(() => {
                                  let entryReason = 'Technical / API Entry';
                                  const linkedBot = bots.find(b => b.config.symbol === p.symbol);
                                  if (linkedBot) {
                                      const botPos = linkedBot.openPositions?.find((op: any) => op.type === side);
                                      if (botPos?.entryReason) entryReason = botPos.entryReason;
                                      else if (linkedBot.aiReason) entryReason = linkedBot.aiReason;
                                      else if (linkedBot.config.strategy) entryReason = \`Strategy: \${linkedBot.config.strategy}\`;
                                  }
                                  return <div style={{ fontSize: '0.75rem', color: '#faad14', maxWidth: '180px', lineHeight: '1.4' }}>{entryReason}</div>;
                                })()}
                             </td>`;
            content = content.slice(0, insertPoint) + newCol + content.slice(insertPoint);
            console.log('Injected new column');
        }
    }
}

// History table
const exitReasonHeaderIdx = content.indexOf('<th style={{ padding: \'0.5rem\' }}>Exit Reason</th>');
if (exitReasonHeaderIdx > -1) {
    const headerCol = `<th style={{ padding: '0.5rem' }}>Entry Reason</th>\n              `;
    content = content.slice(0, exitReasonHeaderIdx) + headerCol + content.slice(exitReasonHeaderIdx);
    console.log('Injected header Entry Reason');
}

const manualTdIdx = content.indexOf('<td style={{ padding: \'0.5rem\', color: \'#888\' }}>{t.reason || \'Manual\'}</td>');
if (manualTdIdx > -1) {
    const rowCol = `<td style={{ padding: '0.5rem', color: '#faad14', fontSize: '0.7rem' }}>{t.entryReason || 'Technical Entry'}</td>\n                `;
    content = content.slice(0, manualTdIdx) + rowCol + content.slice(manualTdIdx);
    console.log('Injected row Entry Reason');
}

fs.writeFileSync(targetPath, content);
console.log('Done script 4');
