const AWS = require('aws-sdk');
const cloudinary = require('cloudinary').v2;
const logger = require("../../utils/logger");

/**
 * 🚀 CDN MANAGER SYSTEM
 * 
 * This system provides CDN integration for ultra-fast delivery
 * of static assets, media files, and dynamic content.
 */

class CDNManager {
  constructor() {
    this.providers = new Map();
    this.cache = new Map();
    this.isInitialized = false;
    
    // Performance metrics
    this.metrics = {
      uploads: 0,
      downloads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalBytesTransferred: 0,
      avgUploadTime: 0,
      avgDownloadTime: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize CDN providers
   */
  async initialize() {
    try {
      // Initialize AWS S3 + CloudFront
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        await this.initializeAWS();
      }

      // Initialize Cloudinary
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        await this.initializeCloudinary();
      }

      // Initialize local CDN fallback
      await this.initializeLocalCDN();

      this.isInitialized = true;
      logger.info('🚀 CDN Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize CDN Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize AWS S3 + CloudFront
   */
  async initializeAWS() {
    try {
      const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
        maxRetries: 3,
        retryDelayOptions: {
          customBackoff: function(retryCount) {
            return Math.pow(2, retryCount) * 100;
          }
        }
      });

      const cloudFront = new AWS.CloudFront({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });

      this.providers.set('aws', {
        s3: s3,
        cloudFront: cloudFront,
        bucket: process.env.AWS_S3_BUCKET,
        distributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
        baseUrl: process.env.AWS_CLOUDFRONT_URL
      });

      logger.info('✅ AWS S3 + CloudFront initialized');
    } catch (error) {
      logger.error('Failed to initialize AWS:', error);
    }
  }

  /**
   * Initialize Cloudinary
   */
  async initializeCloudinary() {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });

      this.providers.set('cloudinary', {
        client: cloudinary,
        baseUrl: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`
      });

      logger.info('✅ Cloudinary initialized');
    } catch (error) {
      logger.error('Failed to initialize Cloudinary:', error);
    }
  }

  /**
   * Initialize local CDN fallback
   */
  async initializeLocalCDN() {
    const fs = require('fs');
    const path = require('path');

    const localCDNPath = path.join(__dirname, '../../public/cdn');
    
    // Create local CDN directory if it doesn't exist
    if (!fs.existsSync(localCDNPath)) {
      fs.mkdirSync(localCDNPath, { recursive: true });
    }

    this.providers.set('local', {
      path: localCDNPath,
      baseUrl: process.env.LOCAL_CDN_URL || 'http://localhost:3000/cdn'
    });

    logger.info('✅ Local CDN initialized');
  }

  /**
   * Upload file to CDN
   */
  async uploadFile(file, options = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      const {
        provider = 'aws',
        folder = 'uploads',
        filename = null,
        optimize = true,
        generateThumbnails = false,
        metadata = {}
      } = options;

      const cdnProvider = this.providers.get(provider);
      if (!cdnProvider) {
        throw new Error(`CDN provider ${provider} not available`);
      }

      let result;
      
      switch (provider) {
        case 'aws':
          result = await this.uploadToAWS(file, folder, filename, metadata, cdnProvider);
          break;
        case 'cloudinary':
          result = await this.uploadToCloudinary(file, folder, filename, optimize, generateThumbnails, cdnProvider);
          break;
        case 'local':
          result = await this.uploadToLocal(file, folder, filename, cdnProvider);
          break;
        default:
          throw new Error(`Unsupported CDN provider: ${provider}`);
      }

      // Update metrics
      const uploadTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateUploadMetrics(uploadTime, file.size || 0);

      // Cache the result
      this.cache.set(result.url, {
        ...result,
        uploadedAt: Date.now(),
        provider: provider
      });

      logger.info(`📤 File uploaded to ${provider}: ${result.url}`);
      return result;
    } catch (error) {
      logger.error('Error uploading file to CDN:', error);
      throw error;
    }
  }

  /**
   * Upload to AWS S3
   */
  async uploadToAWS(file, folder, filename, metadata, provider) {
    const key = `${folder}/${filename || file.originalname}`;
    
    const uploadParams = {
      Bucket: provider.bucket,
      Key: key,
      Body: file.buffer || file,
      ContentType: file.mimetype,
      Metadata: metadata,
      ACL: 'public-read',
      CacheControl: 'max-age=31536000' // 1 year
    };

    const result = await provider.s3.upload(uploadParams).promise();
    
    return {
      url: result.Location,
      cdnUrl: `${provider.baseUrl}/${key}`,
      key: key,
      size: file.size,
      contentType: file.mimetype,
      etag: result.ETag
    };
  }

  /**
   * Upload to Cloudinary
   */
  async uploadToCloudinary(file, folder, filename, optimize, generateThumbnails, provider) {
    const uploadOptions = {
      folder: folder,
      public_id: filename ? filename.replace(/\.[^/.]+$/, "") : undefined,
      resource_type: 'auto',
      quality: optimize ? 'auto' : 100,
      fetch_format: optimize ? 'auto' : undefined
    };

    if (generateThumbnails) {
      uploadOptions.transformation = [
        { width: 300, height: 300, crop: 'fill', quality: 'auto' },
        { width: 150, height: 150, crop: 'fill', quality: 'auto' }
      ];
    }

    const result = await provider.client.uploader.upload(
      file.buffer ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : file.path,
      uploadOptions
    );

    return {
      url: result.secure_url,
      cdnUrl: result.secure_url,
      publicId: result.public_id,
      size: result.bytes,
      contentType: result.resource_type,
      format: result.format,
      width: result.width,
      height: result.height
    };
  }

  /**
   * Upload to local CDN
   */
  async uploadToLocal(file, folder, filename, provider) {
    const fs = require('fs');
    const path = require('path');

    const fileName = filename || file.originalname;
    const filePath = path.join(provider.path, folder, fileName);
    const fileDir = path.dirname(filePath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, file.buffer || file);

    return {
      url: `${provider.baseUrl}/${folder}/${fileName}`,
      cdnUrl: `${provider.baseUrl}/${folder}/${fileName}`,
      path: filePath,
      size: file.size,
      contentType: file.mimetype
    };
  }

  /**
   * Download file from CDN
   */
  async downloadFile(url, options = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Check cache first
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.downloadedAt < 300000) { // 5 minutes
        this.metrics.cacheHits++;
        return cached.data;
      }

      const axios = require('axios');
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        ...options
      });

      const data = {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'],
        size: response.data.byteLength,
        lastModified: response.headers['last-modified']
      };

      // Update metrics
      const downloadTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateDownloadMetrics(downloadTime, data.size);

      // Cache the result
      this.cache.set(url, {
        data: data,
        downloadedAt: Date.now()
      });

      this.metrics.cacheMisses++;
      return data;
    } catch (error) {
      logger.error('Error downloading file from CDN:', error);
      throw error;
    }
  }

  /**
   * Generate optimized image URL
   */
  generateOptimizedImageUrl(originalUrl, options = {}) {
    const {
      width = null,
      height = null,
      quality = 'auto',
      format = 'auto',
      crop = 'fill',
      gravity = 'auto'
    } = options;

    // Check if it's a Cloudinary URL
    if (originalUrl.includes('cloudinary.com')) {
      const transformations = [];
      
      if (width || height) {
        transformations.push(`w_${width || 'auto'},h_${height || 'auto'},c_${crop}`);
      }
      
      if (quality !== 'auto') {
        transformations.push(`q_${quality}`);
      }
      
      if (format !== 'auto') {
        transformations.push(`f_${format}`);
      }
      
      if (gravity !== 'auto') {
        transformations.push(`g_${gravity}`);
      }

      if (transformations.length > 0) {
        const baseUrl = originalUrl.split('/upload/')[0];
        const path = originalUrl.split('/upload/')[1];
        return `${baseUrl}/upload/${transformations.join(',')}/${path}`;
      }
    }

    // For other CDNs, return original URL
    return originalUrl;
  }

  /**
   * Generate thumbnail URLs
   */
  generateThumbnailUrls(originalUrl, sizes = [150, 300, 600]) {
    return sizes.map(size => 
      this.generateOptimizedImageUrl(originalUrl, {
        width: size,
        height: size,
        crop: 'fill',
        quality: 'auto'
      })
    );
  }

  /**
   * Delete file from CDN
   */
  async deleteFile(url, provider = 'aws') {
    try {
      const cdnProvider = this.providers.get(provider);
      if (!cdnProvider) {
        throw new Error(`CDN provider ${provider} not available`);
      }

      let result;
      
      switch (provider) {
        case 'aws':
          result = await this.deleteFromAWS(url, cdnProvider);
          break;
        case 'cloudinary':
          result = await this.deleteFromCloudinary(url, cdnProvider);
          break;
        case 'local':
          result = await this.deleteFromLocal(url, cdnProvider);
          break;
        default:
          throw new Error(`Unsupported CDN provider: ${provider}`);
      }

      // Remove from cache
      this.cache.delete(url);

      logger.info(`🗑️ File deleted from ${provider}: ${url}`);
      return result;
    } catch (error) {
      logger.error('Error deleting file from CDN:', error);
      throw error;
    }
  }

  /**
   * Delete from AWS S3
   */
  async deleteFromAWS(url, provider) {
    const key = url.split('/').slice(-2).join('/'); // Extract key from URL
    
    await provider.s3.deleteObject({
      Bucket: provider.bucket,
      Key: key
    }).promise();

    return { success: true, key: key };
  }

  /**
   * Delete from Cloudinary
   */
  async deleteFromCloudinary(url, provider) {
    const publicId = url.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, "");
    
    await provider.client.uploader.destroy(publicId);
    
    return { success: true, publicId: publicId };
  }

  /**
   * Delete from local CDN
   */
  async deleteFromLocal(url, provider) {
    const fs = require('fs');
    const path = require('path');
    
    const relativePath = url.replace(provider.baseUrl + '/', '');
    const filePath = path.join(provider.path, relativePath);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return { success: true, path: filePath };
  }

  /**
   * Get CDN statistics
   */
  getStats() {
    const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2)
      : 0;

    return {
      isInitialized: this.isInitialized,
      providers: Array.from(this.providers.keys()),
      metrics: {
        ...this.metrics,
        cacheHitRate: `${cacheHitRate}%`,
        avgUploadTime: `${this.metrics.avgUploadTime.toFixed(2)}ms`,
        avgDownloadTime: `${this.metrics.avgDownloadTime.toFixed(2)}ms`,
        totalMBTransferred: (this.metrics.totalBytesTransferred / 1024 / 1024).toFixed(2)
      },
      cache: {
        size: this.cache.size,
        entries: Array.from(this.cache.keys())
      }
    };
  }

  /**
   * Update upload metrics
   */
  updateUploadMetrics(uploadTime, fileSize) {
    this.metrics.uploads++;
    this.metrics.totalBytesTransferred += fileSize;
    this.metrics.avgUploadTime = 
      (this.metrics.avgUploadTime * (this.metrics.uploads - 1) + uploadTime) / 
      this.metrics.uploads;
  }

  /**
   * Update download metrics
   */
  updateDownloadMetrics(downloadTime, fileSize) {
    this.metrics.downloads++;
    this.metrics.totalBytesTransferred += fileSize;
    this.metrics.avgDownloadTime = 
      (this.metrics.avgDownloadTime * (this.metrics.downloads - 1) + downloadTime) / 
      this.metrics.downloads;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('🧹 CDN cache cleared');
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      isInitialized: this.isInitialized,
      providers: {}
    };

    for (const [name, provider] of this.providers) {
      try {
        switch (name) {
          case 'aws':
            await provider.s3.headBucket({ Bucket: provider.bucket }).promise();
            health.providers[name] = { status: 'healthy' };
            break;
          case 'cloudinary':
            await provider.client.api.ping();
            health.providers[name] = { status: 'healthy' };
            break;
          case 'local':
            const fs = require('fs');
            if (fs.existsSync(provider.path)) {
              health.providers[name] = { status: 'healthy' };
            } else {
              health.providers[name] = { status: 'unhealthy', error: 'Directory not found' };
            }
            break;
        }
      } catch (error) {
        health.providers[name] = { status: 'unhealthy', error: error.message };
      }
    }

    return health;
  }
}

// Export singleton instance
const cdnManager = new CDNManager();
module.exports = cdnManager;


