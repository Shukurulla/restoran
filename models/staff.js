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
    // Firebase Cloud Messaging token
    fcmToken: {
      type: String,
      default: null,
    },
    // Ishda yoki ishda emas (keldi/ketdi toggle)
    isWorking: {
      type: Boolean,
      default: false,
    },
    assignedTables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
      },
    ],
    // Cook uchun - biriktirilgan categorylar (bar, oshxona, shashlik va h.k.)
    assignedCategories: [
      {
        type: String,
      },
    ],
    // Cook uchun - ikkilik tasdiqlash (birinchi bosishda qizil, ikkinchi bosishda tayyor)
    doubleConfirmation: {
      type: Boolean,
      default: false,
    },
    // Cook uchun - avtomatik tayyor (biriktirilgan categorylar uchun avtomatik tayyor qilish)
    autoReady: {
      type: Boolean,
      default: false,
    },
    // Waiter uchun - ish haqi foizi (default 5%)
    salaryPercent: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

// Telefon raqamni normalize qilish - probellarni olib tashlash
function normalizePhone(phone) {
  if (!phone) return phone;
  // Barcha probellarni olib tashlash va faqat raqamlar + '+' qoldirish
  let normalized = phone.replace(/\s+/g, '');
  // Agar '+' bilan boshlanmasa, qo'shish
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}

// Pre-save middleware - telefon raqamni avtomatik normalize qilish
staffSchema.pre('save', function(next) {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }
  next();
});

// Parolni tekshirish (plain text compare)
staffSchema.methods.comparePassword = async function (candidatePassword) {
  return this.password === candidatePassword;
};

// Index - ishlayotgan xodimlarni tezroq topish uchun
staffSchema.index({ restaurantId: 1, role: 1, status: 1 });
staffSchema.index({ phone: 1 });

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;
