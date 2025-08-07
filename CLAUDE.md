# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a pure HTML/CSS/JavaScript application without build tools or package management. Open `index.html` directly in a browser or use a local development server:

```bash
# Using Python (most systems)
python -m http.server 8000

# Using Node.js (if http-server is installed)
npx http-server

# Then open http://localhost:8000
```

## Architecture Overview

### Core Application Structure
This is a **client-side web application** that converts Manabox CSV exports into Shopify-compatible product catalogs using the Scryfall API. The application consists of three main files:

- **index.html**: Single-page application with TailwindCSS for styling
- **script.js**: Complete application logic (~880+ lines) 
- **style.css**: Minimal custom styling supplementing TailwindCSS

### Data Flow Architecture

1. **CSV Upload & Parsing**: 
   - Parses Manabox CSV format (15 columns: Name, Set code, Set name, Collector number, Foil, Rarity, Quantity, ManaBox ID, Scryfall ID, Purchase price, Misprint, Altered, Condition, Language, Purchase price currency)
   - Uses custom CSV parser (`parseCSVLine()`) to handle quoted fields properly

2. **API Integration**:
   - Batches Scryfall API requests (70 cards per batch, 200ms delays)
   - Uses Scryfall's `/cards/collection` endpoint with POST requests
   - Implements rate limiting and retry logic for 429 responses
   - Merges Scryfall data (primary) with Manabox data (secondary)

3. **Data Processing**:
   - **Scryfall data is primary**: Card information, pricing, images from Scryfall
   - **Manabox data merged in**: Quantity, condition, language, foil status (fallback)
   - Global `allCardData[]` stores merged results

4. **Export Generation**:
   - Generates single unified Shopify Products CSV with 60+ columns
   - Includes product variants, inventory tracking, metafields, SEO data
   - Handles CSV escaping for special characters and newlines

### Key Functions

#### Data Processing
- `parseManaboxCSV()`: Converts CSV lines to structured data
- `fetchCardData()`: Batched Scryfall API requests with rate limiting
- `processBatchData()`: Merges Scryfall + Manabox data

#### CSV Generation
- `generateShopifyProductsCSV()`: Main export function (deprecated inventory CSV functions)
- `escapeCSVField()`: Handles quotes and newline replacement with `<br>` tags
- `generateHandle()`, `generateSKU()`: Product identifiers
- `generateProductDescription()`: HTML descriptions with oracle text

#### Utility Functions
- `getCardFoil()`: Determines foil status from Scryfall finishes/prices or Manabox data
- `getCardCondition()`, `getCardQuantity()`: Extracts merged data values
- `generateTags()`: Creates comprehensive tag list from card properties

### Rate Limiting & API Constraints
- Scryfall API: 70 cards per batch, 200ms between batches (5 requests/sec)
- Retry logic for 429 responses with 2-second delays
- Progress tracking with visual indicators

### CSV Format Details
The application generates a complete Shopify Products CSV with:
- **Product Structure**: Handle, Title, HTML Body, Vendor ("Harmless Offering")
- **Variants**: SKU (SET-NUMBER format), inventory quantities, pricing
- **Options**: Finish Type (Foil/Non-Foil), Condition, Set
- **Metadata**: Card attributes, colors, rarity in metafields
- **SEO**: Optimized titles, descriptions, product categorization

### Error Handling & Logging
- Comprehensive logging system with timestamps and log levels (info, success, error, warning)
- Local storage persistence for daily logs
- Export/copy/clear log functionality
- Visual progress indicators during processing

### Browser Compatibility
Requires modern browsers supporting:
- File API for CSV upload
- Fetch API for Scryfall requests  
- Blob downloads for CSV export
- Local Storage for log persistence

## Important Implementation Notes

- **No build process**: Direct HTML/CSS/JS files
- **No package.json**: Pure browser-based application  
- **API rate limits**: Respect Scryfall's 10 requests/second limit
- **CSV escaping**: Critical for preventing column shifts in Shopify imports
- **Data merging**: Scryfall data takes precedence over Manabox data
- **Single CSV export**: Unified products file (inventory-only export deprecated)

## Testing the Application

1. Export a collection from Manabox as CSV
2. Upload the CSV file through the web interface
3. Verify card data fetching and progress indicators
4. Check exported CSV format and content
5. Test import in Shopify (Products → Import)