const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
lines[3088] = '                                    <div className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors" onMouseDown={(e) => {';
fs.writeFileSync('src/App.tsx', lines.join('\n'));
