# Scryfall to Shopify Exporter

A web-based tool that fetches Magic: The Gathering card data from Scryfall API and exports it in Shopify-compatible CSV formats for easy import into your Shopify store.

## Features

- **CSV Upload**: Upload a CSV file with card names to fetch detailed card information
- **Card Data Display**: View card images, set information, rarity, and current market prices
- **Quantity Management**: Set inventory quantities for each card
- **Shopify Export**: Generate Shopify-compatible CSV files for:
  - **Products CSV**: Complete product catalog with images, descriptions, and variants
  - **Inventory CSV**: Inventory quantities for existing products
  - **Both**: Export both files simultaneously

## How to Use

1. **Prepare your CSV file** with card names in the first column:
   ```
   Lightning Bolt
   Black Lotus
   Counterspell
   ```

2. **Upload the CSV** using the file input on the page

3. **Review the fetched data** - cards will be displayed with images and information

4. **Adjust quantities** using the number inputs for each card

5. **Export to Shopify** using one of the export buttons:
   - **Export Products CSV**: Creates a complete product catalog
   - **Export Inventory CSV**: Creates inventory update file
   - **Export Both**: Downloads both files

## Shopify Import Instructions

### Products CSV Import
1. Go to your Shopify admin → Products → Import
2. Upload the `shopify_products.csv` file
3. Map the columns as needed (most should auto-map)
4. Review and import

### Inventory CSV Import
1. Go to your Shopify admin → Products → Import
2. Select "Inventory" as the import type
3. Upload the `shopify_inventory.csv` file
4. Review and import

## CSV Format Details

### Products CSV Includes:
- Product handles and titles
- Detailed HTML descriptions with card text
- Set information and rarity as product options
- Current market prices from Scryfall
- Card image URLs (links to Scryfall images)
- Proper Shopify categorization
- SEO metadata

### Inventory CSV Includes:
- Product handles
- SKU codes (Set-CardNumber format)
- Inventory quantities

## Technical Details

- Uses Scryfall API for card data
- Batches API requests (75 cards per batch) to respect rate limits
- Generates SEO-friendly product handles
- Creates unique SKUs based on set and collector number
- Includes comprehensive product descriptions with card text
- Supports all Magic: The Gathering card types and rarities

## Browser Compatibility

Works in all modern browsers that support:
- File API
- Fetch API
- Blob downloads

## File Structure

```
scryfall-parser/
├── index.html          # Main application page
├── script.js           # Core functionality and Shopify export
├── style.css           # Styling and layout
└── README.md           # This documentation
```

## API Rate Limits

The tool respects Scryfall's API rate limits by:
- Batching requests (75 cards per batch)
- Adding delays between batches
- Handling API errors gracefully

## Customization

You can modify the export format by editing the `generateShopifyProductsCSV()` and `generateShopifyInventoryCSV()` functions in `script.js` to match your specific Shopify store requirements.