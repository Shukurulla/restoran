const mongoose = require("mongoose");
const crypto = require("crypto");

const qrSessionSchema = mongoose.Schema(
  {
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    clientHash: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// TTL index - 24 soatdan keyin avtomatik o'chirish
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

// Sessiya hali amal qilayotganligini tekshirish
qrSessionSchema.virtual("isValid").get(function () {
  return this.status === "active" && new Date() < this.expiresAt;
});

// Sessiya tokenini yaratish
qrSessionSchema.statics.generateToken = function () {
  return crypto.randomBytes(32).toString("base64url");
};

const QRSession = mongoose.model("QRSession", qrSessionSchema);

module.exports = QRSession;
