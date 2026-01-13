const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

// Parolni hash qilish
staffSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Parolni tekshirish
staffSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index - ishlayotgan xodimlarni tezroq topish uchun
staffSchema.index({ restaurantId: 1, role: 1, status: 1 });
staffSchema.index({ phone: 1 });

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;
