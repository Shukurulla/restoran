const mongoose = require("mongoose");

const attendanceSchema = mongoose.Schema(
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
    // "keldi" yoki "ketdi"
    type: {
      type: String,
      enum: ["keldi", "ketdi"],
      required: true,
    },
    // Qo'shimcha izoh (ixtiyoriy)
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexlar - tezkor qidirish uchun
attendanceSchema.index({ waiterId: 1, createdAt: -1 });
attendanceSchema.index({ restaurantId: 1, createdAt: -1 });
attendanceSchema.index({ waiterId: 1, type: 1, createdAt: -1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;
