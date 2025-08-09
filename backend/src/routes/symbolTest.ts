/**
 * Symbol Test Routes - Debug symbol data issues
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import mongoose from 'mongoose';

const router = Router();

// Test endpoint to check raw symbol data
router.get('/raw-count', authenticateToken, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    const collection = db.collection('standardizedsymbols');
    
    const count = await collection.countDocuments();
    const sample = await collection.findOne();
    
    res.json({
      success: true,
      data: {
        totalCount: count,
        sampleDocument: sample
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to check symbol search without conversion
router.get('/raw-search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    const collection = db.collection('standardizedsymbols');
    
    const results = await collection.find({
      $or: [
        { displayName: { $regex: query, $options: 'i' } },
        { tradingSymbol: { $regex: query, $options: 'i' } },
        { companyName: { $regex: query, $options: 'i' } }
      ]
    }).limit(5).toArray();
    
    res.json({
      success: true,
      data: {
        query,
        resultCount: results.length,
        results: results
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;