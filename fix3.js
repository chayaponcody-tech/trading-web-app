const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'src/pages/BinanceTestnet.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');

const tpValIdx = lines.findIndex(l => l.includes('const tpVal = parseFloat(p.entryPrice)'));

if (tpValIdx > 0) {
    console.log("Found tpVal at index:", tpValIdx);
    
    // Find previous </td>
    let tdIndex = -1;
    for (let i = tpValIdx; i > tpValIdx - 15; i--) {
        if (lines[i].includes('                             </td>')) {
            tdIndex = i;
            break;
        }
    }
    
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
        
        lines.splice(tdIndex + 1, 0, newCol);
        
        // Also let's fix the History table!
        const historyHead = lines.findIndex(l => l.includes('<th style={{ padding: \\'0.5rem\\' }}>Exit Reason</th>'));
        if (historyHead > 0) {
            lines.splice(historyHead, 0, `              <th style={{ padding: '0.5rem' }}>Entry Reason</th>`);
            console.log("Patched History Header");
        }
        
        const manualTd = lines.findIndex(l => l.includes('<td style={{ padding: \\'0.5rem\\', color: \\'#888\\' }}>{t.reason || \\'Manual\\'}</td>'));
        if (manualTd > 0) {
            lines.splice(manualTd, 0, `                <td style={{ padding: '0.5rem', color: '#faad14', fontSize: '0.7rem' }}>{t.entryReason || 'Technical Entry'}</td>`);
            console.log("Patched History Row");
        }
        
        fs.writeFileSync(targetPath, lines.join('\n'));
        console.log("Successfully patched both tables.");
    } else {
        console.log("Could not find tdIndex");
    }
} else {
    console.log("Could not find tpValIdx");
}
