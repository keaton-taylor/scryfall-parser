// Global variable to store all fetched card data
let allCardData = [];

document.getElementById("upload").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const csvData = event.target.result;
    const lines = csvData.split("\n");
    
    // Parse Manabox CSV format
    const manaboxData = parseManaboxCSV(lines);
    
    // Reset global data
    allCardData = [];
    fetchCardData(manaboxData);
  };
  reader.readAsText(file);
});

function parseManaboxCSV(lines) {
  const manaboxData = [];
  
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
        foil: fields[4].trim().toLowerCase() === 'true',
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
      
      manaboxData.push(cardData);
    }
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
      .then(res => res.json())
      .then(data => {
        // Merge Scryfall data with Manabox data
        const mergedData = data.data.map(scryfallCard => {
          const manaboxCard = batch.find(mbCard => 
            mbCard.name === scryfallCard.name && 
            mbCard.setCode === scryfallCard.set
          );
          return {
            ...scryfallCard,
            manaboxData: manaboxCard
          };
        });
        
        // Store card data globally
        allCardData = allCardData.concat(mergedData);
        
        completedBatches++;
        if (completedBatches === totalBatches) {
          // All batches completed, auto-export
          hideProgressIndicator();
          autoExportToShopify();
        }
      })
      .catch(error => {
        console.error("Error fetching card data:", error);
        completedBatches++;
        if (completedBatches === totalBatches) {
          hideProgressIndicator();
          autoExportToShopify();
        }
      });
    }, index * 1000); // 1 second delay between each batch
  });
}

function autoExportToShopify() {
  const container = document.getElementById("results");
  container.innerHTML = `
    <div class="export-complete">
      <h2>Processing Complete!</h2>
      <p>Found ${allCardData.length} cards. Exporting to Shopify format...</p>
    </div>
  `;
  
  // Auto-export both files
  setTimeout(() => {
    const productsCSV = generateShopifyProductsCSV();
    const inventoryCSV = generateShopifyInventoryCSV();
    
    downloadCSV(productsCSV, "shopify_products.csv");
    setTimeout(() => {
      downloadCSV(inventoryCSV, "shopify_inventory.csv");
      container.innerHTML = `
        <div class="export-complete">
          <h2>Export Complete!</h2>
          <p>Successfully exported ${allCardData.length} cards to Shopify format.</p>
          <p>Files downloaded:</p>
          <ul>
            <li>shopify_products.csv - Complete product catalog</li>
            <li>shopify_inventory.csv - Inventory quantities</li>
          </ul>
        </div>
      `;
    }, 200);
  }, 500);
}

function exportToShopifyProducts() {
  const csvContent = generateShopifyProductsCSV();
  downloadCSV(csvContent, "shopify_products.csv");
}

function exportToShopifyInventory() {
  const csvContent = generateShopifyInventoryCSV();
  downloadCSV(csvContent, "shopify_inventory.csv");
}

function exportToShopifyBoth() {
  const productsCSV = generateShopifyProductsCSV();
  const inventoryCSV = generateShopifyInventoryCSV();
  
  // Create a zip file or download both separately
  downloadCSV(productsCSV, "shopify_products.csv");
  setTimeout(() => {
    downloadCSV(inventoryCSV, "shopify_inventory.csv");
  }, 100);
}

function generateShopifyProductsCSV() {
  // Shopify Products CSV format
  const headers = [
    "Handle",
    "Title",
    "Body (HTML)",
    "Vendor",
    "Product Category",
    "Type",
    "Tags",
    "Published",
    "Option1 Name",
    "Option1 Value",
    "Option2 Name",
    "Option2 Value",
    "Option3 Name",
    "Option3 Value",
    "Variant SKU",
    "Variant Grams",
    "Variant Inventory Tracker",
    "Variant Inventory Qty",
    "Variant Inventory Policy",
    "Variant Fulfillment Service",
    "Variant Price",
    "Variant Compare At Price",
    "Variant Requires Shipping",
    "Variant Taxable",
    "Variant Barcode",
    "Image Src",
    "Image Position",
    "Gift Card",
    "SEO Title",
    "SEO Description",
    "Google Shopping / Google Product Category",
    "Google Shopping / Gender",
    "Google Shopping / Age Group",
    "Google Shopping / MPN",
    "Google Shopping / AdWords Grouping",
    "Google Shopping / AdWords Labels",
    "Google Shopping / Condition",
    "Google Shopping / Custom Product",
    "Google Shopping / Custom Label 0",
    "Google Shopping / Custom Label 1",
    "Google Shopping / Custom Label 2",
    "Google Shopping / Custom Label 3",
    "Google Shopping / Custom Label 4",
    "Variant Image",
    "Variant Weight Unit",
    "Variant Tax Code",
    "Cost per item",
    "Status"
  ];

  const rows = [headers.join(",")];

  allCardData.forEach(card => {
    const quantity = getCardQuantity(card);
    const price = card.prices?.usd || "0.00";
    const imageUrl = card.image_uris?.normal || "";
    
    const row = [
      generateHandle(card.name),
      card.name,
      generateProductDescription(card),
      "Magic: The Gathering",
      "Trading Cards",
      "Trading Card",
      `${card.set_name},${card.rarity}`,
      "TRUE",
      "Title",
      card.name,
      "Set",
      card.set_name,
      "Rarity",
      card.rarity,
      generateSKU(card),
      "5", // Default weight in grams
      "shopify",
      quantity,
      "deny",
      "manual",
      price,
      "",
      "TRUE",
      "TRUE",
      "",
      imageUrl, // This will be the image URL from Scryfall
      "1",
      "FALSE",
      card.name,
      `Magic: The Gathering ${card.name} from ${card.set_name}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "g",
      "",
      price,
      "active"
    ];

    rows.push(row.map(field => `"${field}"`).join(","));
  });

  return rows.join("\n");
}

function generateShopifyInventoryCSV() {
  // Shopify Inventory CSV format
  const headers = [
    "Handle",
    "Variant SKU",
    "Variant Inventory Qty"
  ];

  const rows = [headers.join(",")];

  allCardData.forEach(card => {
    const quantity = getCardQuantity(card);
    const row = [
      generateHandle(card.name),
      generateSKU(card),
      quantity
    ];

    rows.push(row.map(field => `"${field}"`).join(","));
  });

  return rows.join("\n");
}

function generateHandle(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function generateSKU(card) {
  const setCode = card.set?.toUpperCase() || "UNK";
  const cardNumber = card.collector_number || "000";
  return `${setCode}-${cardNumber}`;
}

function generateProductDescription(card) {
  const manaboxData = card.manaboxData;
  const condition = manaboxData ? manaboxData.condition : "NM";
  const foil = manaboxData ? manaboxData.foil : false;
  const language = manaboxData ? manaboxData.language : "English";
  
  return `
    <h2>${card.name}</h2>
    <p><strong>Set:</strong> ${card.set_name} (${manaboxData?.setCode || ""})</p>
    <p><strong>Rarity:</strong> ${card.rarity}</p>
    <p><strong>Type:</strong> ${card.type_line}</p>
    <p><strong>Condition:</strong> ${condition}</p>
    <p><strong>Foil:</strong> ${foil ? "Yes" : "No"}</p>
    <p><strong>Language:</strong> ${language}</p>
    ${card.oracle_text ? `<p><strong>Card Text:</strong><br>${card.oracle_text.replace(/\n/g, '<br>')}</p>` : ""}
    ${card.power && card.toughness ? `<p><strong>Power/Toughness:</strong> ${card.power}/${card.toughness}</p>` : ""}
    <p><strong>Artist:</strong> ${card.artist || "Unknown"}</p>
    ${manaboxData?.purchasePrice ? `<p><strong>Purchase Price:</strong> ${manaboxData.purchasePrice} ${manaboxData.purchasePriceCurrency}</p>` : ""}
  `.trim();
}

function getCardQuantity(card) {
  // Use quantity from Manabox data
  return card.manaboxData ? card.manaboxData.quantity : 1;
}

function showProgressIndicator(totalBatches) {
  const container = document.getElementById("results");
  const progressDiv = document.createElement("div");
  progressDiv.id = "progress-indicator";
  progressDiv.className = "progress-indicator";
  progressDiv.innerHTML = `
    <h3>Processing ${totalBatches} batches (70 cards each)...</h3>
    <div class="progress-bar">
      <div class="progress-fill" id="progress-fill"></div>
    </div>
    <p id="progress-text">Starting batch 1 of ${totalBatches}...</p>
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
  }
}
