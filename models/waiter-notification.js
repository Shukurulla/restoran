const mongoose = require("mongoose");

const waiterNotificationSchema = mongoose.Schema(
  {
    waiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    type: {
      type: String,
      enum: ["food_ready", "waiter_call", "new_order"],
      required: true,
    },
    tableName: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      required: true,
    },
    // Tayyor bo'lgan taomlar ro'yxati (food_ready uchun)
    items: [
      {
        foodName: String,
        quantity: Number,
      },
    ],
    // O'qilganmi
    isRead: {
      type: Boolean,
      default: false,
    },
    // Bajarilganmi (waiter stolga bordi)
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indekslar - tez qidirish uchun
waiterNotificationSchema.index({ waiterId: 1, isCompleted: 1, createdAt: -1 });
waiterNotificationSchema.index({ restaurantId: 1, createdAt: -1 });
waiterNotificationSchema.index({ orderId: 1 });

const WaiterNotification = mongoose.model(
  "WaiterNotification",
  waiterNotificationSchema
);

module.exports = WaiterNotification;
