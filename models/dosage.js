const mongoose = require("mongoose");

const dosageSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
});

const Dosage = mongoose.model("Dosage", dosageSchema);

module.exports = Dosage;
