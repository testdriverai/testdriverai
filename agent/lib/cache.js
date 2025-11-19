const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Generate a cache key from a prompt
 * Uses a hash to create a safe filename
 */
function getCacheKey(prompt) {
  // Normalize the prompt by trimming and converting to lowercase
  const normalized = prompt.trim().toLowerCase();
  
  // Create a hash for the filename
  const hash = crypto.createHash("md5").update(normalized).digest("hex");
  
  // Also create a sanitized version of the prompt for readability
  const sanitized = normalized
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .substring(0, 50); // Limit length
  
  // Combine sanitized prompt with hash for uniqueness
  return `${sanitized}-${hash}.yaml`;
}

/**
 * Get the cache directory path
 * Creates it if it doesn't exist
 */
function getCacheDir() {
  const cacheDir = path.join(process.cwd(), ".testdriver", ".cache");
  
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  return cacheDir;
}

/**
 * Get the full path to a cache file
 */
function getCachePath(prompt) {
  const cacheDir = getCacheDir();
  const key = getCacheKey(prompt);
  return path.join(cacheDir, key);
}

/**
 * Check if a cached response exists for a prompt
 */
function hasCache(prompt) {
  const cachePath = getCachePath(prompt);
  return fs.existsSync(cachePath);
}

/**
 * Read cached YAML for a prompt
 * Returns null if no cache exists
 */
function readCache(prompt) {
  if (!hasCache(prompt)) {
    return null;
  }
  
  try {
    const cachePath = getCachePath(prompt);
    const yaml = fs.readFileSync(cachePath, "utf8");
    return yaml;
  } catch {
    // If there's an error reading the cache, return null
    return null;
  }
}

/**
 * Write YAML to cache for a prompt
 */
function writeCache(prompt, yaml) {
  try {
    const cachePath = getCachePath(prompt);
    fs.writeFileSync(cachePath, yaml, "utf8");
    return cachePath;
  } catch {
    // Silently fail if we can't write to cache
    return null;
  }
}

/**
 * Clear all cached prompts
 */
function clearCache() {
  const cacheDir = getCacheDir();
  
  try {
    const files = fs.readdirSync(cacheDir);
    
    for (const file of files) {
      if (file.endsWith(".yaml")) {
        fs.unlinkSync(path.join(cacheDir, file));
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const cacheDir = getCacheDir();
  
  try {
    const files = fs.readdirSync(cacheDir);
    const yamlFiles = files.filter((f) => f.endsWith(".yaml"));
    
    return {
      count: yamlFiles.length,
      files: yamlFiles,
    };
  } catch {
    return {
      count: 0,
      files: [],
    };
  }
}

module.exports = {
  getCacheKey,
  getCacheDir,
  getCachePath,
  hasCache,
  readCache,
  writeCache,
  clearCache,
  getCacheStats,
};
