/**
 * Migration script - Telefon raqamlarni normalize qilish
 * Bu script barcha Staff va RestaurantAdmin telefon raqamlaridan
 * probellarni olib tashlaydi va +998XXXXXXXXX formatiga keltiradi
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

// Models
const Staff = require("../models/staff");
const RestaurantAdmin = require("../models/restaurant-admin");

// Telefon raqamni normalize qilish
function normalizePhone(phone) {
  if (!phone) return phone;
  // Barcha probellarni olib tashlash
  let normalized = phone.replace(/\s+/g, "");
  // Agar '+' bilan boshlanmasa, qo'shish
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

async function fixPhoneNumbers() {
  try {
    // MongoDB ga ulanish
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGO_URI topilmadi .env faylda");
      process.exit(1);
    }

    console.log("MongoDB ga ulanmoqda...");
    await mongoose.connect(mongoUri);
    console.log("MongoDB ga ulandi!\n");

    // ============ STAFF telefon raqamlarini to'g'irlash ============
    console.log("=== STAFF telefon raqamlarini to'g'irlash ===");

    const allStaff = await Staff.find({});
    console.log(`Jami ${allStaff.length} ta staff topildi`);

    let staffFixed = 0;
    let staffErrors = [];

    for (const staff of allStaff) {
      const originalPhone = staff.phone;
      const normalizedPhone = normalizePhone(originalPhone);

      if (originalPhone !== normalizedPhone) {
        console.log(
          `  [${staff.firstName} ${staff.lastName}] "${originalPhone}" -> "${normalizedPhone}"`
        );

        try {
          // Direct update to bypass pre-save hook and avoid password re-hashing
          await Staff.updateOne(
            { _id: staff._id },
            { $set: { phone: normalizedPhone } }
          );
          staffFixed++;
        } catch (err) {
          console.error(`    XATO: ${err.message}`);
          staffErrors.push({
            id: staff._id,
            name: `${staff.firstName} ${staff.lastName}`,
            error: err.message,
          });
        }
      }
    }

    console.log(`\nStaff: ${staffFixed} ta telefon raqam to'g'irlandi`);
    if (staffErrors.length > 0) {
      console.log(`Xatolar: ${staffErrors.length} ta`);
      staffErrors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
    }

    // ============ RESTAURANT ADMIN telefon raqamlarini to'g'irlash ============
    console.log("\n=== RESTAURANT ADMIN telefon raqamlarini to'g'irlash ===");

    const allAdmins = await RestaurantAdmin.find({});
    console.log(`Jami ${allAdmins.length} ta restaurant admin topildi`);

    let adminFixed = 0;
    let adminErrors = [];

    for (const admin of allAdmins) {
      const originalPhone = admin.phone;
      const normalizedPhone = normalizePhone(originalPhone);

      if (originalPhone !== normalizedPhone) {
        console.log(
          `  [${admin.firstName} ${admin.lastName}] "${originalPhone}" -> "${normalizedPhone}"`
        );

        try {
          await RestaurantAdmin.updateOne(
            { _id: admin._id },
            { $set: { phone: normalizedPhone } }
          );
          adminFixed++;
        } catch (err) {
          console.error(`    XATO: ${err.message}`);
          adminErrors.push({
            id: admin._id,
            name: `${admin.firstName} ${admin.lastName}`,
            error: err.message,
          });
        }
      }
    }

    console.log(
      `\nRestaurant Admin: ${adminFixed} ta telefon raqam to'g'irlandi`
    );
    if (adminErrors.length > 0) {
      console.log(`Xatolar: ${adminErrors.length} ta`);
      adminErrors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
    }

    // ============ YAKUNIY NATIJA ============
    console.log("\n========================================");
    console.log("YAKUNIY NATIJA:");
    console.log(`  Staff: ${staffFixed} ta to'g'irlandi`);
    console.log(`  Restaurant Admin: ${adminFixed} ta to'g'irlandi`);
    console.log(`  Jami: ${staffFixed + adminFixed} ta telefon raqam to'g'irlandi`);
    console.log("========================================\n");

    await mongoose.disconnect();
    console.log("MongoDB dan uzildi");
    process.exit(0);
  } catch (error) {
    console.error("Xatolik:", error);
    process.exit(1);
  }
}

// Scriptni ishga tushirish
fixPhoneNumbers();
