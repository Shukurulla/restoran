const SuperAdmin = require("../models/super-admin");

const createDefaultSuperAdmin = async () => {
  try {
    // Mavjud super admin bormi tekshirish
    const existingAdmin = await SuperAdmin.findOne({ username: "admin" });

    if (existingAdmin) {
      console.log("Default super admin allaqachon mavjud");
      return;
    }

    // Default super admin yaratish
    const superAdmin = new SuperAdmin({
      username: "admin",
      password: "admin123",
    });

    await superAdmin.save();
    console.log("Default super admin yaratildi:");
    console.log("  Username: admin");
    console.log("  Password: admin123");
  } catch (error) {
    console.error("Super admin yaratishda xato:", error.message);
  }
};

module.exports = createDefaultSuperAdmin;
