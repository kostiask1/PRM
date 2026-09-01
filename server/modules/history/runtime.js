const storage = require("../../storage");
const { createHistoryService } = require("./application/historyService");

const historyService = createHistoryService(storage);

module.exports = { historyService };
