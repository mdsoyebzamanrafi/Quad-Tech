const Notification = require('../models/Notification');

class NotificationService {
  static async sendNotification(userId, type, message, data = {}) {
    try {
      const notification = await Notification.create({
        userId, type, message, data
      });
      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  static async notifyRestock(productId, productName) {
    const Wishlist = require('../models/Wishlist');
    const wishlists = await Wishlist.find({ productId, watchingForRestock: true });
    
    for (const item of wishlists) {
      await this.sendNotification(
        item.userId,
        'restock',
        `${productName} is back in stock!`,
        { productId }
      );
    }
  }
}

module.exports = NotificationService;
