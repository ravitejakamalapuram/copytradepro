import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get VAPID public key for push notifications
 */
router.get('/vapid-public-key', (req: any, res: any) => {
  try {
    const publicKey = notificationService.getVapidPublicKey();

    if (!publicKey) {
      return res.status(503).json({
        success: false,
        error: 'Push notifications not configured'
      });
    }

    return res.json({
      success: true,
      data: {
        publicKey
      }
    });
  } catch (error) {
    logger.error('Failed to get VAPID public key:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Subscribe to push notifications
 */
router.post('/subscribe', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const { subscription } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription data'
      });
    }

    const success = await notificationService.subscribeToPush(userId.toString(), subscription);

    if (success) {
      return res.json({
        success: true,
        message: 'Successfully subscribed to push notifications'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to subscribe to push notifications'
      });
    }
  } catch (error) {
    logger.error('Failed to subscribe to push notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Unsubscribe from push notifications
 */
router.post('/unsubscribe', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const { endpoint } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const success = await notificationService.unsubscribeFromPush(userId.toString(), endpoint);

    if (success) {
      return res.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
  } catch (error) {
    logger.error('Failed to unsubscribe from push notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get user notification preferences
 */
router.get('/preferences', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // This will create default preferences if none exist
    const preferences = await notificationService.getUserNotificationPreferences(userId.toString());

    return res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    logger.error('Failed to get notification preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update user notification preferences
 */
router.put('/preferences', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const preferences = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences data'
      });
    }

    const success = await notificationService.updateNotificationPreferences(userId.toString(), preferences);

    if (success) {
      return res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to update notification preferences'
      });
    }
  } catch (error) {
    logger.error('Failed to update notification preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Send test notification
 */
router.post('/test', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const success = await notificationService.sendTestNotification(userId.toString());

    if (success) {
      return res.json({
        success: true,
        message: 'Test notification sent successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to send test notification'
      });
    }
  } catch (error) {
    logger.error('Failed to send test notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Generate VAPID keys (development only)
 */
router.post('/generate-vapid-keys', (req: any, res: any) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'VAPID key generation not allowed in production'
      });
    }

    const keys = notificationService.generateVapidKeys();

    if (keys) {
      return res.json({
        success: true,
        message: 'VAPID keys generated successfully',
        data: keys,
        instructions: [
          'Add these keys to your environment variables:',
          `VAPID_PUBLIC_KEY=${keys.publicKey}`,
          `VAPID_PRIVATE_KEY=${keys.privateKey}`,
          'VAPID_EMAIL=mailto:your-email@domain.com'
        ]
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate VAPID keys'
      });
    }
  } catch (error) {
    logger.error('Failed to generate VAPID keys:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
