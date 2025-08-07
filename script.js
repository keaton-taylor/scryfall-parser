// Global variables to store all fetched card data and track batches
let allCardData = [];
let logEntries = [];
let completedBatches = 0;
let totalBatches = 0;

// Logging function
function addLogEntry(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = {
    timestamp,
    message,
    type
  };
  logEntries.push(entry);
  updateLogDisplay();
}

function updateLogDisplay() {
  const logContainer = document.getElementById('log-container');
  if (logContainer) {
    logContainer.innerHTML = logEntries.map(entry => `
      <div class="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-b-0">
        <span class="text-xs text-gray-500 font-mono">${entry.timestamp}</span>
        <span class="text-sm ${getLogTypeColor(entry.type)}">${entry.message}</span>
      </div>
    `).join('');
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Save to local storage
    saveLogsToStorage();
  }
}

function saveLogsToStorage() {
  try {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logKey = `scryfall_logs_${timestamp}`;
    localStorage.setItem(logKey, JSON.stringify(logEntries));
  } catch (error) {
    console.warn('Could not save logs to localStorage:', error);
  }
}

function loadLogsFromStorage() {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const logKey = `scryfall_logs_${timestamp}`;
    const savedLogs = localStorage.getItem(logKey);
    if (savedLogs) {
      logEntries = JSON.parse(savedLogs);
      updateLogDisplay();
    }
  } catch (error) {
    console.warn('Could not load logs from localStorage:', error);
  }
}

function getLogTypeColor(type) {
  switch (type) {
    case 'success': return 'text-green-600';
    case 'error': return 'text-red-600';
    case 'warning': return 'text-yellow-600';
    case 'info': return 'text-blue-600';
    default: return 'text-gray-600';
  }
}

// Load any existing logs when page loads
document.addEventListener('DOMContentLoaded', function() {
  loadLogsFromStorage();
  addLogEntry(`🚀 Scryfall to Shopify Exporter loaded`, 'info');
});

document.getElementById("upload").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  addLogEntry(`📁 Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');

  const reader = new FileReader();
  reader.onload = function(event) {
    const csvData = event.target.result;
    const lines = csvData.split("\n");
    
    // Parse Manabox CSV format
    const manaboxData = parseManaboxCSV(lines);
    
    addLogEntry(`📊 Parsed ${manaboxData.length} cards from CSV`, 'success');
    
    fetchCardData(manaboxData);
  };
  reader.readAsText(file);
});

function parseManaboxCSV(lines) {
  // CRITICAL: Clear all previous data completely before processing new CSV
  allCardData = [];
  logEntries = [];
  completedBatches = 0;
  totalBatches = 0;
  
  const manaboxData = [];
  
  addLogEntry(`🔍 Parsing CSV with ${lines.length} lines (cleared all previous data)`, 'info');
  
  // Skip header row and process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma, but handle quoted fields properly
    const fields = parseCSVLine(line);
    
    if (fields.length >= 15) {
      const cardData = {
        name: fields[0].trim(),
        setCode: fields[1].trim(),
        setName: fields[2].trim(),
        collectorNumber: fields[3].trim(),
        foil: fields[4].trim().toLowerCase() === 'foil',
        rarity: fields[5].trim(),
        quantity: parseInt(fields[6]) || 1,
        manaboxId: fields[7].trim(),
        scryfallId: fields[8].trim(),
        purchasePrice: parseFloat(fields[9]) || 0,
        misprint: fields[10].trim().toLowerCase() === 'true',
        altered: fields[11].trim().toLowerCase() === 'true',
        condition: fields[12].trim(),
        language: fields[13].trim(),
        purchasePriceCurrency: fields[14].trim()
      };
      
      // Debug parsing for Drill Too Deep
      if (cardData.name.includes("Drill Too Deep")) {
        console.log(`PARSE DRILL: "${cardData.name}" - field[4]: "${fields[4]}", parsed foil: ${cardData.foil}`);
      }
      
      // Debug logging for parsing
      
      // Validate that we have essential data
      if (cardData.name && cardData.name.length > 0) {
        manaboxData.push(cardData);
      } else {
        addLogEntry(`⚠️ Skipping row ${i + 1}: Missing card name`, 'warning');
      }
    } else {
      addLogEntry(`⚠️ Skipping row ${i + 1}: Invalid format (${fields.length} fields, expected 15)`, 'warning');
    }
  }
  
  addLogEntry(`📋 Successfully parsed ${manaboxData.length} valid cards`, 'success');
  
  // Log sample data for debugging
  if (manaboxData.length > 0) {
    const sample = manaboxData[0];
    addLogEntry(`📝 Sample card: "${sample.name}" from ${sample.setName} (${sample.setCode})`, 'info');
  }
  
  return manaboxData;
}

function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  fields.push(currentField);
  return fields;
}

function fetchCardData(manaboxData) {
  const batched = [];
  while (manaboxData.length) {
    const batch = manaboxData.splice(0, 70); // Reduced to 70 cards per batch
    batched.push(batch);
  }

  let completedBatches = 0;
  const totalBatches = batched.length;

  addLogEntry(`🔄 Starting to fetch ${manaboxData.length} cards in ${totalBatches} batches`, 'info');

  // Show progress indicator
  showProgressIndicator(totalBatches);

  // Process batches with delays to respect rate limits
  batched.forEach((batch, index) => {
    setTimeout(() => {
      updateProgress(index + 1, totalBatches);
      
      const body = {
        identifiers: batch.map(card => ({ 
          name: card.name,
          set: card.setCode,
          collector_number: card.collectorNumber
        }))
      };

      fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      .then(res => {
        if (res.status === 429) {
          // Rate limit hit, wait longer and retry
          console.warn("Rate limit hit, waiting 2 seconds before retry...");
          setTimeout(() => {
            // Retry the same batch
            fetch("https://api.scryfall.com/cards/collection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            })
            .then(res => res.json())
            .then(data => processBatchData(data, batch))
            .catch(error => {
              console.error("Error on retry:", error);
              addLogEntry(`❌ Retry failed for batch ${completedBatches + 1}: ${error.message}`, 'error');
              completedBatches++;
              if (completedBatches === totalBatches) {
                hideProgressIndicator();
                autoExportToShopify();
              }
            });
          }, 2000);
          return;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          processBatchData(data, batch);
        }
      })
      .catch(error => {
        console.error("Error fetching card data:", error);
        addLogEntry(`❌ Error fetching batch ${completedBatches + 1}: ${error.message}`, 'error');
        completedBatches++;
        if (completedBatches === totalBatches) {
          hideProgressIndicator();
          autoExportToShopify();
        }
      });
    }, index * 200); // 200ms delay between batches (5 requests per second, well under the 10/sec limit)
  });
  
  function processBatchData(data, batch) {
    // Validate Scryfall response
    if (!data || !data.data || !Array.isArray(data.data)) {
      addLogEntry(`❌ Invalid Scryfall response for batch ${completedBatches + 1}`, 'error');
      console.error('Invalid Scryfall response:', data);
      completedBatches++;
      if (completedBatches === totalBatches) {
        hideProgressIndicator();
        autoExportToShopify();
      }
      return;
    }
    
    addLogEntry(`📡 Received ${data.data.length} cards from Scryfall for batch ${completedBatches + 1}`, 'info');
    
    // Merge Scryfall data with Manabox data - Scryfall is primary
    const mergedData = data.data.map(scryfallCard => {
      const manaboxCard = batch.find(mbCard => 
        mbCard.name === scryfallCard.name && 
        mbCard.setCode === scryfallCard.set
      );
      
      
      // Start with Scryfall data as the base
      const mergedCard = { ...scryfallCard };
      
      // Merge Manabox data into Scryfall structure where appropriate
      if (manaboxCard) {
        // Add Manabox-specific fields that Scryfall doesn't provide
        mergedCard.quantity = manaboxCard.quantity || 1;
        mergedCard.condition = manaboxCard.condition || "Near Mint";
        mergedCard.language = manaboxCard.language || "English";
        
        // For foil status, prioritize Manabox data over Scryfall data
        mergedCard.foil = manaboxCard.foil;
        
        // Debug logging for foil data
      } else {
        // Default values when no Manabox data exists
        mergedCard.quantity = 1;
        mergedCard.condition = "Near Mint";
        mergedCard.language = "English";
        mergedCard.foil = false; // Default to non-foil when no Manabox data
      }
      
      return mergedCard;
    });
    
    // Store card data globally
    allCardData = allCardData.concat(mergedData);
    
    
    completedBatches++;
    addLogEntry(`✅ Batch ${completedBatches}/${totalBatches} completed (${mergedData.length} cards)`, 'success');
    
    if (completedBatches === totalBatches) {
      // All batches completed, auto-export
      addLogEntry(`🎉 All ${allCardData.length} cards fetched successfully!`, 'success');
      hideProgressIndicator();
      autoExportToShopify();
    }
  }
}

function displayCardsGrid() {
  const cardsContainer = document.getElementById("cards-container");
  
  // Add section header
  const header = document.createElement("h2");
  header.className = "text-2xl font-bold text-gray-800 mb-6 text-center mt-8";
  header.textContent = "Card Collection";
  cardsContainer.appendChild(header);
  
  // Create grid container
  const gridContainer = document.createElement("div");
  gridContainer.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";
  
  // Add cards to grid
  allCardData.forEach(card => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow";
    
    const quantity = card.quantity || 1;
    const condition = card.condition || "NM";
    const foil = getCardFoil(card) === "Foil";
    
    cardDiv.innerHTML = `
      <div class="relative">
        <img src="${card.image_uris?.normal || ""}" alt="${card.name}" class="w-full h-48 object-cover">
        ${foil ? '<div class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold">FOIL</div>' : ''}
        ${quantity > 1 ? `<div class="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">×${quantity}</div>` : ''}
      </div>
      <div class="p-3">
        <h3 class="font-semibold text-gray-800 text-sm mb-1 truncate" title="${card.name}">${card.name}</h3>
        <p class="text-xs text-gray-600 mb-1">${card.set_name}</p>
        <p class="text-xs text-gray-500 mb-1">${card.rarity} • ${condition}</p>
        <p class="text-xs font-medium text-green-600">$${card.prices?.usd || "N/A"}</p>
      </div>
    `;
    
    gridContainer.appendChild(cardDiv);
  });
  
  cardsContainer.appendChild(gridContainer);
}

// Global flag to prevent multiple exports
let exportInProgress = false;

function autoExportToShopify() {
  // Prevent multiple simultaneous exports
  if (exportInProgress) {
    addLogEntry(`⚠️ Export already in progress, skipping duplicate call`, 'warning');
    return;
  }
  exportInProgress = true;
  
  const container = document.getElementById("results");
        container.innerHTML = `
        <div class="my-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center text-green-800">
          <h2 class="text-2xl font-bold mb-4">Processing Complete!</h2>
          <p class="text-lg">Found ${allCardData.length} cards. Exporting to Shopify format...</p>
        </div>
        <div class="mt-6 flex justify-center space-x-4 mb-4">
          <button onclick="exportLogs()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            📄 Export Logs
          </button>
          <button onclick="copyLogsToClipboard()" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
            📋 Copy Logs
          </button>
          <button onclick="clearLogs()" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
            🗑️ Clear Logs
          </button>
        </div>
        <div id="log-container" class="mt-6 max-h-64 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-4"></div>
      `;
  
  addLogEntry(`📤 Starting Shopify export for ${allCardData.length} cards...`, 'info');
  
  // Debug current data state
  debugDataState();
  
    // Auto-export single unified CSV file
  setTimeout(() => {
    const productsCSV = generateShopifyProductsCSV();
    
    addLogEntry(`📝 Generated shopify_products.csv with all product data`, 'info');
    downloadCSV(productsCSV, "shopify_products.csv");
      
          addLogEntry(`🎉 Export completed successfully!`, 'success');
    
    // Reset export flag
    exportInProgress = false;
    
    // Show export complete message and display cards
      container.innerHTML = `
        <div class="my-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center text-green-800">
          <h2 class="text-2xl font-bold mb-4">Export Complete!</h2>
          <p class="text-lg mb-4">Successfully exported ${allCardData.length} cards to Shopify format.</p>
          <p class="font-semibold mb-2">File downloaded:</p>
          <ul class="text-left inline-block space-y-1 mb-6">
            <li class="flex items-center">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              shopify_products.csv - Complete unified product catalog with all data
            </li>
          </ul>
        </div>
        <div class="mt-6 flex justify-center space-x-4 mb-4">
          <button onclick="exportLogs()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            📄 Export Logs
          </button>
          <button onclick="copyLogsToClipboard()" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
            📋 Copy Logs
          </button>
          <button onclick="clearLogs()" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
            🗑️ Clear Logs
          </button>
        </div>
        <div id="log-container" class="mt-6 max-h-64 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-4"></div>
        <div id="cards-container"></div>
      `;
      
      // Display cards in rows of 5
      displayCardsGrid();
  }, 500);
}

function exportToShopifyProducts() {
  const csvContent = generateShopifyProductsCSV();
  downloadCSV(csvContent, "shopify_products.csv");
}

function exportToShopifyInventory() {
  // Deprecated - now exports single unified CSV
  const csvContent = generateShopifyProductsCSV();
  downloadCSV(csvContent, "shopify_products.csv");
}

function exportToShopifyBoth() {
  // Deprecated - now exports single unified CSV
  const productsCSV = generateShopifyProductsCSV();
  downloadCSV(productsCSV, "shopify_products.csv");
}

function generateShopifyProductsCSV() {
  addLogEntry(`📝 Generating products CSV for ${allCardData.length} cards`, 'info');
  
  // Validate that we have data
  if (!allCardData || allCardData.length === 0) {
    addLogEntry(`❌ No card data available for products CSV`, 'error');
    return "";
  }
  
  // Exact Shopify Products CSV format - user specified headers in exact order
  const headers = "Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option1 Linked To,Option2 Name,Option2 Value,Option2 Linked To,Option3 Name,Option3 Value,Option3 Linked To,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Google Shopping / Google Product Category,Google Shopping / Gender,Google Shopping / Age Group,Google Shopping / MPN,Google Shopping / Condition,Google Shopping / Custom Product,Google Shopping / Custom Label 0,Google Shopping / Custom Label 1,Google Shopping / Custom Label 2,Google Shopping / Custom Label 3,Google Shopping / Custom Label 4,Google: Custom Product (product.metafields.mm-google-shopping.custom_product),Age group (product.metafields.shopify.age-group),Card attributes (product.metafields.shopify.card-attributes),Color (product.metafields.shopify.color-pattern),Condition (product.metafields.shopify.condition),Dice shape (product.metafields.shopify.dice-shape),Fabric (product.metafields.shopify.fabric),Neckline (product.metafields.shopify.neckline),Rarity (product.metafields.shopify.rarity),Recommended age group (product.metafields.shopify.recommended-age-group),Sleeve length type (product.metafields.shopify.sleeve-length-type),Target gender (product.metafields.shopify.target-gender),Theme (product.metafields.shopify.theme),Top length type (product.metafields.shopify.top-length-type),Toy/Game material (product.metafields.shopify.toy-game-material),Complementary products (product.metafields.shopify--discovery--product_recommendation.complementary_products),Related products (product.metafields.shopify--discovery--product_recommendation.related_products),Related products settings (product.metafields.shopify--discovery--product_recommendation.related_products_display),Search product boosts (product.metafields.shopify--discovery--product_search_boost.queries),Variant Image,Variant Weight Unit,Variant Tax Code,Cost per item,Status".split(",");

  const rows = [headers.join(",")];
  let validRows = 0;

  allCardData.forEach((card, index) => {
    // Validate essential card data
    if (!card.name || !card.set_name) {
      addLogEntry(`⚠️ Skipping card ${index + 1}: Missing name or set`, 'warning');
      return;
    }
    
    const quantity = getCardQuantity(card);
    const price = (card && card.prices && card.prices.usd) ? card.prices.usd : "0.00";
    const imageUrl = (card && card.image_uris && card.image_uris.normal) ? card.image_uris.normal : "";
    
    const row = [
      generateHandle(card),                                         // Handle
      card.name || "",                                              // Title
      generateProductDescription(card),                             // Body (HTML)
      "Harmless Offering",                                       // Vendor
      "Arts & Entertainment > Hobbies & Creative Arts > Collectibles > Collectible Trading Cards > Gaming Cards",                                              // Product Category
      "MTG Singles",                                               // Type
      generateTags(card),                                           // Tags
      "TRUE",                                                       // Published
      "Finish Type",                                                // Option1 Name
      getCardFoil(card),                                           // Option1 Value
      "",                                                          // Option1 Linked To
      "Condition",                                                  // Option2 Name
      getCardCondition(card),                                       // Option2 Value
      "",                                                          // Option2 Linked To
      "Set",                                                        // Option3 Name
      card.set_name || "",                                         // Option3 Value
      "",                                                          // Option3 Linked To
      generateSKU(card),                                           // Variant SKU
      "5",                                                         // Variant Grams
      "shopify",                                                   // Variant Inventory Tracker
      quantity,                                                    // Variant Inventory Qty
      "deny",                                                      // Variant Inventory Policy
      "manual",                                                    // Variant Fulfillment Service
      price,                                                       // Variant Price
      "",                                                          // Variant Compare At Price
      "TRUE",                                                      // Variant Requires Shipping
      "TRUE",                                                      // Variant Taxable
      "",                                                          // Variant Barcode
      imageUrl,                                                    // Image Src
      "1",                                                         // Image Position
      `${card.name || ""} - ${card.set_name || ""}`,             // Image Alt Text
      "FALSE",                                                     // Gift Card
      card.name || "",                                             // SEO Title
      `Magic: The Gathering ${card.name || ""} from ${card.set_name || ""}`,  // SEO Description
      "",                                                          // Google Shopping / Google Product Category
      "",                                                          // Google Shopping / Gender
      "",                                                          // Google Shopping / Age Group
      "",                                                          // Google Shopping / MPN
      "new",                                                       // Google Shopping / Condition
      "",                                                          // Google Shopping / Custom Product
      card.rarity || "",                                           // Google Shopping / Custom Label 0
      card.set_name || "",                                         // Google Shopping / Custom Label 1
      card.type_line || "",                                        // Google Shopping / Custom Label 2
      "",                                                          // Google Shopping / Custom Label 3
      "",                                                          // Google Shopping / Custom Label 4
      "",                                                          // Google: Custom Product (product.metafields.mm-google-shopping.custom_product)
      "",                                                          // Age group (product.metafields.shopify.age-group)
      generateCardAttributes(card),                                // Card attributes (product.metafields.shopify.card-attributes)
      generateCardColors(card),                                    // Color (product.metafields.shopify.color-pattern)
      getCardCondition(card),                                      // Condition (product.metafields.shopify.condition)
      "",                                                          // Dice shape (product.metafields.shopify.dice-shape)
      "",                                                          // Fabric (product.metafields.shopify.fabric)
      "",                                                          // Neckline (product.metafields.shopify.neckline)
      card.rarity || "",                                           // Rarity (product.metafields.shopify.rarity)
      "",                                                          // Recommended age group (product.metafields.shopify.recommended-age-group)
      "",                                                          // Sleeve length type (product.metafields.shopify.sleeve-length-type)
      "",                                                          // Target gender (product.metafields.shopify.target-gender)
      "",                                                          // Theme (product.metafields.shopify.theme)
      "",                                                          // Top length type (product.metafields.shopify.top-length-type)
      "",                                                          // Toy/Game material (product.metafields.shopify.toy-game-material)
      "",                                                          // Complementary products (product.metafields.shopify--discovery--product_recommendation.complementary_products)
      "",                                                          // Related products (product.metafields.shopify--discovery--product_recommendation.related_products)
      "",                                                          // Related products settings (product.metafields.shopify--discovery--product_recommendation.related_products_display)
      "",                                                          // Search product boosts (product.metafields.shopify--discovery--product_search_boost.queries)
      "",                                                          // Variant Image
      "g",                                                         // Variant Weight Unit
      "",                                                          // Variant Tax Code
      price,                                                       // Cost per item
      "active"                                                     // Status
    ];

    rows.push(row.map(field => `"${escapeCSVField(field)}"`).join(","));
    validRows++;
  });

  addLogEntry(`✅ Generated ${validRows} product rows`, 'success');
  return rows.join("\n");
}

// DEPRECATED: generateShopifyInventoryCSV - now using single unified CSV export
function generateShopifyInventoryCSV() {
  addLogEntry(`⚠️ generateShopifyInventoryCSV is deprecated - using unified products CSV instead`, 'warning');
  return generateShopifyProductsCSV();
}

function generateHandle(card) {
  const setCode = (card.set || "UNK").toLowerCase();
  const cardNumber = card.collector_number || "000";
  const cardName = card.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  
  return `${setCode}-${cardNumber}-${cardName}`;
}

function generateSKU(card) {
  const setCode = card.set?.toUpperCase() || "UNK";
  const cardNumber = card.collector_number || "000";
  return `${setCode}-${cardNumber}`;
}

function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return "";
  }
  // Convert to string and escape quotes by doubling them
  let stringField = String(field);
  
  // Replace all possible newline characters with <br> tags
  stringField = stringField.replace(/\r\n|\r|\n|\u2028|\u2029/g, '<br>');
  
  // Escape quotes by doubling them
  stringField = stringField.replace(/"/g, '""');
  
  return stringField;
}

function generateProductDescription(card) {
  // Follow the pattern: <p>Type Line - Rules Text</p>
  let description = "";
  
  if (card.type_line) {
    description += `<p>${card.type_line}`;
    
    // Add power/toughness for creatures
    if (card.power && card.toughness) {
      description += ` - ${card.power}/${card.toughness}`;
    }
    
    // Add oracle text if available
    if (card.oracle_text) {
      // Replace all possible newline characters with <br> tags
      const oracleText = card.oracle_text.replace(/\r\n|\r|\n|\u2028|\u2029/g, '<br>');
      description += ` - ${oracleText}`;
    }
    
    description += "</p>";
  } else if (card.oracle_text) {
    // If no type line but has oracle text, just show the oracle text
    const oracleText = card.oracle_text.replace(/\r\n|\r|\n|\u2028|\u2029/g, '<br>');
    description = `<p>${oracleText}</p>`;
  } else {
    // Fallback if no type line or oracle text
    description = `<p>${card.name || ""}</p>`;
  }
  
  return description;
}

function getCardQuantity(card) {
  // Use quantity from merged data (Scryfall + Manabox)
  return card.quantity || 1;
}

function getCardCondition(card) {
  // Get condition from merged data (Scryfall + Manabox)
  return card.condition || "Near Mint";
}

function getCardFoil(card) {
  // Prioritize Manabox foil data (from merged card data)
  if (card && card.foil !== undefined) {
    return card.foil ? "Foil" : "Non-Foil";
  }
  
  // Fallback to Scryfall data if Manabox data is not available
  if (card && card.finishes && Array.isArray(card.finishes)) {
    // Scryfall provides finishes array - check if it includes 'foil'
    if (card.finishes.includes('foil')) {
      return "Foil";
    } else if (card.finishes.includes('nonfoil')) {
      return "Non-Foil";
    }
  }
  
  // Don't use pricing as foil indicator - many cards have both foil and non-foil prices
  // This was incorrectly marking all cards as foil
  
  // Default to Non-Foil if no foil information is available
  return "Non-Foil";
}

function generateTags(card) {
  // Generate tags using actual Scryfall data and keywords
  const tags = [];
  
  // Add set code (always first)
  if (card && card.set) {
    tags.push(card.set.toUpperCase());
  }
  
  // Add Scryfall keywords if available
  if (card && card.keywords && Array.isArray(card.keywords)) {
    tags.push(...card.keywords);
  }
  
  // Add main card types from type_line
  if (card && card.type_line) {
    // Extract main types before any subtypes (before —)
    const mainTypes = card.type_line.split(/\s*[—\-]\s*/)[0];
    const types = mainTypes.split(/\s+/).filter(t => 
      ["Legendary", "Artifact", "Creature", "Enchantment", "Instant", "Sorcery", "Land", "Planeswalker", "Battle"].includes(t)
    );
    tags.push(...types);
  }
  
  // Add colors based on color identity or colors
  if (card && card.colors && card.colors.length > 0) {
    const colorMap = {
      'W': 'White',
      'U': 'Blue', 
      'B': 'Black',
      'R': 'Red',
      'G': 'Green'
    };
    if (card.colors.length === 1) {
      tags.push(colorMap[card.colors[0]] || card.colors[0]);
    } else if (card.colors.length > 1) {
      tags.push("Multicolor");
    }
  } else if (card && card.color_identity && card.color_identity.length > 0) {
    const colorMap = { 'W': 'White', 'U': 'Blue', 'B': 'Black', 'R': 'Red', 'G': 'Green' };
    if (card.color_identity.length === 1) {
      tags.push(colorMap[card.color_identity[0]] || card.color_identity[0]);
    } else if (card.color_identity.length > 1) {
      tags.push("Multicolor");
    }
  } else {
    tags.push("Colorless");
  }
  
  // Add mana value
  if (card && typeof card.cmc === 'number') {
    tags.push(`MV${card.cmc}`);
  }
  
  // Add foil status using Scryfall data first
  const foilStatus = getCardFoil(card);
  tags.push(foilStatus);
  
  // Add rarity if available
  if (card && card.rarity) {
    const rarityMap = {
      'common': 'Common',
      'uncommon': 'Uncommon', 
      'rare': 'Rare',
      'mythic': 'Mythic Rare'
    };
    tags.push(rarityMap[card.rarity.toLowerCase()] || card.rarity);
  }
  
  // Add language from merged data
  const language = card.language || "English";
  tags.push(language);
  
  return tags.length > 0 ? tags.join(", ") : "";
}

function generateCardAttributes(card) {
  // Generate card attributes for metafields
  const attributes = [];
  
  if (card.mana_cost) attributes.push(`Mana Cost: ${card.mana_cost}`);
  if (card.cmc) attributes.push(`CMC: ${card.cmc}`);
  if (card.power && card.toughness) attributes.push(`Power/Toughness: ${card.power}/${card.toughness}`);
  if (card.collector_number) attributes.push(`Collector Number: ${card.collector_number}`);
  
  return attributes.join(" | ");
}

function generateCardColors(card) {
  // Generate color information from card colors
  if (card && card.colors && card.colors.length > 0) {
    const colorMap = {
      'W': 'White',
      'U': 'Blue', 
      'B': 'Black',
      'R': 'Red',
      'G': 'Green'
    };
    return card.colors.map(c => colorMap[c] || c).join(",");
  }
  if (card && card.color_identity && card.color_identity.length > 0) {
    const colorMap = { 'W': 'White', 'U': 'Blue', 'B': 'Black', 'R': 'Red', 'G': 'Green' };
    return card.color_identity.map(c => colorMap[c] || c).join(",");
  }
  return "Colorless";
}

function showProgressIndicator(totalBatches) {
  const container = document.getElementById("results");
  const progressDiv = document.createElement("div");
  progressDiv.id = "progress-indicator";
  progressDiv.className = "my-8 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center";
  progressDiv.innerHTML = `
    <h3 class="text-xl font-semibold text-gray-800 mb-4">Processing ${totalBatches} batches (70 cards each)...</h3>
    <div class="w-full bg-gray-200 rounded-full h-5 mb-4">
      <div class="bg-blue-600 h-5 rounded-full transition-all duration-300" id="progress-fill" style="width: 0%"></div>
    </div>
    <p id="progress-text" class="text-gray-600">Starting batch 1 of ${totalBatches}...</p>
  `;
  container.appendChild(progressDiv);
}

function updateProgress(currentBatch, totalBatches) {
  const progressFill = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");
  
  if (progressFill && progressText) {
    const percentage = (currentBatch / totalBatches) * 100;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `Processing batch ${currentBatch} of ${totalBatches} (${currentBatch * 70} cards processed)...`;
  }
}

function hideProgressIndicator() {
  const progressIndicator = document.getElementById("progress-indicator");
  if (progressIndicator) {
    progressIndicator.remove();
  }
}

function downloadCSV(content, filename) {
  // Validate content before downloading
  if (!content || content.trim().length === 0) {
    addLogEntry(`❌ Cannot download ${filename}: Content is empty`, 'error');
    return;
  }
  
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const fileSize = (blob.size / 1024).toFixed(1);
    addLogEntry(`💾 Downloaded: ${filename} (${fileSize} KB)`, 'success');
    
    // Debug: Show first few lines of content
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 3).join('\n');
    addLogEntry(`📄 ${filename} preview: ${previewLines.substring(0, 100)}...`, 'info');
  }
}

function debugDataState() {
  addLogEntry(`🔍 DEBUG: allCardData length = ${allCardData.length}`, 'info');
  if (allCardData.length > 0) {
    const sample = allCardData[0];
    addLogEntry(`🔍 DEBUG: Sample card - Name: "${sample.name}", Set: "${sample.set_name}", Quantity: ${sample.quantity || 1}, Condition: ${sample.condition || "Near Mint"}`, 'info');
  }
}

function exportLogs() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logContent = logEntries.map(entry => 
    `[${entry.timestamp}] ${entry.message}`
  ).join('\n');
  
  const blob = new Blob([logContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scryfall-logs-${timestamp}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  
  addLogEntry(`📄 Logs exported to scryfall-logs-${timestamp}.txt`, 'success');
}

function copyLogsToClipboard() {
  const logContent = logEntries.map(entry => 
    `[${entry.timestamp}] ${entry.message}`
  ).join('\n');
  
  navigator.clipboard.writeText(logContent).then(() => {
    addLogEntry(`📋 Logs copied to clipboard`, 'success');
  }).catch(err => {
    addLogEntry(`❌ Failed to copy logs: ${err.message}`, 'error');
  });
}

function clearLogs() {
  logEntries = [];
  updateLogDisplay();
  addLogEntry(`🗑️ Logs cleared`, 'info');
}
