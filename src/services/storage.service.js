const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

class StorageService {
  generateUploadSignature(userId) {
    const timestamp = Math.round(new Date().getTime() / 1000)
    const publicId = `user-avatar-${userId}`
    const paramsToSign = {
      timestamp,
      upload_preset: 'secure_avatars',
      public_id: publicId,
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    )

    return {
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      publicId,
    }
  }
}

// Export a single instance (Singleton)
module.exports = new StorageService()
