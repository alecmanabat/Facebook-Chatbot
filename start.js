const forever = require("forever");
console.log("starting bot!");
forever.start("chatbot.js", { });
