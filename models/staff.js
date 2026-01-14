const mongoose = require("mongoose");

const staffSchema = mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true, // Global unique - bir telefon faqat bitta restoranda
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["waiter", "cook", "cashier"],
      required: true,
    },
    status: {
      type: String,
      enum: ["working", "fired"],
      default: "working",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    socketId: {
      type: String,
      default: null,
    },
    assignedTables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
      },
    ],
  },
  { timestamps: true }
);

// Parolni tekshirish (plain text compare)
staffSchema.methods.comparePassword = async function (candidatePassword) {
  return this.password === candidatePassword;
};

// Index - ishlayotgan xodimlarni tezroq topish uchun
staffSchema.index({ restaurantId: 1, role: 1, status: 1 });
staffSchema.index({ phone: 1 });

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;
