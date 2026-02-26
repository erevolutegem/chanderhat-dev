const fs = require('fs');

function parseBet365Inplay(results) {
    if (!results || !Array.isArray(results)) return [];

    // results can be results[0] or raw
    const items = Array.isArray(results[0]) ? results[0] : results;

    const events = [];
    let currentCT = null;
    let currentEV = null;
    let currentMA = null;

    for (const item of items) {
        if (item.type === 'CT') {
            currentCT = item;
        } else if (item.type === 'EV') {
            // Filter virtuals
            const isVirtual = item.VI === '1' ||
                (currentCT && (currentCT.NA?.toLowerCase().includes('esoccer') ||
                    currentCT.NA?.toLowerCase().includes('ebasketball') ||
                    currentCT.NA?.toLowerCase().includes('volta')));

            if (isVirtual) {
                currentEV = null;
                continue;
            }

            currentEV = {
                id: item.ID,
                sport_id: item.CL || null,
                league: currentCT ? currentCT.NA : 'Unknown',
                home: item.NA?.split(' v ')[0] || 'Unknown',
                away: item.NA?.split(' v ')[1] || 'Unknown',
                name: item.NA,
                ss: item.SS,
                timer: item.TM,
                time_status: item.TT,
                is_virtual: false,
                odds: []
            };
            events.push(currentEV);
        } else if (item.type === 'MA' && currentEV) {
            currentMA = item;
        } else if (item.type === 'PA' && currentEV && currentMA) {
            // Very basic odds mapping for Fulltime Result (1777)
            if (currentMA.ID === '1777' || currentMA.NA?.includes('Result')) {
                const label = item.OR === '0' ? '1' : (item.OR === '1' ? 'X' : '2');
                currentEV.odds.push({ name: label, value: item.OD });
            }
        }
    }
    return events;
}

const raw = JSON.parse(fs.readFileSync('api_test_s1.json', 'utf8'));
const parsed = parseBet365Inplay(raw.results);
console.log(`Parsed ${parsed.length} events.`);
if (parsed.length > 0) {
    console.log(JSON.stringify(parsed[0], null, 2));
}
