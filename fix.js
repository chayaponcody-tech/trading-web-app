const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, 'src/pages/BinanceTestnet.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const targetStr = `                             </td>
                             <td style={{ padding: '1rem' }}>
                                {(() => {
                                 const linkedBot = bots.find(b => b.config.symbol === p.symbol);
                                 if (!linkedBot) return <span style={{ color: '#555' }}>N/A</span>;`;

const replacementStr = `                             </td>
                             <td style={{ padding: '1rem' }}>
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
                             </td>
                             <td style={{ padding: '1rem' }}>
                                {(() => {
                                 const linkedBot = bots.find(b => b.config.symbol === p.symbol);
                                 if (!linkedBot) return <span style={{ color: '#555' }}>N/A</span>;`;

// Normalize line endings to avoid \r \n issues:
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementStr;

if (normalizedContent.includes(normalizedTarget)) {
    console.log("Target found. Replacing...");
    fs.writeFileSync(targetPath, normalizedContent.replace(normalizedTarget, normalizedReplacement));
    console.log("Success.");
} else {
    console.log("Target NOT found in the file.");
}
