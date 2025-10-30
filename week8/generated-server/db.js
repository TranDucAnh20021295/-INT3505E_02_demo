const mongoose = require('mongoose');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/library_v8';
  await mongoose.connect(mongoUri, { dbName: 'library_v8' });
  isConnected = true;
  console.log('MongoDB connected');
  return mongoose.connection;
}

module.exports = {
  connectMongo,
};
