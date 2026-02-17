---
name: testdriver:ocr
description: Extract all visible text from the screen using OCR
---
<!-- Generated from ocr.mdx. DO NOT EDIT. -->

## Overview

Extract all visible text from the current screen using Tesseract OCR. Returns structured data including each word's text content, bounding box coordinates, and confidence scores.

This method runs OCR on-demand and returns the results immediately. It's useful for:
- Verifying text content on screen
- Finding elements by their text when visual matching alone isn't enough
- Debugging what text TestDriver can "see"
- Building custom text-based assertions

<Note>
  **Performance**: OCR runs server-side using Tesseract.js with a worker pool for fast extraction. A typical screenshot processes in 200-500ms.
</Note>

## Syntax

```javascript
const result = await testdriver.ocr()
```

## Parameters

None.

## Returns

`Promise<OCRResult>` - Object containing extracted text data

### OCRResult

| Property | Type | Description |
|----------|------|-------------|
| `words` | `OCRWord[]` | Array of extracted words with positions |
| `fullText` | `string` | All text concatenated with spaces |
| `confidence` | `number` | Overall OCR confidence (0-100) |
| `imageWidth` | `number` | Width of the analyzed screenshot |
| `imageHeight` | `number` | Height of the analyzed screenshot |

### OCRWord

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | The word's text content |
| `confidence` | `number` | Confidence score for this word (0-100) |
| `bbox.x0` | `number` | Left edge X coordinate |
| `bbox.y0` | `number` | Top edge Y coordinate |
| `bbox.x1` | `number` | Right edge X coordinate |
| `bbox.y1` | `number` | Bottom edge Y coordinate |

## Examples

### Get All Text on Screen

```javascript
const result = await testdriver.ocr();
console.log(result.fullText);
// "Welcome to TestDriver Sign In Email Password Submit"

console.log(`Found ${result.words.length} words with ${result.confidence}% confidence`);
```

### Check if Text Exists

```javascript
const result = await testdriver.ocr();

// Check for error message
const hasError = result.words.some(w => 
  w.content.toLowerCase().includes('error')
);

if (hasError) {
  console.log('Error message detected on screen');
}
```

### Find and Click Text

```javascript
const result = await testdriver.ocr();

// Find the "Submit" button text
const submitWord = result.words.find(w => w.content === 'Submit');

if (submitWord) {
  // Calculate center of the word's bounding box
  const x = Math.round((submitWord.bbox.x0 + submitWord.bbox.x1) / 2);
  const y = Math.round((submitWord.bbox.y0 + submitWord.bbox.y1) / 2);
  
  // Click at those coordinates
  await testdriver.click({ x, y });
}
```

### Filter Words by Confidence

```javascript
const result = await testdriver.ocr();

// Only use high-confidence words (90%+)
const reliableWords = result.words.filter(w => w.confidence >= 90);

console.log('High confidence words:', reliableWords.map(w => w.content));
```

### Build Custom Assertions

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Login Page", () => {
  it("should show form labels", async (context) => {
    const testdriver = TestDriver(context);
    
    await testdriver.provision.chrome({
      url: 'https://myapp.com/login',
    });

    const result = await testdriver.ocr();
    
    // Assert expected labels are present
    expect(result.fullText).toContain('Email');
    expect(result.fullText).toContain('Password');
    expect(result.fullText).toContain('Sign In');
  });
});
```

### Debug Screen Content

```javascript
// Useful for debugging what TestDriver can see
const result = await testdriver.ocr();

console.log('=== Screen Text ===');
console.log(result.fullText);
console.log('');

console.log('=== Word Details ===');
result.words.forEach((word, i) => {
  console.log(`${i + 1}. "${word.content}" at (${word.bbox.x0}, ${word.bbox.y0}) - ${word.confidence}% confidence`);
});
```

### Find Multiple Instances

```javascript
const result = await testdriver.ocr();

// Find all instances of "Button" text
const buttons = result.words.filter(w => 
  w.content.toLowerCase() === 'button'
);

console.log(`Found ${buttons.length} buttons on screen`);

buttons.forEach((btn, i) => {
  console.log(`Button ${i + 1} at position (${btn.bbox.x0}, ${btn.bbox.y0})`);
});
```

## How It Works

1. TestDriver captures a screenshot of the current screen
2. The image is sent to the TestDriver API
3. Tesseract.js processes the image server-side with multiple workers
4. The API returns structured data with text and positions
5. Bounding box coordinates are scaled to match the original screen resolution

<Note>
  OCR works best with clear, readable text. Very small text, unusual fonts, or low-contrast text may have lower confidence scores or be missed entirely.
</Note>

## Best Practices

<AccordionGroup>
  <Accordion title="Use find() for element location">
    For locating elements, prefer `find()` which uses AI vision. Use `ocr()` when you need raw text data or want to build custom text-based logic.
    
    ```javascript
    // Prefer this for clicking elements
    await testdriver.find("Submit button").click();
    
    // Use ocr() for text verification or custom logic
    const result = await testdriver.ocr();
    expect(result.fullText).toContain('Success');
    ```
  </Accordion>
  
  <Accordion title="Filter by confidence">
    OCR can sometimes misread characters. Filter by confidence score when accuracy is critical.
    
    ```javascript
    const result = await testdriver.ocr();
    const reliable = result.words.filter(w => w.confidence >= 85);
    ```
  </Accordion>

  <Accordion title="Handle case sensitivity">
    Text matching should usually be case-insensitive since OCR capitalization can vary.
    
    ```javascript
    const result = await testdriver.ocr();
    const hasLogin = result.words.some(w => 
      w.content.toLowerCase() === 'login'
    );
    ```
  </Accordion>

  <Accordion title="Wait for content to load">
    If text isn't being found, the page may not be fully loaded. Add a wait or use `waitForText()`.
    
    ```javascript
    // Wait for specific text to appear
    await testdriver.waitForText("Welcome");
    
    // Then run OCR
    const result = await testdriver.ocr();
    ```
  </Accordion>
</AccordionGroup>

## Related

- [find()](/v7/find) - AI-powered element location
- [assert()](/v7/assert) - Make AI-powered assertions about screen state
- [waitForText()](/v7/waiting-for-elements) - Wait for text to appear on screen
- [screenshot()](/v7/screenshot) - Capture screenshots
