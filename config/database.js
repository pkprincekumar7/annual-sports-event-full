import mongoose from 'mongoose'
import logger from '../utils/logger.js'

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/annual-sports'
    
    const conn = await mongoose.connect(mongoURI, {
      // Remove deprecated options, use default settings
    })
    
    logger.server(`MongoDB Connected: ${conn.connection.host}`)
    return conn
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error.message)
    process.exit(1)
  }
}

export default connectDB

