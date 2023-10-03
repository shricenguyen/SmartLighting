const mongoose = require("mongoose");

const lightDataSchema = new mongoose.Schema({
  lightID: String,
  lightStatus: Boolean,
  toggleTime: Date,
});

module.exports = mongoose.model("lightData", lightDataSchema);
