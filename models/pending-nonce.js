const mongoose = require("mongoose");
const crypto = require("crypto");

const pendingNonceSchema = mongoose.Schema({
  nonce: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    required: true,
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL index - 5 daqiqadan keyin avtomatik o'chirish
pendingNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Nonce yaratish
pendingNonceSchema.statics.generateNonce = function () {
  return crypto.randomBytes(16).toString("hex");
};

const PendingNonce = mongoose.model("PendingNonce", pendingNonceSchema);

module.exports = PendingNonce;
