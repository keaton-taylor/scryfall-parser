// Global variable to store all fetched card data
let allCardData = [];

document.getElementById("upload").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const csvData = event.target.result;
    const lines = csvData.split("\n");
    const cardNames = lines.map(line => line.split(",")[0].trim()).filter(Boolean);

    // Reset global data
    allCardData = [];
    fetchCardData(cardNames);
  };
  reader.readAsText(file);
});

function fetchCardData(cardNames) {
  const batched = [];
  while (cardNames.length) {
    const batch = cardNames.splice(0, 75);
    batched.push(batch);
  }

  let completedBatches = 0;
  const totalBatches = batched.length;

  batched.forEach(batch => {
    const body = {
      identifiers: batch.map(name => ({ name }))
    };

    fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(res => res.json())
    .then(data => {
      // Store card data globally
      allCardData = allCardData.concat(data.data);
      displayCards(data.data);
      
      completedBatches++;
      if (completedBatches === totalBatches) {
        // All batches completed, show export buttons
        showExportButtons();
      }
    })
    .catch(error => {
      console.error("Error fetching card data:", error);
      completedBatches++;
      if (completedBatches === totalBatches) {
        showExportButtons();
      }
    });
  });
}

function displayCards(cards) {
  const container = document.getElementById("results");
  if (allCardData.length === cards.length) {
    // First batch, clear container
    container.innerHTML = "";
  }
  
  cards.forEach(card => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "card-item";
    
    const img = document.createElement("img");
    img.src = card.image_uris?.normal || "";
    img.alt = card.name;
    
    const cardInfo = document.createElement("div");
    cardInfo.className = "card-info";
    cardInfo.innerHTML = `
      <h3>${card.name}</h3>
      <p><strong>Set:</strong> ${card.set_name}</p>
      <p><strong>Rarity:</strong> ${card.rarity}</p>
      <p><strong>Price:</strong> $${card.prices?.usd || "N/A"}</p>
      <input type="number" class="quantity-input" placeholder="Quantity" min="0" value="1" data-card-id="${card.id}">
    `;
    
    cardDiv.appendChild(img);
    cardDiv.appendChild(cardInfo);
    container.appendChild(cardDiv);
  });
}

function showExportButtons() {
  const container = document.getElementById("results");
  const exportDiv = document.createElement("div");
  exportDiv.className = "export-controls";
  exportDiv.innerHTML = `
    <h2>Export to Shopify</h2>
    <button onclick="exportToShopifyProducts()">Export Products CSV</button>
    <button onclick="exportToShopifyInventory()">Export Inventory CSV</button>
    <button onclick="exportToShopifyBoth()">Export Both</button>
  `;
  container.appendChild(exportDiv);
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
    const quantity = getCardQuantity(card.id);
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
    const quantity = getCardQuantity(card.id);
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
  return `
    <h2>${card.name}</h2>
    <p><strong>Set:</strong> ${card.set_name}</p>
    <p><strong>Rarity:</strong> ${card.rarity}</p>
    <p><strong>Type:</strong> ${card.type_line}</p>
    ${card.oracle_text ? `<p><strong>Card Text:</strong><br>${card.oracle_text.replace(/\n/g, '<br>')}</p>` : ""}
    ${card.power && card.toughness ? `<p><strong>Power/Toughness:</strong> ${card.power}/${card.toughness}</p>` : ""}
    <p><strong>Artist:</strong> ${card.artist || "Unknown"}</p>
  `.trim();
}

function getCardQuantity(cardId) {
  const quantityInput = document.querySelector(`input[data-card-id="${cardId}"]`);
  return quantityInput ? parseInt(quantityInput.value) || 0 : 1;
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
