// CSV கோப்பு பெயர்கள்
const fileNames = [
    "52WeekHigh", "52WeekLow", "Upper Band", "Lower Band", 
    "T20-gainers", "T20-loosers", "StocksTraded"
];

// தரவு சேமிப்பு
let storage = {};
let finalArray = [];
let originalOrder = [];
let currentPage = 1;
const itemsPerPage = 50;

// நெடுவரிசை மேப்பிங்
let columnMapping = {
    "StocksTraded": {
        symbol: null,
        price: null,
        change: null,
        changePct: null,
        series: null
    }
};

// முக்கிய பங்குகள்
let highlightedStocks = [];
let selectedTopStocks = new Set();

// லோக்கல் ஸ்டோரேஜ் கீ
const STORAGE_KEY = 'stockMarketAnalysisData';

// பதிவேற்றம் UI உருவாக்கம்
document.addEventListener('DOMContentLoaded', function() {
    const grid = document.getElementById('fileGrid');
    fileNames.forEach((name, i) => {
        const isRequired = name === "StocksTraded";
        grid.innerHTML += `
            <div class="file-card ${isRequired ? 'required' : ''}" id="box-${i}">
                <i class="fas fa-file-csv fa-2x mb-2 ${isRequired ? 'text-danger' : 'text-secondary'}"></i>
                <div class="file-label">${name}</div>
                ${isRequired ? '<div class="required-badge">அவசியம்</div>' : ''}
                <div id="preview-${i}" class="column-preview"></div>
                <input type="file" accept=".csv" onchange="readCSV(event, '${name}', ${i})">
            </div>
        `;
    });
    
    // இணைப்பு நிகழ்வு கேட்பான்கள்
    document.getElementById('search').addEventListener('keyup', filter);
    document.getElementById('sigFilter').addEventListener('change', filter);
    document.getElementById('pctFilter').addEventListener('change', filter);
    document.getElementById('reasonFilter').addEventListener('change', filter);
    document.getElementById('sortFilter').addEventListener('change', sortData);
    
    // தானாக முந்தைய தரவை ஏற்ற முயற்சிக்கவும்
    setTimeout(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            document.getElementById('uploadStatus').innerHTML = 
                `<div class="alert alert-info d-inline-block">
                    <i class="fas fa-info-circle"></i> 
                    முன்னர் சேமிக்கப்பட்ட தரவு கிடைக்கிறது. 
                    <button class="btn btn-sm btn-primary ms-2" onclick="loadFromLocalStorage()">ஏற்று</button>
                </div>`;
        }
        
        // பழைய ரிப்போர்டை சரிபார்க்கவும்
        checkIfOldReport();
        updateReportTimestamp();
    }, 1000);
});

// ==================== புதிய செயல்பாடுகள் ====================

// தேதி தகவலைப் புதுப்பிக்கும் செயல்பாடு
function updateReportTimestamp() {
    const now = new Date();
    
    // தேதி பதிப்பு
    const dateOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    const dateStr = now.toLocaleDateString('ta-IN', dateOptions);
    document.getElementById('reportDate').textContent = dateStr;
    
    // நேரம் பதிப்பு
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
    };
    const timeStr = now.toLocaleTimeString('ta-IN', timeOptions);
    document.getElementById('reportTime').textContent = timeStr;
    
    // பிரிண்ட் பகுதிக்கும் தேதியைப் புதுப்பிக்கவும்
    const printDateElement = document.getElementById('print-date');
    if (printDateElement) {
        const fullDateTime = `${dateStr} ${timeStr}`;
        printDateElement.textContent = fullDateTime;
    }
}

// டாஸ்போர்டு தேர்வு செயல்பாடுகள்
function selectAllBuyStocks() {
    highlightedStocks.forEach((stock, index) => {
        if (stock.signal === "BUY") {
            selectedTopStocks.add(index);
        }
    });
    updateDashboardSelection();
    updateSelectedCount();
}

function selectAllSellStocks() {
    highlightedStocks.forEach((stock, index) => {
        if (stock.signal === "SELL") {
            selectedTopStocks.add(index);
        }
    });
    updateDashboardSelection();
    updateSelectedCount();
}

function selectMultiReasonStocks() {
    highlightedStocks.forEach((stock, index) => {
        if (stock.reasonCount >= 2) {
            selectedTopStocks.add(index);
        }
    });
    updateDashboardSelection();
    updateSelectedCount();
}

function clearAllSelections() {
    selectedTopStocks.clear();
    updateDashboardSelection();
    updateSelectedCount();
}

function updateDashboardSelection() {
    const selectedCount = selectedTopStocks.size;
    const selectionDiv = document.getElementById('dashboardSelectionCount');
    const countSpan = document.getElementById('selectedDashboardCount');
    
    if (selectedCount > 0) {
        countSpan.textContent = selectedCount;
        selectionDiv.style.display = 'block';
    } else {
        selectionDiv.style.display = 'none';
    }
}

// பழைய ரிப்போர்ட் சரிபார்க்கும் செயல்பாடு
function checkIfOldReport() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return;
    
    try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.saveTimestamp) {
            const savedDate = new Date(parsedData.saveTimestamp);
            const now = new Date();
            const diffHours = (now - savedDate) / (1000 * 60 * 60);
            
            // 24 மணிநேரத்திற்கு மேல் பழையதாக இருந்தால் எச்சரிக்கை
            if (diffHours > 24) {
                const warningDiv = document.getElementById('oldReportWarning');
                const daysOld = Math.floor(diffHours / 24);
                warningDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle text-warning"></i>
                    <strong> கவனம்:</strong> இது ${daysOld} நாட்கள் பழைய சேமிக்கப்பட்ட ரிப்போர்ட் ஆகும்.
                    புதிய தரவிற்கு CSV கோப்புகளை மீண்டும் பதிவேற்றி பகுப்பாய்வு செய்யவும்.
                `;
                warningDiv.style.display = 'block';
            }
        }
    } catch (error) {
        console.error("பழைய ரிப்போர்ட் சரிபார்த்தல் தோல்வியுற்றது:", error);
    }
}

// ரீபிரஷ் அழியாமல் இருப்பதற்கு லோக்கல் ஸ்டோரேஜில் இருந்து லோட் செய்யும் செயல்பாடு
function loadFromLocalStorage() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) {
        alert("முன்னர் சேமிக்கப்பட்ட தரவு இல்லை.");
        return;
    }
    
    try {
        const parsedData = JSON.parse(savedData);
        storage = parsedData.storage || {};
        finalArray = parsedData.finalArray || [];
        originalOrder = parsedData.originalOrder || [];
        highlightedStocks = parsedData.highlightedStocks || [];
        columnMapping = parsedData.columnMapping || {
            "StocksTraded": {
                symbol: null,
                price: null,
                change: null,
                changePct: null,
                series: null
            }
        };
        
        // பதிவேற்றப்பட்ட கோப்புகளின் UI ஐப் புதுப்பிக்கவும்
        fileNames.forEach((name, i) => {
            if (storage[name]) {
                const previewDiv = document.getElementById(`preview-${i}`);
                const boxDiv = document.getElementById(`box-${i}`);
                
                if (previewDiv && boxDiv) {
                    const columns = Object.keys(storage[name][0] || {}).slice(0, 6);
                    previewDiv.innerHTML = `<strong>நெடுவரிசைகள்:</strong> ${columns.join(', ')}...<br>
                                           <strong>மொத்த வரிசைகள்:</strong> ${storage[name].length}`;
                    boxDiv.classList.add('loaded');
                    boxDiv.querySelector('i').className = 'fas fa-check-circle fa-2x text-success mb-2';
                }
            }
        });
        
        // டாஷ்போர்டை காண்பிக்கவும்
        if (finalArray.length > 0) {
            document.getElementById('dashboard').style.display = 'block';
            document.getElementById('totalRows').textContent = parsedData.totalRows || 0;
            document.getElementById('eqRows').textContent = parsedData.eqRows || 0;
            document.getElementById('highlightedRows').textContent = highlightedStocks.length;
            
            if (highlightedStocks.length > 0) {
                showHighlightedStocks();
                updateDashboard();
            }
            
            render();
            
            // சேமிக்கப்பட்ட தேதி தகவல்
            if (parsedData.saveTimestamp) {
                const savedDate = new Date(parsedData.saveTimestamp);
                const savedDateStr = savedDate.toLocaleDateString('ta-IN', {
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                });
                const savedTimeStr = savedDate.toLocaleTimeString('ta-IN', {
                    hour: '2-digit', 
                    minute: '2-digit'
                });
                
                document.getElementById('uploadStatus').innerHTML = 
                    `<div class="alert alert-warning d-inline-block">
                        <i class="fas fa-database"></i> 
                        சேமிக்கப்பட்ட தரவு ஏற்றப்பட்டது (${finalArray.length} பங்குகள்)<br>
                        <small>சேமிக்கப்பட்ட தேதி: ${savedDateStr} ${savedTimeStr}</small>
                    </div>`;
            } else {
                document.getElementById('uploadStatus').innerHTML = 
                    `<div class="alert alert-success d-inline-block">
                        <i class="fas fa-check"></i> 
                        முன்னர் சேமிக்கப்பட்ட தரவு ஏற்றப்பட்டது (${finalArray.length} பங்குகள்)
                    </div>`;
            }
            
            // தேதியைப் புதுப்பிக்கவும்
            updateReportTimestamp();
            
            // பழைய ரிப்போர்ட் சரிபார்க்கவும்
            checkIfOldReport();
            
            setTimeout(() => {
                document.getElementById('uploadStatus').innerHTML = '';
            }, 5000);
        }
    } catch (error) {
        console.error("தரவு ஏற்றம் தோல்வியுற்றது:", error);
        alert("தரவு ஏற்றம் தோல்வியுற்றது. மீண்டும் முயற்சிக்கவும்.");
    }
}

// லோக்கல் ஸ்டோரேஜில் சேமிக்கும் செயல்பாடு
function saveToLocalStorage() {
    if (finalArray.length === 0) {
        alert("முதலில் பகுப்பாய்வு செய்யவும்.");
        return;
    }
    
    const saveData = {
        storage: storage,
        finalArray: finalArray,
        originalOrder: originalOrder,
        highlightedStocks: highlightedStocks,
        columnMapping: columnMapping,
        totalRows: document.getElementById('totalRows').textContent,
        eqRows: document.getElementById('eqRows').textContent,
        saveTimestamp: new Date().toISOString()
    };
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
        alert(`தரவு வெற்றிகரமாக சேமிக்கப்பட்டது! (${finalArray.length} பங்குகள்)\n\nரீபிரஷ் செய்தாலும் தரவு அழியாது.`);
    } catch (error) {
        console.error("சேமிப்பு தோல்வியுற்றது:", error);
        alert("சேமிப்பு தோல்வியுற்றது. LocalStorage இடம் இல்லை.");
    }
}

// CSV கோப்பை படிக்கும் செயல்பாடு
function readCSV(event, type, idx) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('uploadStatus').innerHTML = 
        `<div class="alert alert-info d-inline-block"><i class="fas fa-spinner fa-spin"></i> "${type}" கோப்பு படிக்கப்படுகிறது...</div>`;
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(res) {
            const processedData = res.data.map(row => {
                const newRow = {};
                for (const key in row) {
                    if (row.hasOwnProperty(key)) {
                        const newKey = key.toLowerCase().trim();
                        newRow[newKey] = row[key];
                    }
                }
                return newRow;
            }).filter(row => {
                return Object.keys(row).length > 0 && 
                       !Object.values(row).every(val => val === '' || val === null || val === undefined);
            });
            
            storage[type] = processedData;
            
            if (processedData.length > 0) {
                const previewDiv = document.getElementById(`preview-${idx}`);
                const columns = Object.keys(processedData[0]).slice(0, 6);
                previewDiv.innerHTML = `<strong>நெடுவரிசைகள்:</strong> ${columns.join(', ')}...<br>
                                       <strong>மொத்த வரிசைகள்:</strong> ${processedData.length}`;
            }
            
            document.getElementById(`box-${idx}`).classList.add('loaded');
            document.getElementById(`box-${idx}`).querySelector('i').className = 'fas fa-check-circle fa-2x text-success mb-2';
            
            document.getElementById('uploadStatus').innerHTML = 
                `<div class="alert alert-success d-inline-block"><i class="fas fa-check"></i> "${type}" கோப்பு பதிவேற்றப்பட்டது (${processedData.length} பதிவுகள்)</div>`;
            
            setTimeout(() => {
                document.getElementById('uploadStatus').innerHTML = '';
            }, 3000);
            
            if (type === "StocksTraded" && processedData.length > 0) {
                autoDetectColumns(processedData[0], type);
                showDataPreview(processedData);
                showEQFilterInfo(processedData);
            }
        },
        error: function(err) {
            alert(`${type} கோப்பை படிக்க முடியவில்லை: ${err.message}`);
            document.getElementById('uploadStatus').innerHTML = 
                `<div class="alert alert-danger d-inline-block"><i class="fas fa-exclamation-triangle"></i> "${type}" கோப்பு பதிவேற்றம் தோல்வியுற்றது</div>`;
        }
    });
}

// CSV தரவு மாதிரியை காண்பிக்கும் செயல்பாடு
function showDataPreview(data) {
    const previewDiv = document.getElementById('dataPreview');
    if (data.length > 0) {
        previewDiv.innerHTML = `
            <strong><i class="fas fa-table text-info"></i> StocksTraded.csv தரவு மாதிரி (முதல் 3 வரிசைகள்):</strong><br>
            <div style="max-height: 200px; overflow-y: auto; background: white; padding: 10px; border-radius: 5px; margin-top: 5px;">
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            ${Object.keys(data[0]).slice(0, 6).map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 3).map(row => `
                            <tr>
                                ${Object.keys(row).slice(0, 6).map(col => `<td>${row[col] || ''}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="mb-0 mt-2"><strong>மொத்த வரிசைகள்:</strong> ${data.length} | <strong>நெடுவரிசைகள்:</strong> ${Object.keys(data[0]).length}</p>
        `;
        previewDiv.style.display = 'block';
    }
}

// EQ வடிகட்டல் தகவலை காண்பிக்கும் செயல்பாடு
function showEQFilterInfo(data) {
    const eqInfoDiv = document.getElementById('eqFilterInfo');
    
    if (data.length > 0) {
        const seriesColumn = findSeriesColumn(data[0]);
        
        if (seriesColumn) {
            let eqCount = 0;
            let nonEqCount = 0;
            let seriesTypes = {};
            
            data.forEach(row => {
                const seriesValue = row[seriesColumn] ? String(row[seriesColumn]).trim().toUpperCase() : '';
                if (seriesTypes[seriesValue]) {
                    seriesTypes[seriesValue]++;
                } else {
                    seriesTypes[seriesValue] = 1;
                }
                
                if (seriesValue === 'EQ') {
                    eqCount++;
                } else {
                    nonEqCount++;
                }
            });
            
            const seriesList = Object.entries(seriesTypes)
                .map(([type, count]) => `${type}: ${count}`)
                .join(', ');
            
            eqInfoDiv.innerHTML = `
                <strong><i class="fas fa-filter text-success"></i> Series வடிகட்டல் தகவல்:</strong><br>
                <strong>Series நெடுவரிசை:</strong> <code>${seriesColumn}</code><br>
                <strong>EQ பங்குகள்:</strong> ${eqCount} | <strong>மற்ற Series:</strong> ${nonEqCount}<br>
                <strong>அனைத்து Series வகைகள்:</strong> ${seriesList}<br>
                <span class="text-success"><i class="fas fa-info-circle"></i> <strong>EQ பங்குகள் மட்டும் பகுப்பாய்வு செய்யப்படும்.</strong></span>
            `;
            eqInfoDiv.style.display = 'block';
        } else {
            eqInfoDiv.innerHTML = `
                <strong><i class="fas fa-exclamation-triangle text-warning"></i> Series நெடுவரிசை கண்டறியப்படவில்லை:</strong><br>
                CSV கோப்பில் "series", "SERIES", "Series" போன்ற நெடுவரிசை பெயர் இருக்க வேண்டும்.
            `;
            eqInfoDiv.style.display = 'block';
        }
    }
}

// Series நெடுவரிசையைக் கண்டறிதல்
function findSeriesColumn(row) {
    const seriesKeys = ['series', 'series', 'ser', 'type', 'segment'];
    for (let key of seriesKeys) {
        const found = Object.keys(row).find(k => {
            const kNorm = k.trim().toLowerCase().replace(/[^a-z]/g, '');
            const keyNorm = key.trim().toLowerCase().replace(/[^a-z]/g, '');
            return kNorm === keyNorm;
        });
        if (found) return found;
    }
    return null;
}

// CSV தரவிலிருந்து மதிப்பை பெறுவதற்கான செயல்பாடு
function getValue(obj, keys) {
    if (!obj) return null;
    
    for (let key of keys) {
        const found = Object.keys(obj).find(k => {
            const kNorm = k.trim().toLowerCase().replace(/[^a-z0-9%]/g, '');
            const keyNorm = key.trim().toLowerCase().replace(/[^a-z0-9%]/g, '');
            return kNorm === keyNorm;
        });
        if (found && obj[found] !== undefined && obj[found] !== "") {
            return obj[found];
        }
    }
    return null;
}

// நெடுவரிசைகளை தானாக கண்டறிதல்
function autoDetectColumns(row, type) {
    if (!row) return;
    
    const columnNames = Object.keys(row);
    
    const symbolKeys = ['symbol', 'ticker', 'scrip', 'stock', 'company', 'name', 'security'];
    columnMapping[type].symbol = findMatchingColumn(columnNames, symbolKeys);
    
    const priceKeys = ['ltp', 'last price', 'close', 'price', 'last', 'cmp', 'current', 'last traded price'];
    columnMapping[type].price = findMatchingColumn(columnNames, priceKeys);
    
    const changeKeys = ['change', 'chg', 'netchng', 'change_amt', 'change_value', 'net change', 'changeinprice', 'chng'];
    columnMapping[type].change = findMatchingColumn(columnNames, changeKeys);
    
    const changePctKeys = ['%chng', 'pct_chg', '%change', 'chg_pct', 'change_pct', 'pctchg', '% chng', '%change', 'percent change', 'pct_change', '%chg'];
    columnMapping[type].changePct = findMatchingColumn(columnNames, changePctKeys);
    
    const seriesKeys = ['series', 'series', 'ser', 'type', 'segment'];
    columnMapping[type].series = findMatchingColumn(columnNames, seriesKeys);
}

// பொருந்தும் நெடுவரிசையை கண்டறிதல்
function findMatchingColumn(availableColumns, possibleNames) {
    for (let name of possibleNames) {
        const found = availableColumns.find(col => {
            const colNorm = col.trim().toLowerCase().replace(/[^a-z0-9%]/g, '');
            const nameNorm = name.trim().toLowerCase().replace(/[^a-z0-9%]/g, '');
            return colNorm === nameNorm;
        });
        if (found) return found;
    }
    return null;
}

// நெடுவரிசை தகவலை காண்பிக்கும் செயல்பாடு
function showColumnInfo() {
    const infoDiv = document.getElementById('columnInfo');
    const mapping = columnMapping["StocksTraded"];
    
    if (mapping.symbol && mapping.price && mapping.series) {
        infoDiv.innerHTML = `
            <strong><i class="fas fa-check-circle text-success"></i> முக்கிய நெடுவரிசைகள் கண்டறியப்பட்டன:</strong><br>
            • பங்கு பெயர்: <code>${mapping.symbol}</code><br>
            • விலை: <code>${mapping.price}</code><br>
            • Series: <code>${mapping.series}</code> <span class="series-badge">EQ மட்டும்</span><br>
            • மாற்றம் %: ${mapping.changePct ? `<code>${mapping.changePct}</code>` : '<span class="text-danger">காணவில்லை</span>'}<br>
            • மாற்றம் தொகை: ${mapping.change ? `<code>${mapping.change}</code> (CSV இல் இருந்து)` : '<span class="text-warning">காணவில்லை - கணக்கிடப்படும்</span>'}
        `;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.innerHTML = `
            <strong><i class="fas fa-exclamation-triangle text-warning"></i> முக்கிய நெடுவரிசைகள் கண்டறியப்படவில்லை:</strong><br>
            • பங்கு பெயர்: ${mapping.symbol || '<span class="text-danger">காணவில்லை</span>'}<br>
            • விலை: ${mapping.price || '<span class="text-danger">காணவில்லை</span>'}<br>
            • Series: ${mapping.series || '<span class="text-danger">காணவில்லை</span> (EQ வடிகட்டல் வேண்டும்)'}<br>
            <button class="btn btn-sm btn-warning mt-2" onclick="checkColumns()">மீண்டும் சரிபார்க்கவும்</button>
        `;
        infoDiv.style.display = 'block';
    }
}

// மாற்றம் தொகை கணக்கீடு பற்றிய தகவலை காண்பிக்கும் செயல்பாடு
function showChangeCalculationInfo() {
    alert(`மாற்றம் தொகை கணக்கீடு:\n\n` +
          `1. CSV கோப்பில் "change" நெடுவரிசை இல்லாவிட்டால்:\n` +
          `   மாற்றம் தொகை = (தற்போதைய விலை × மாற்றம் சதவீதம்) ÷ 100\n\n` +
          `2. BUY டார்கெட்/ஸ்டாப் லாஸ்:\n` +
          `   டார்கெட் = விலை + (மாற்றம் × 1.5)\n` +
          `   ஸ்டாப் லாஸ் = விலை - (மாற்றம் × 1.0)\n\n` +
          `3. SELL டார்கெட்/ஸ்டாப் லாஸ்:\n` +
          `   டார்கெட் = விலை - (மாற்றம் × 1.0)\n` +
          `   ஸ்டாப் லாஸ் = விலை + (மாற்றம் × 1.5)\n\n` +
          `குறிப்பு: BUY மற்றும் SELL இரண்டுக்கும் டார்கெட்/ஸ்டாப் லாஸ் கணக்கிடப்படும்.`);
}

// CSV தரவை சரிபார்க்கும் செயல்பாடு
function checkColumns() {
    const master = storage["StocksTraded"];
    if (!master || master.length === 0) {
        alert("முதலில் StocksTraded CSV கோப்பை பதிவேற்றவும்.");
        return;
    }
    
    autoDetectColumns(master[0], "StocksTraded");
    showColumnInfo();
    showDataPreview(master);
    showEQFilterInfo(master);
    
    const columns = Object.keys(master[0]);
    const columnsDiv = document.getElementById('columnInfo');
    columnsDiv.innerHTML += `
        <div class="mt-3">
            <strong>CSV கோப்பில் உள்ள அனைத்து நெடுவரிசைகள்:</strong><br>
            <div style="max-height: 150px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                ${columns.map(col => `<code>${col}</code>`).join(', ')}
            </div>
            <p class="mt-2 mb-0"><strong>மொத்த வரிசைகள்:</strong> ${master.length}</p>
        </div>
    `;
}

// எண் மதிப்பை பாகுபடுத்தும் செயல்பாடு
function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    
    const str = String(value).trim();
    const cleanStr = str.replace('%', '').replace(/,/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

// மாற்றம் தொகை கணக்கிடும் செயல்பாடு
function calculateChange(ltp, pct) {
    return (ltp * pct) / 100;
}

// டார்கெட் விலை கணக்கிடும் செயல்பாடு
function calculateTarget(ltp, change, signal) {
    if (signal === "BUY") {
        return ltp + (Math.abs(change) * 1.5);
    } else if (signal === "SELL") {
        return ltp - (Math.abs(change) * 1.0);
    }
    return 0;
}

// ஸ்டாப் லாஸ் கணக்கிடும் செயல்பாடு
function calculateStopLoss(ltp, change, signal) {
    if (signal === "BUY") {
        return ltp - (Math.abs(change) * 1.0);
    } else if (signal === "SELL") {
        return ltp + (Math.abs(change) * 1.5);
    }
    return 0;
}

// காரணங்களை எண்ணும் செயல்பாடு
function countReasons(reasonText) {
    if (!reasonText || reasonText === "சந்தை நடுநிலையாக உள்ளது" || 
        reasonText === "மிகக் குறைந்த மாற்றம்" || 
        reasonText === "வர்த்தகம் செய்யப்பட்ட பங்கு") {
        return 0;
    }
    
    return reasonText.split(',').length;
}

// அனைத்து முக்கிய பங்குகளைத் தேர்ந்தெடுக்கும்/நீக்கும் செயல்பாடு
function toggleSelectAllTopStocks() {
    const selectAllCheckbox = document.getElementById('selectAllTopStocks');
    const checkboxes = document.querySelectorAll('.top-stock-checkbox');
    
    if (selectAllCheckbox.checked) {
        selectedTopStocks.clear();
        highlightedStocks.forEach((stock, index) => {
            selectedTopStocks.add(index);
        });
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    } else {
        selectedTopStocks.clear();
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    updateSelectedCount();
}

// ஒரு முக்கிய பங்கைத் தேர்ந்தெடுக்கும் செயல்பாடு
function toggleTopStockSelection(index) {
    if (selectedTopStocks.has(index)) {
        selectedTopStocks.delete(index);
    } else {
        selectedTopStocks.add(index);
    }
    
    const selectAllCheckbox = document.getElementById('selectAllTopStocks');
    const checkboxes = document.querySelectorAll('.top-stock-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
    
    updateSelectedCount();
}

// தேர்ந்தெடுக்கப்பட்ட எண்ணிக்கையை புதுப்பிக்கும் செயல்பாடு
function updateSelectedCount() {
    const badge = document.getElementById('selectedCountBadge');
    if (selectedTopStocks.size > 0) {
        badge.textContent = `${selectedTopStocks.size} தேர்ந்தெடுக்கப்பட்டது`;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// டாஸ்போர்டு காண்பிக்கும் செயல்பாடு
function showDashboard() {
    const dashboardDiv = document.getElementById('topStocksDashboard');
    const topStocksSection = document.getElementById('topStocksSection');
    
    topStocksSection.style.display = 'none';
    dashboardDiv.style.display = 'block';
    
    updateDashboard();
    
    dashboardDiv.scrollIntoView({ behavior: 'smooth' });
}

// டாஸ்போர்டை புதுப்பிக்கும் செயல்பாடு
function updateDashboard() {
    if (highlightedStocks.length === 0) {
        alert("முதலில் முக்கிய பங்குகள் இருந்தால் மட்டுமே டாஸ்போர்டு காண்பிக்க முடியும்.");
        return;
    }
    
    // மொத்த புள்ளிவிவரங்கள்
    const total = highlightedStocks.length;
    let buyCount = 0, sellCount = 0, holdCount = 0;
    let totalReasons = 0;
    
    highlightedStocks.forEach(stock => {
        if (stock.signal === "BUY") buyCount++;
        else if (stock.signal === "SELL") sellCount++;
        else holdCount++;
        
        totalReasons += stock.reasonCount;
    });
    
    document.getElementById('dash-total').textContent = total;
    document.getElementById('dash-buy').textContent = buyCount;
    document.getElementById('dash-sell').textContent = sellCount;
    document.getElementById('dash-hold').textContent = holdCount;
    document.getElementById('buy-count').textContent = buyCount;
    document.getElementById('sell-count').textContent = sellCount;
    document.getElementById('reason-count').textContent = totalReasons;
    
    const avgReasons = total > 0 ? (totalReasons / total).toFixed(1) : "0";
    document.getElementById('dash-avg-reasons').textContent = avgReasons;
    
    // முதல் 5 BUY பங்குகள்
    const buyStocks = highlightedStocks.filter(s => s.signal === "BUY")
        .sort((a, b) => b.reasonCount - a.reasonCount || b.rawPct - a.rawPct)
        .slice(0, 5);
    
    let buyHtml = '';
    buyStocks.forEach((stock, i) => {
        const badgeClass = stock.signal === "BUY" ? "target-badge" : "sell-target-badge";
        
        buyHtml += `
            <div class="dashboard-stock-item buy-item">
                <div class="stock-info">
                    <div class="stock-symbol">${i+1}. ${stock.symbol}</div>
                    <div class="stock-price">விலை: ₹${stock.ltp} | மாற்றம்: ${stock.pct}%</div>
                    <div class="small text-muted mt-1">${stock.reason.substring(0, 50)}...</div>
                </div>
                <div class="text-end">
                    <div class="stock-reason-count mb-1">${stock.reasonCount} காரணங்கள்</div>
                    <span class="${badgeClass}">டார்கெட்: ₹${stock.target}</span>
                </div>
            </div>
        `;
    });
    
    if (buyHtml === '') {
        buyHtml = '<div class="text-center text-muted py-3">BUY பங்குகள் இல்லை</div>';
    }
    document.getElementById('top-buy-stocks').innerHTML = buyHtml;
    
    // முதல் 5 SELL பங்குகள்
    const sellStocks = highlightedStocks.filter(s => s.signal === "SELL")
        .sort((a, b) => b.reasonCount - a.reasonCount || a.rawPct - b.rawPct)
        .slice(0, 5);
    
    let sellHtml = '';
    sellStocks.forEach((stock, i) => {
        const badgeClass = stock.signal === "SELL" ? "sell-target-badge" : "target-badge";
        
        sellHtml += `
            <div class="dashboard-stock-item sell-item">
                <div class="stock-info">
                    <div class="stock-symbol">${i+1}. ${stock.symbol}</div>
                    <div class="stock-price">விலை: ₹${stock.ltp} | மாற்றம்: ${stock.pct}%</div>
                    <div class="small text-muted mt-1">${stock.reason.substring(0, 50)}...</div>
                </div>
                <div class="text-end">
                    <div class="stock-reason-count mb-1">${stock.reasonCount} காரணங்கள்</div>
                    <span class="${badgeClass}">டார்கெட்: ₹${stock.target}</span>
                </div>
            </div>
        `;
    });
    
    if (sellHtml === '') {
        sellHtml = '<div class="text-center text-muted py-3">SELL பங்குகள் இல்லை</div>';
    }
    document.getElementById('top-sell-stocks').innerHTML = sellHtml;
    
    // அதிக காரணங்கள் கொண்ட பங்குகள்
    const topReasonStocks = [...highlightedStocks]
        .sort((a, b) => b.reasonCount - a.reasonCount)
        .slice(0, 8);
    
    let reasonHtml = '';
    topReasonStocks.forEach((stock, i) => {
        const signalColor = stock.signal === "BUY" ? "#10b981" : 
                          stock.signal === "SELL" ? "#ef4444" : "#f59e0b";
        const borderColor = stock.signal === "BUY" ? "buy-item" : 
                           stock.signal === "SELL" ? "sell-item" : "hold-item";
        
        reasonHtml += `
            <div class="dashboard-stock-item ${borderColor}">
                <div class="stock-info">
                    <div class="stock-symbol">${i+1}. ${stock.symbol} 
                        <span class="badge-custom" style="background-color:${signalColor}; font-size:10px; padding:2px 6px;">${stock.signal}</span>
                    </div>
                    <div class="stock-price">விலை: ₹${stock.ltp} | மாற்றம்: ₹${stock.change} (${stock.pct}%)</div>
                </div>
                <div class="text-end">
                    <div class="stock-reason-count mb-1">${stock.reasonCount} காரணங்கள்</div>
                    <div class="small text-muted">${stock.reason.substring(0, 60)}...</div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('top-reason-stocks').innerHTML = reasonHtml;
    
    // விளக்கப்படத்தை உருவாக்கவும்
    createSignalChart(buyCount, sellCount, holdCount);
    
    // தேர்வு புள்ளிவிவரங்களைப் புதுப்பிக்கவும்
    updateDashboardSelection();
}

// விளக்கப்படம் உருவாக்கும் செயல்பாடு
function createSignalChart(buy, sell, hold) {
    const placeholder = document.getElementById('signalChartPlaceholder');
    
    const total = buy + sell + hold;
    
    if (total > 0) {
        const buyPct = Math.round((buy / total) * 100);
        const sellPct = Math.round((sell / total) * 100);
        const holdPct = Math.round((hold / total) * 100);
        
        placeholder.innerHTML = `
            <div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center;">
                <div style="display: flex; flex-direction: column; width: 100%; gap: 10px;">
                    <div style="display: flex; align-items: center;">
                        <div style="width: 100px; text-align: right; padding-right: 10px; font-size: 12px; font-weight: 600; color: #10b981;">BUY (${buy})</div>
                        <div style="flex: 1; height: 20px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${buyPct}%; height: 100%; background: #10b981;"></div>
                        </div>
                        <div style="width: 40px; text-align: left; padding-left: 10px; font-size: 12px;">${buyPct}%</div>
                    </div>
                    
                    <div style="display: flex; align-items: center;">
                        <div style="width: 100px; text-align: right; padding-right: 10px; font-size: 12px; font-weight: 600; color: #ef4444;">SELL (${sell})</div>
                        <div style="flex: 1; height: 20px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${sellPct}%; height: 100%; background: #ef4444;"></div>
                        </div>
                        <div style="width: 40px; text-align: left; padding-left: 10px; font-size: 12px;">${sellPct}%</div>
                    </div>
                    
                    <div style="display: flex; align-items: center;">
                        <div style="width: 100px; text-align: right; padding-right: 10px; font-size: 12px; font-weight: 600; color: #f59e0b;">HOLD (${hold})</div>
                        <div style="flex: 1; height: 20px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${holdPct}%; height: 100%; background: #f59e0b;"></div>
                        </div>
                        <div style="width: 40px; text-align: left; padding-left: 10px; font-size: 12px;">${holdPct}%</div>
                    </div>
                </div>
            </div>
        `;
    }
}

// டாஸ்போர்டு வடிகட்டல்கள்
function showDashboardBuyOnly() {
    document.getElementById('reasonFilter').value = 'HIGHLIGHT';
    document.getElementById('sigFilter').value = 'BUY';
    filter();
    showDashboard();
}

function showDashboardSellOnly() {
    document.getElementById('reasonFilter').value = 'HIGHLIGHT';
    document.getElementById('sigFilter').value = 'SELL';
    filter();
    showDashboard();
}

function showDashboardMultiReason() {
    document.getElementById('reasonFilter').value = 'MULTIPLE';
    document.getElementById('sigFilter').value = 'ALL';
    filter();
    showDashboard();
}

// டாஸ்போர்டு தரவை பதிவிறக்கும் செயல்பாடு
function exportDashboardData() {
    if (highlightedStocks.length === 0) {
        alert("டாஸ்போர்டு தரவு இல்லை.");
        return;
    }
    
    let csvContent = "எண்,பங்கு பெயர்,விலை (₹),மாற்றம் தொகை,மாற்றம் %,சிக்னல்,காரணங்கள்,காரணம்,டார்கெட்,ஸ்டாப் லாஸ்\n";
    
    highlightedStocks.forEach((item, i) => {
        csvContent += `${i+1},"${item.symbol}",${item.ltp},${item.change},${item.pct},"${item.signal}",${item.reasonCount},"${item.reason}",${item.target},${item.stopLoss}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "முக்கிய_பங்குகள்_டாஸ்போர்டு.csv");
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// முக்கிய பங்குகளை காட்டும் செயல்பாடு
function showHighlightedStocks() {
    if (highlightedStocks.length === 0) {
        alert("1 க்கு மேற்பட்ட காரணங்கள் உள்ள பங்குகள் இல்லை.");
        return;
    }
    
    const topStocksSection = document.getElementById('topStocksSection');
    const topStocksList = document.getElementById('topStocksList');
    const dashboardDiv = document.getElementById('topStocksDashboard');
    
    dashboardDiv.style.display = 'none';
    topStocksSection.style.display = 'block';
    
    let html = '';
    highlightedStocks.forEach((stock, index) => {
        const targetBadgeClass = stock.signal === "BUY" ? "target-badge" : "sell-target-badge";
        const stopLossBadgeClass = stock.signal === "BUY" ? "stop-loss-badge" : "sell-stop-loss-badge";
        const isSelected = selectedTopStocks.has(index);
        
        html += `
            <div class="top-stock-item">
                <div style="flex: 0.5;">
                    <input class="form-check-input top-stock-checkbox" type="checkbox" 
                           id="topStockCheckbox${index}" 
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleTopStockSelection(${index})">
                </div>
                <div style="flex: 1.5;">
                    <strong>${index + 1}. ${stock.symbol}</strong>
                    <div class="small">விலை: ₹${stock.ltp} | மாற்றம்: ₹${stock.change} (${stock.pct}%)</div>
                    <div class="small text-muted">${stock.reason}</div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <div class="${targetBadgeClass} mb-1">டார்கெட்: ₹${stock.target}</div>
                    <div class="${stopLossBadgeClass}">ஸ்டாப் லாஸ்: ₹${stock.stopLoss}</div>
                </div>
                <div style="flex: 1; text-align: right;">
                    <span class="reason-count-badge mb-1">${stock.reasonCount} காரணங்கள்</span>
                    <span class="badge-custom" style="background-color:${stock.color}">${stock.signal}</span>
                </div>
            </div>
        `;
    });
    
    topStocksList.innerHTML = html;
    
    updateSelectedCount();
    
    topStocksSection.scrollIntoView({ behavior: 'smooth' });
}

// தேர்ந்தெடுக்கப்பட்ட முக்கிய பங்குகளை பிரிண்ட் செய்யும் செயல்பாடு
function printSelectedStocks() {
    if (selectedTopStocks.size === 0) {
        alert("முதலில் சில பங்குகளைத் தேர்ந்தெடுக்கவும்.");
        return;
    }
    
    const selectedIndices = Array.from(selectedTopStocks).sort((a, b) => a - b);
    const selectedStocks = selectedIndices.map(index => highlightedStocks[index]);
    
    preparePrintData(selectedStocks, "தேர்ந்தெடுக்கப்பட்ட முக்கிய பங்குகள்");
}

// தற்போதைய பக்கத்தை பிரிண்ட் செய்யும் செயல்பாடு
function printCurrentPage() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, finalArray.length);
    const currentData = finalArray.slice(startIndex, endIndex);
    
    preparePrintData(currentData, `பக்கம் ${currentPage} - பங்குகள்`);
}

// பிரிண்ட் தரவை தயார்படுத்தும் செயல்பாடு
function preparePrintData(stocks, title) {
    if (stocks.length === 0) {
        alert("பிரிண்ட் செய்ய பங்குகள் இல்லை.");
        return;
    }
    
    const printDate = new Date().toLocaleDateString('ta-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    
    document.getElementById('print-date').textContent = printDate;
    document.getElementById('print-total').textContent = stocks.length;
    
    let buyCount = 0, sellCount = 0, holdCount = 0;
    stocks.forEach(stock => {
        if (stock.signal === "BUY") buyCount++;
        else if (stock.signal === "SELL") sellCount++;
        else holdCount++;
    });
    
    document.getElementById('print-buy').textContent = buyCount;
    document.getElementById('print-sell').textContent = sellCount;
    document.getElementById('print-hold').textContent = holdCount;
    
    let printHtml = '';
    
    stocks.forEach((item, i) => {
        const targetBadgeClass = item.signal === "BUY" ? "target-badge" : "sell-target-badge";
        const stopLossBadgeClass = item.signal === "BUY" ? "stop-loss-badge" : "sell-stop-loss-badge";
        
        printHtml += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${i + 1}</td>
                <td style="border: 1px solid #ddd; padding: 8px;"><strong>${item.symbol}</strong></td>
                <td style="border: 1px solid #ddd; padding: 8px;">₹${item.ltp}</td>
                <td style="border: 1px solid #ddd; padding: 8px; ${parseFloat(item.pct) >= 0 ? 'color: var(--success-color);' : 'color: var(--danger-color);'}">
                    ${parseFloat(item.pct) >= 0 ? '+' : ''}${item.pct}%
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.series}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    <span style="background-color:${item.color}; color:white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                        ${item.signal}
                    </span>
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${item.reason}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    ${(item.signal === "BUY" || item.signal === "SELL") && parseFloat(item.rawTarget) > 0 ? 
                        `<span style="background-color:${item.signal === "BUY" ? 'var(--target-color)' : 'var(--sell-target-color)'}; color:white; padding: 2px 6px; border-radius: 8px; font-size: 11px;">
                            ₹${item.target}
                        </span>` : 
                        '<span style="color: #666; font-size: 11px;">-</span>'}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    ${(item.signal === "BUY" || item.signal === "SELL") && parseFloat(item.rawStopLoss) > 0 ? 
                        `<span style="background-color:${item.signal === "BUY" ? 'var(--stop-loss-color)' : 'var(--sell-stop-loss-color)'}; color:white; padding: 2px 6px; border-radius: 8px; font-size: 11px;">
                            ₹${item.stopLoss}
                        </span>` : 
                        '<span style="color: #666; font-size: 11px;">-</span>'}
                </td>
            </tr>
        `;
    });
    
    document.getElementById('print-body').innerHTML = printHtml;
    
    const printableArea = document.getElementById('printable-area');
    const titleElement = printableArea.querySelector('h2');
    titleElement.textContent = `📊 ${title} - ${printDate}`;
    
    printReport();
}

// பிரிண்ட் செய்யும் செயல்பாடு
function printReport() {
    const printableArea = document.getElementById('printable-area');
    
    printableArea.style.display = 'block';
    
    window.print();
    
    setTimeout(() => {
        printableArea.style.display = 'none';
    }, 100);
}

// அனைத்து பங்குகளையும் காட்டும் செயல்பாடு
function showAllStocks() {
    document.getElementById('topStocksSection').style.display = 'none';
    document.getElementById('topStocksDashboard').style.display = 'none';
    document.getElementById('reasonFilter').value = 'ALL';
    filter();
}

// அனைத்து முக்கிய பங்குகளை WhatsApp இல் பகிரும் செயல்பாடு
function shareAllTopStocks() {
    if (highlightedStocks.length === 0) {
        alert("முக்கிய பங்குகள் இல்லை.");
        return;
    }
    
    let message = "📈 *முக்கிய பங்கு பரிந்துரைகள்* 📈\n\n";
    message += `தேதி: ${new Date().toLocaleDateString('ta-IN')}\n`;
    message += `மொத்த முக்கிய பங்குகள்: ${highlightedStocks.length}\n\n`;
    
    highlightedStocks.forEach((stock, index) => {
        message += `*${index + 1}. ${stock.symbol}*\n`;
        message += `விலை: ₹${stock.ltp}\n`;
        message += `மாற்றம்: ₹${stock.change} (${stock.pct}%)\n`;
        message += `சிக்னல்: ${stock.signal}\n`;
        
        if (stock.signal === "BUY") {
            message += `🎯 டார்கெட்: ₹${stock.target}\n`;
            message += `🛑 ஸ்டாப் லாஸ்: ₹${stock.stopLoss}\n`;
        } else if (stock.signal === "SELL") {
            message += `🔻 டார்கெட்: ₹${stock.target}\n`;
            message += `🔼 ஸ்டாப் லாஸ்: ₹${stock.stopLoss}\n`;
        }
        
        message += `காரணம்: ${stock.reason}\n`;
        message += `---\n`;
    });
    
    message += `\n💡 *தகவல்:*\n`;
    message += `• EQ பங்குகள் மட்டும்\n`;
    message += `• 1 க்கு மேல் காரணங்கள் உள்ள பங்குகள்\n`;
    message += `• BUY & SELL இரண்டுக்கும் டார்கெட்/ஸ்டாப் லாஸ்\n\n`;
    message += `#பங்குச்சந்தை #பரிந்துரைகள்`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
}

// முக்கிய பகுப்பாய்வு செயல்பாடு
function analyzeEverything() {
    const master = storage["StocksTraded"];
    if (!master || master.length === 0) {
        alert("தயவு செய்து StocksTraded CSV கோப்பை பதிவேற்றவும்.");
        return;
    }
    
    const mapping = columnMapping["StocksTraded"];
    if (!mapping.symbol || !mapping.price || !mapping.series) {
        alert("CSV கோப்பில் பங்கு பெயர், விலை மற்றும் Series நெடுவரிசைகள் கண்டறியப்படவில்லை.");
        return;
    }
    
    const btn = document.getElementById('analyzeBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> பகுப்பாய்வு நடைபெறுகிறது...';
    btn.disabled = true;
    
    setTimeout(() => {
        let totalRows = master.length;
        let eqRows = 0;
        let nonEqRows = 0;
        
        highlightedStocks = [];
        selectedTopStocks.clear();
        
        finalArray = master.map((row, index) => {
            const symbol = row[mapping.symbol];
            if (!symbol || symbol.trim() === '') return null;
            
            const seriesValue = row[mapping.series] ? String(row[mapping.series]).trim().toUpperCase() : '';
            if (seriesValue !== 'EQ') {
                nonEqRows++;
                return null;
            }
            
            eqRows++;
            
            // விலை
            const ltp = parseNumber(row[mapping.price]);
            
            // மாற்றம் சதவீதம்
            let pct = 0;
            if (mapping.changePct) {
                pct = parseNumber(row[mapping.changePct]);
            }
            
            // மாற்றம் தொகை
            let change = 0;
            if (mapping.change && row[mapping.change]) {
                change = parseNumber(row[mapping.change]);
            } else {
                change = calculateChange(ltp, pct);
            }
            
            // மற்ற கோப்புகளில் இந்த பங்கு உள்ளதா என சரிபார்க்கவும்
            const is52H = storage["52WeekHigh"]?.some(d => 
                getValue(d, ['symbol', 'ticker']) === symbol
            );
            const is52L = storage["52WeekLow"]?.some(d => 
                getValue(d, ['symbol', 'ticker']) === symbol
            );
            const isUpper = storage["Upper Band"]?.some(d => 
                getValue(d, ['symbol', 'ticker']) === symbol
            );
            const isLower = storage["Lower Band"]?.some(d => 
                getValue(d, ['symbol', 'ticker']) === symbol
            );
            const isT20G = storage["T20-gainers"]?.some(d => 
                getValue(d, ['symbol', 'ticker']) === symbol
            );
            const isT20L = storage["T20-loosers"]?.some(d => 
                getValue(d, ['symbol', 'ticker']) === symbol
            );
            
            // பரிந்துரை மற்றும் காரணம் தீர்மானிக்கவும்
            let signal = "HOLD";
            let reason = "சந்தை நடுநிலையாக உள்ளது";
            let color = "#f59e0b";
            let reasonDetails = [];
            let reasonCount = 0;
            
            // காரணங்களை சேகரிக்கவும்
            if (is52H) reasonDetails.push("52 வார உயர்வு");
            if (isUpper) reasonDetails.push("மேல் பட்டை");
            if (isT20G) reasonDetails.push("இன்றைய முதல் 20 லாப பங்குகள்");
            if (pct > 2.0) reasonDetails.push(`${pct.toFixed(2)}% உயர்வு`);
            
            if (is52L) reasonDetails.push("52 வார தாழ்வு");
            if (isLower) reasonDetails.push("கீழ் பட்டை");
            if (isT20L) reasonDetails.push("இன்றைய முதல் 20 நஷ்ட பங்குகள்");
            if (pct < -2.0) reasonDetails.push(`${pct.toFixed(2)}% சரிவு`);
            
            reasonCount = reasonDetails.length;
            
            // சிக்னல் தீர்மானம்
            const buyScore = (is52H ? 2 : 0) + (isUpper ? 1 : 0) + (isT20G ? 3 : 0) + (pct > 2.0 ? 1 : 0);
            const sellScore = (is52L ? 2 : 0) + (isLower ? 1 : 0) + (isT20L ? 3 : 0) + (pct < -2.0 ? 1 : 0);
            
            if (buyScore >= 3 || (buyScore >= 1 && pct > 3.0)) {
                signal = "BUY";
                color = "#10b981";
                reason = reasonDetails.filter(r => !r.includes("சரிவு") && !r.includes("தாழ்வு")).join(", ");
            } else if (sellScore >= 3 || (sellScore >= 1 && pct < -3.0)) {
                signal = "SELL";
                color = "#ef4444";
                reason = reasonDetails.filter(r => !r.includes("உயர்வு") && !r.includes("உயர்வு")).join(", ");
            } else {
                if (reasonCount === 0) {
                    if (Math.abs(pct) < 0.5) reason = "மிகக் குறைந்த மாற்றம்";
                } else {
                    reason = reasonDetails.join(", ");
                }
            }
            
            if (!reason || reason.trim() === '') {
                reason = "சந்தை நடுநிலையாக உள்ளது";
            }
            
            // டார்கெட் மற்றும் ஸ்டாப் லாஸ் கணக்கிடு
            const target = calculateTarget(ltp, change, signal);
            const stopLoss = calculateStopLoss(ltp, change, signal);
            
            const stockData = {
                index: index + 1,
                symbol: symbol.trim(),
                ltp: ltp.toFixed(2),
                change: change.toFixed(2),
                pct: pct.toFixed(2),
                series: seriesValue,
                signal,
                reason,
                color,
                target: target > 0 ? target.toFixed(2) : "0.00",
                stopLoss: stopLoss > 0 ? stopLoss.toFixed(2) : "0.00",
                rawPct: pct,
                rawChange: change,
                rawTarget: target,
                rawStopLoss: stopLoss,
                reasonCount: countReasons(reason),
                is52H, is52L, isUpper, isLower, isT20G, isT20L
            };
            
            // 1 க்கு மேல் காரணங்கள் இருந்தால் முக்கிய பங்குகளில் சேர்க்கவும்
            if (stockData.reasonCount > 1) {
                highlightedStocks.push(stockData);
            }
            
            return stockData;
        }).filter(x => x !== null);
        
        document.getElementById('totalRows').textContent = totalRows;
        document.getElementById('eqRows').textContent = eqRows;
        document.getElementById('highlightedRows').textContent = highlightedStocks.length;
        
        highlightedStocks.sort((a, b) => b.reasonCount - a.reasonCount);
        
        originalOrder = [...finalArray];
        
        document.getElementById('dashboard').style.display = 'block';
        
        if (highlightedStocks.length > 0) {
            showHighlightedStocks();
            updateDashboard();
        }
        
        render();
        
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> பகுப்பாய்வை மீண்டும் செய்க';
        btn.disabled = false;
        
        saveToLocalStorage();
        
        // தேதியைப் புதுப்பிக்கவும்
        updateReportTimestamp();
        
        document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
        
    }, 1000);
}

// முடிவுகளை காட்டும் செயல்பாடு
function render(data = finalArray) {
    const resDiv = document.getElementById('results');
    const noResultsDiv = document.getElementById('noResults');
    const paginationDiv = document.getElementById('pagination');
    
    if (data.length === 0) {
        resDiv.innerHTML = '';
        noResultsDiv.style.display = 'block';
        paginationDiv.innerHTML = '';
        updateStats(0, 0, 0);
        return;
    }
    
    noResultsDiv.style.display = 'none';
    
    const reasonFilter = document.getElementById('reasonFilter').value;
    
    let filteredData = data;
    if (reasonFilter === 'MULTIPLE') {
        filteredData = data.filter(d => d.reasonCount > 1);
    } else if (reasonFilter === 'HIGHLIGHT') {
        filteredData = highlightedStocks;
    }
    
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const currentData = filteredData.slice(startIndex, endIndex);
    
    let b = 0, s = 0, h = 0;
    let html = '';
    
    currentData.forEach((item, i) => {
        if (item.signal === 'BUY') b++;
        else if (item.signal === 'SELL') s++;
        else h++;
        
        const waMsg = `பங்கு: ${item.symbol}%0ASeries: ${item.series}%0Aவிலை: ₹${item.ltp}%0Aமாற்றம்: ₹${item.change} (${item.pct}%)%0Aசிக்னல்: ${item.signal}%0Aகாரணம்: ${item.reason}`;
        
        const changeStyle = parseFloat(item.rawChange) !== 0 ? 
            (parseFloat(item.rawChange) >= 0 ? 'positive' : 'negative') : 
            'text-muted';
        
        const reasonClass = item.reasonCount > 1 ? 'reason-highlight' : '';
        
        const stockCardClass = item.reasonCount > 1 ? 'highlight' : '';
        
        const targetBadgeClass = item.signal === "BUY" ? "target-badge" : "sell-target-badge";
        const stopLossBadgeClass = item.signal === "BUY" ? "stop-loss-badge" : "sell-stop-loss-badge";
        
        html += `
            <tr class="${stockCardClass}">
                <td>${startIndex + i + 1}</td>
                <td><strong>${item.symbol}</strong></td>
                <td class="price-cell">₹${item.ltp}</td>
                <td class="${changeStyle} price-cell">${parseFloat(item.rawChange) >= 0 ? '+' : ''}${item.change}</td>
                <td class="percentage-change ${parseFloat(item.pct) >= 0 ? 'positive' : 'negative'} price-cell">${parseFloat(item.pct) >= 0 ? '+' : ''}${item.pct}%</td>
                <td><span class="series-badge">${item.series}</span></td>
                <td><span class="badge-custom" style="background-color:${item.color}">${item.signal}</span></td>
                <td>
                    <div class="${reasonClass}">
                        ${item.reason}
                        ${item.reasonCount > 1 ? 
                            `<span class="reason-count-badge ms-2">${item.reasonCount} காரணங்கள்</span>` : 
                            ''}
                    </div>
                </td>
                <td>
                    ${(item.signal === "BUY" || item.signal === "SELL") && parseFloat(item.rawTarget) > 0 ? 
                        `<span class="${targetBadgeClass}">₹${item.target}</span>` : 
                        '<span class="text-muted small">-</span>'}
                </td>
                <td>
                    ${(item.signal === "BUY" || item.signal === "SELL") && parseFloat(item.rawStopLoss) > 0 ? 
                        `<span class="${stopLossBadgeClass}">₹${item.stopLoss}</span>` : 
                        '<span class="text-muted small">-</span>'}
                </td>
                <td class="no-print"><a href="https://wa.me/?text=${waMsg}" target="_blank" class="whatsapp-icon" title="WhatsApp இல் பகிர்க"><i class="fab fa-whatsapp"></i></a></td>
            </tr>
        `;
    });
    
    resDiv.innerHTML = html;
    updateStats(filteredData.length, b, s, h);
    
    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(1)">முதல்</a>
            </li>
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">முந்தைய</a>
            </li>
        `;
        
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `;
        }
        
        paginationHtml += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">அடுத்து</a>
            </li>
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${totalPages})">கடைசி</a>
            </li>
        `;
    }
    
    paginationDiv.innerHTML = paginationHtml;
}

// பக்கத்தை மாற்றும் செயல்பாடு
function changePage(page) {
    if (page < 1 || page > Math.ceil(finalArray.length / itemsPerPage)) return;
    currentPage = page;
    render();
    window.scrollTo({ top: document.getElementById('resultsTable').offsetTop - 100, behavior: 'smooth' });
}

// புள்ளிவிவரங்களை புதுப்பிக்கும் செயல்பாடு
function updateStats(total, buy, sell, hold) {
    document.getElementById('totalS').innerText = total;
    document.getElementById('buyS').innerText = buy;
    document.getElementById('sellS').innerText = sell;
    document.getElementById('holdS').innerText = hold;
}

// தேடல் மற்றும் வடிகட்டல்
function filter() {
    const txt = document.getElementById('search').value.toUpperCase();
    const sig = document.getElementById('sigFilter').value;
    const pctFilter = document.getElementById('pctFilter').value;
    const reasonFilter = document.getElementById('reasonFilter').value;
    
    let filtered = originalOrder;
    
    if (reasonFilter === 'MULTIPLE') {
        filtered = originalOrder.filter(d => d.reasonCount > 1);
    } else if (reasonFilter === 'HIGHLIGHT') {
        filtered = highlightedStocks;
    }
    
    filtered = filtered.filter(d => {
        const symbolMatch = d.symbol.toUpperCase().includes(txt);
        const signalMatch = sig === 'ALL' || d.signal === sig;
        
        let pctMatch = true;
        if (pctFilter === 'POSITIVE') pctMatch = d.rawPct > 0;
        else if (pctFilter === 'NEGATIVE') pctMatch = d.rawPct < 0;
        else if (pctFilter === 'HIGH') pctMatch = d.rawPct > 2.0;
        else if (pctFilter === 'LOW') pctMatch = d.rawPct < -2.0;
        
        return symbolMatch && signalMatch && pctMatch;
    });
    
    const sortType = document.getElementById('sortFilter').value;
    switch(sortType) {
        case 'pct_high':
            filtered.sort((a, b) => b.rawPct - a.rawPct);
            break;
        case 'pct_low':
            filtered.sort((a, b) => a.rawPct - b.rawPct);
            break;
        case 'name':
            filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
            break;
        case 'reasons':
            filtered.sort((a, b) => b.reasonCount - a.reasonCount);
            break;
        case 'target_high':
            filtered.sort((a, b) => b.rawTarget - a.rawTarget);
            break;
    }
    
    currentPage = 1;
    finalArray = filtered;
    render();
}

// தரவை வரிசைப்படுத்துதல்
function sortData() {
    filter();
}

// தரவை ஏற்றுக்கொள்ளும் செயல்பாடு
function exportData() {
    if (finalArray.length === 0) {
        alert("முதலில் பகுப்பாய்வு செய்யவும்");
        return;
    }
    
    let csvContent = "எண்,பங்கு பெயர்,விலை (₹),மாற்றம் தொகை,மாற்றம் %,Series,சிக்னல்,காரணங்கள்,காரணம்,டார்கெட்,ஸ்டாப் லாஸ்\n";
    
    finalArray.forEach(item => {
        csvContent += `${item.index},"${item.symbol}",${item.ltp},${item.change},${item.pct},${item.series},"${item.signal}",${item.reasonCount},"${item.reason}",${item.target},${item.stopLoss}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "பங்கு_பகுப்பாய்வு_முடிவுகள்_EQ_மட்டும்.csv");
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}