const mongoose = require("mongoose");

// MongoDB ulanish
const MONGO_URI = "mongodb://root:SuperStrongPassword123@109.205.176.124:27017/kepket?authSource=admin";
const RESTAURANT_ID = "697173438338a083c0f0552e";

// Staff schema (waiterlar shu yerda)
const staffSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["waiter", "cook", "cashier"], required: true },
    status: { type: String, enum: ["working", "fired"], default: "working" },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: null },
    fcmToken: { type: String, default: null },
    isWorking: { type: Boolean, default: false },
    assignedTables: [{ type: mongoose.Schema.Types.ObjectId, ref: "Table" }],
    assignedCategories: [{ type: String }],
    salaryPercent: { type: Number, default: 5 },
  },
  { timestamps: true }
);

const Staff = mongoose.model("Staff", staffSchema);

// Waiterlar ro'yxati
const waiters = [
  { firstName: "Гулжан", lastName: "Мырзабаева", phone: "+998933202910" },
  { firstName: "Гулсанем", lastName: "Амангелдиева", phone: "+998943151625" },
  { firstName: "Аброр", lastName: "Якыпбаев", phone: "+998912731614" },
  { firstName: "Гузел", lastName: "Абуова", phone: "+998992400204" },
  { firstName: "Айгерим", lastName: "Кошкарбева", phone: "+998992132901" },
  { firstName: "Ринат", lastName: "Балтамуратов", phone: "+998910980460" },
  { firstName: "Султан", lastName: "Байрамбаев", phone: "+998931080212" },
  { firstName: "Ербол", lastName: "Утепбергенов", phone: "+998949764144" },
  { firstName: "Мафтуна", lastName: "Базарбаева", phone: "+998972411106" },
  { firstName: "Айдос", lastName: "Муратов", phone: "+998913959949" },
  { firstName: "Маҳмуд", lastName: "Орынбаев", phone: "+998913779545" },
  { firstName: "Асад", lastName: "Айназаров", phone: "+998931665692" },
];

async function main() {
  try {
    console.log("MongoDB ga ulanmoqda...");
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB ga ulandi!\n");

    // Avval shu telefon raqamli stafflarni o'chirish
    console.log("Eski waiterlarni o'chirish...");
    const phones = waiters.map(w => w.phone);
    const deleteResult = await Staff.deleteMany({ phone: { $in: phones } });
    console.log(`O'chirildi: ${deleteResult.deletedCount} ta waiter\n`);

    // Yangi waiterlarni qo'shish
    console.log("Yangi waiterlarni qo'shish...");
    console.log("=".repeat(60));

    for (const waiter of waiters) {
      const newStaff = await Staff.create({
        firstName: waiter.firstName,
        lastName: waiter.lastName,
        phone: waiter.phone,
        password: "123456",
        restaurantId: RESTAURANT_ID,
        role: "waiter",
      });
      console.log(`✓ ${waiter.firstName} ${waiter.lastName} (${waiter.phone})`);
    }

    console.log("=".repeat(60));
    console.log(`\nJami ${waiters.length} ta waiter qo'shildi!`);

    // Tekshirish
    const count = await Staff.countDocuments({ restaurantId: RESTAURANT_ID, role: "waiter" });
    console.log(`Bazadagi waiterlar soni: ${count}`);

  } catch (error) {
    console.error("Xato:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB dan uzildi.");
  }
}

main();
