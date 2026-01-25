const mongoose = require("mongoose");

const orderSchema = mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QRSession",
      default: null,
    },
    orderedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    allOrders: {
      type: Array,
      default: [],
    },
    selectFoods: {
      type: Array,
      default: [],
    },
    agent: {
      type: Object,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    tableName: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "paid", "cancelled"],
      default: "pending",
    },
    discount: {
      type: Boolean,
      default: false,
    },
    userInfo: {
      type: Object,
    },
    surcharge: {
      type: Number,
      default: 0,
    },
    ofitsianService: {
      type: Number,
      default: 0,
    },
    // Soatlik haq uchun - stol band bo'lgan vaqt
    occupancyStartedAt: {
      type: Date,
      default: null,
    },
    // Soatlik haq summasi (hisoblangan)
    hourlyChargeTotal: {
      type: Number,
      default: 0,
    },
    // Waiter tomonidan tasdiqlangan (mijoz orderini waiter tasdiqlashi kerak)
    waiterApproved: {
      type: Boolean,
      default: false,
    },
    // Waiter tasdiqlagan vaqt
    approvedAt: {
      type: Date,
      default: null,
    },
    // Waiter tomonidan rad etilgan
    waiterRejected: {
      type: Boolean,
      default: false,
    },
    // Rad etish sababi
    rejectionReason: {
      type: String,
      default: null,
    },
    // Waiter ma'lumotlari
    waiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    waiterName: {
      type: String,
      default: null,
    },
    // To'lov ma'lumotlari
    isPaid: {
      type: Boolean,
      default: false,
    },
    paymentType: {
      type: String,
      enum: ["cash", "card", "click", null],
      default: null,
    },
    // Bo'lingan to'lov (split payment)
    paymentSplit: {
      type: {
        cash: { type: Number, default: 0 },
        card: { type: Number, default: 0 },
        click: { type: Number, default: 0 },
      },
      default: null,
    },
    // To'lov izohi
    comment: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

orderSchema.index({ restaurantId: 1, tableId: 1, status: 1 });
orderSchema.index({ restaurantId: 1, createdAt: -1 });

const Order = mongoose.model("Orders", orderSchema);

module.exports = Order;
