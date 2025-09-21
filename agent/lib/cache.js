const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Jimp = require("jimp");

/**
 * Simple caching system for SDK requests
 * 
 * Cache structure:
 * testdriver/.cache/
 *   ├── [hash]/
 *   │   ├── metadata.json (path, data without image, timestamp)
 *   │   ├── screenshot.png (original screenshot)
 *   │   └── response.json (cached response)
 */
class SDKCache {
  constructor(cacheDir = "testdriver/.cache") {
    this.cacheDir = path.resolve(cacheDir);
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate a hash for the request (excluding screenshot)
   * @param {string} requestPath - Request path
   * @param {object} data - Request data
   * @returns {string} Hash string
   */
  generateHash(requestPath, data) {
    // Create a copy of data without the screenshot
    const dataWithoutImage = { ...data };
    delete dataWithoutImage.image;
    delete dataWithoutImage.screenshot;

    const hashInput = JSON.stringify({
      path: requestPath,
      data: dataWithoutImage
    });

    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Get cache directory for a specific hash
   * @param {string} hash 
   * @returns {string} Cache directory path
   */
  getCacheDir(hash) {
    return path.join(this.cacheDir, hash);
  }

  /**
   * Save screenshot as PNG file
   * @param {string} base64Screenshot 
   * @param {string} filePath 
   */
  async saveScreenshot(base64Screenshot, filePath) {
    if (base64Screenshot) {
      const buffer = Buffer.from(base64Screenshot, 'base64');
      await fs.promises.writeFile(filePath, buffer);
    }
  }

  /**
   * Load screenshot as Jimp image
   * @param {string} filePath 
   * @returns {Promise<Jimp>} Jimp image object
   */
  async loadScreenshot(filePath) {
    if (fs.existsSync(filePath)) {
      return await Jimp.read(filePath);
    }
    return null;
  }

  /**
   * Compare two screenshots for similarity
   * @param {string} base64Screenshot1 
   * @param {string} screenshotPath2 
   * @returns {Promise<number>} Similarity score (0-1)
   */
  async compareScreenshots(base64Screenshot1, screenshotPath2) {
    try {
      // Dynamic import for pixelmatch (ES module)
      const { default: pixelmatch } = await import('pixelmatch');
      
      // Convert base64 to Jimp image
      const img1Buffer = Buffer.from(base64Screenshot1, 'base64');
      const img1 = await Jimp.read(img1Buffer);
      const img2 = await this.loadScreenshot(screenshotPath2);

      if (!img2) {
        return 0; // No cached screenshot to compare
      }

      // Ensure images are the same size for comparison
      const width = Math.min(img1.bitmap.width, img2.bitmap.width);
      const height = Math.min(img1.bitmap.height, img2.bitmap.height);

      img1.resize(width, height);
      img2.resize(width, height);

      // Create output image for differences
      const diff = new Jimp(width, height);

      // Compare pixels
      const diffPixels = pixelmatch(
        img1.bitmap.data,
        img2.bitmap.data,
        diff.bitmap.data,
        width,
        height,
        { threshold: 0.1 }
      );

      // Calculate similarity (1 - percentage of different pixels)
      const totalPixels = width * height;
      const similarity = 1 - (diffPixels / totalPixels);

      return similarity;
    } catch (error) {
      console.error('Error comparing screenshots:', error);
      return 0;
    }
  }

  /**
   * Store a response in cache
   * @param {string} requestPath - Request path
   * @param {object} data - Request data
   * @param {object} response - Response to cache
   */
  async set(requestPath, data, response) {
    try {
      const hash = this.generateHash(requestPath, data);
      const cacheDir = this.getCacheDir(hash);

      // Create cache directory
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Save metadata (path, data without image, timestamp)
      const metadata = {
        path: requestPath,
        data: { ...data },
        timestamp: Date.now(),
        hash
      };
      delete metadata.data.image;
      delete metadata.data.screenshot;

      await fs.promises.writeFile(
        path.join(cacheDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      // Save screenshot if present
      if (data.image) {
        await this.saveScreenshot(data.image, path.join(cacheDir, 'screenshot.png'));
      }

      // Save response
      await fs.promises.writeFile(
        path.join(cacheDir, 'response.json'),
        JSON.stringify(response, null, 2)
      );

      console.log(`Cache stored for ${requestPath} (${hash})`);
    } catch (error) {
      console.error('Error storing cache:', error);
    }
  }

  /**
   * Retrieve a response from cache with screenshot similarity check
   * @param {string} requestPath - Request path
   * @param {object} data - Request data
   * @param {number} similarityThreshold - Screenshot similarity threshold (0-1)
   * @returns {Promise<object|null>} Cached response or null if not found/not similar enough
   */
  async get(requestPath, data, similarityThreshold = 0.95) {
    try {
      const hash = this.generateHash(requestPath, data);
      const cacheDir = this.getCacheDir(hash);

      // Check if cache directory exists
      if (!fs.existsSync(cacheDir)) {
        return null;
      }

      // Load metadata
      const metadataPath = path.join(cacheDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        return null;
      }

      // Load metadata for potential future use
      await fs.promises.readFile(metadataPath, 'utf8');

      // Check if screenshot comparison is needed
      if (data.image) {
        const screenshotPath = path.join(cacheDir, 'screenshot.png');
        const similarity = await this.compareScreenshots(data.image, screenshotPath, similarityThreshold);
        
        console.log(`Screenshot similarity: ${(similarity * 100).toFixed(2)}% (threshold: ${(similarityThreshold * 100).toFixed(2)}%)`);
        
        if (similarity < similarityThreshold) {
          console.log(`Cache miss due to low screenshot similarity for ${requestPath} (${hash})`);
          return null;
        }
      }

      // Load and return cached response
      const responsePath = path.join(cacheDir, 'response.json');
      if (!fs.existsSync(responsePath)) {
        return null;
      }

      const response = JSON.parse(await fs.promises.readFile(responsePath, 'utf8'));
      console.log(`Cache hit for ${requestPath} (${hash})`);
      return response;
    } catch (error) {
      console.error('Error retrieving cache:', error);
      return null;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        await fs.promises.rm(this.cacheDir, { recursive: true });
        this.ensureCacheDir();
        console.log('Cache cleared');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  async getStats() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return { entries: 0, totalSize: 0 };
      }

      const entries = fs.readdirSync(this.cacheDir);
      let totalSize = 0;

      for (const entry of entries) {
        const entryPath = path.join(this.cacheDir, entry);
        const stat = fs.statSync(entryPath);
        if (stat.isDirectory()) {
          // Calculate directory size
          const files = fs.readdirSync(entryPath);
          for (const file of files) {
            const filePath = path.join(entryPath, file);
            const fileStat = fs.statSync(filePath);
            totalSize += fileStat.size;
          }
        }
      }

      return {
        entries: entries.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { entries: 0, totalSize: 0, error: error.message };
    }
  }
}

module.exports = { SDKCache };
