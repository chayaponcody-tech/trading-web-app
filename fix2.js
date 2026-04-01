const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'src/pages/BinanceTestnet.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// I will just use split to inject lines precisely at the known index.
const lines = content.split('\n');

// Find index where we have: `const tpVal = parseFloat(p.entryPrice)`
const targetIdx = lines.findIndex(l => l.includes('const tpVal = parseFloat(p.entryPrice)'));

if (targetIdx > 0 && targetIdx === 863) {
    // Wait, let's just insert before the `const linkedBot = bots.find(...);`
    // Let's find the closing `</td>` at 859.
    const tdIndex = lines.findIndex((l, i) => l.includes('                             </td>') && i > 850 && i < 870 && lines[i+1].includes('<td style={{ padding: \'1rem\' }}>'));
    
    if (tdIndex > 0) {
        console.log("Found entry at index:", tdIndex);
        
        // Insert Entry Reason
        const newCol = `                             <td style={{ padding: '1rem' }}>
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
        
        // insert into lines right after 859 tdIndex
        lines.splice(tdIndex + 1, 0, newCol);
        
        // Also let's fix the History table!
        // Find Exit Reason header
        const historyHead = lines.findIndex(l => l.includes('<th style={{ padding: \'0.5rem\' }}>Exit Reason</th>'));
        if (historyHead > 0) {
            lines.splice(historyHead, 0, `              <th style={{ padding: '0.5rem' }}>Entry Reason</th>`);
        }
        
        // Find the manual close
        const manualTd = lines.findIndex(l => l.includes('<td style={{ padding: \'0.5rem\', color: \'#888\' }}>{t.reason || \'Manual\'}</td>'));
        if (manualTd > 0) {
            lines.splice(manualTd, 0, `                <td style={{ padding: '0.5rem', color: '#faad14', fontSize: '0.7rem' }}>{t.entryReason || 'Technical Entry'}</td>`);
        }
        
        fs.writeFileSync(targetPath, lines.join('\n'));
        console.log("Successfully patched both tables.");
    }
}
