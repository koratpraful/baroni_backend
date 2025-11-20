import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const createHirenAdmin = async () => {
  try {
    // Get MongoDB URI from environment variables
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MongoDB connection string not found!');
      console.error('   Please set either MONGODB_URI or MONGO_URI in your .env file');
      console.error('   Example: MONGO_URI=mongodb://localhost:27017/baroni');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB...');
    console.log('   URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    // Connect to MongoDB with timeout and connection options
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout for server selection
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      maxPoolSize: 10,
      retryWrites: true,
      retryReads: true
    };
    
    // Connect to MongoDB with timeout and connection options
    console.log('   Attempting connection (timeout: 10s)...');
    await mongoose.connect(mongoUri, connectionOptions);
    
    // Verify connection
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Connected to MongoDB');
      console.log('   Database:', mongoose.connection.db.databaseName);
    } else {
      throw new Error('Connection established but state is not ready');
    }

    // Admin credentials
    const adminEmail = 'hiren@admin.com';
    const adminPassword = '12345678';
    const adminName = 'Hiren Admin';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: adminEmail.toLowerCase(), 
      role: 'admin' 
    });

    if (existingAdmin) {
      console.log('⚠️  Admin already exists with email:', adminEmail);
      console.log('   Admin ID:', existingAdmin._id);
      console.log('   Name:', existingAdmin.name);
      
      // Option to update password if needed
      console.log('\n📝 Updating password for existing admin...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      console.log('✅ Password updated successfully!');
      return;
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = await User.create({
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      name: adminName,
      role: 'admin',
      isDev: false
    });

    console.log('\n✅ Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('👤 Name:', admin.name);
    console.log('🔑 Role:', admin.role);
    console.log('🆔 ID:', admin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    
    // Handle specific MongoDB connection errors
    if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoServerSelectionError') {
      console.error('\n🔍 Connection Issues Detected:');
      console.error('   1. Check if MongoDB server is running');
      console.error('   2. Verify MONGO_URI in .env file is correct');
      console.error('   3. Check network connectivity');
      console.error('   4. For MongoDB Atlas: Check IP whitelist and credentials');
      console.error('\n   Connection String format:');
      console.error('   - Local: mongodb://localhost:27017/baroni');
      console.error('   - Atlas: mongodb+srv://username:password@cluster.mongodb.net/database');
    } else if (error.code === 11000) {
      console.error('   Duplicate key error - Admin with this email may already exist');
    } else if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      console.error('\n🔍 Network/Timeout Issues:');
      console.error('   1. Check internet connection');
      console.error('   2. Verify MongoDB server is accessible');
      console.error('   3. Check firewall settings');
      console.error('   4. Try increasing timeout in connection options');
    }
    
    process.exit(1);
  } finally {
    // Close database connection if it was opened
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
};

// Run the script
createHirenAdmin();

