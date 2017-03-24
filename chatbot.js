const fs = require("fs");
const login = require("facebook-chat-api");

function startBot(api) {

   var firstRun = true;

   //call stopListening() to stop bot
   var stopListening = api.listen((err, event) => {
      if (err) return console.error(err);

      if (firstRun && event.threadID) {
         api.sendMessage(
            "Hey! I'm a chatbot. Type 'max help' to see what I can do!",
            event.threadID);
         firstRun = false;
      }
      if (event.type === "message") {
         console.log("Received Message:", event.body);
         var senderName = "";
         api.getUserInfo(event.senderID, (err, ret) => {
            if (err) return console.error(err);

            for (var prop in ret) {
               if (ret.hasOwnProperty(prop) && ret[prop].firstName) {
                  senderName = ret[prop].firstName;
                  console.log("got first name:" + senderName);
               }
            }

            read(event.body, senderName, event.threadID,
               event.senderID, event.attachments,
               function(msg) {
                  if (!msg) return;

                  console.log("Sending Message:", msg);
                  if (msg.text && msg.text.length > 0) {
                     api.sendMessage(
                        msg.text, event.threadID);
                  } else {
                     if (msg.stickerID) {
                        api.sendMessage({
                           sticker: msg.stickerID
                        }, event.threadID);
                     }
                  }

                  api.markAsRead(event.threadID);
               });

         });
      } else {
         //console.log("non message logged");
         //if (event.logMessageType === )
      }
   });

   function read(message, senderName, threadID, senderID, attachments,
      callback) {

      var allCommands = [basicText];

      //test if this executes commands after one already done
      for (var i = 0; i < allCommands.length; i++) {
         allCommands[i](message, callback);
      }
      /*api.sendMessage("Test", threadID);
      callback({
         text: "Can't reply for now, I'm working on it."
      });*/

      function basicText(msg, callback) {
         var possibilities = [
            [
               [/^(hey |hi |hello |sup |yo )?max((\?|\!|\.| |)*)?$/i],
               ["Sup", "Hey :D", "Hey " + senderName, "Hi " +
                  senderName + "!", "Hello " + senderName, "Yo",
                  "what's poppin B?"
               ]
            ],
         ];

         for (var i = 0; i < possibilities.length; i++) {
            var possibleMatches = possibilities[i][0];
            for (var j = 0; j < possibleMatches.length; j++) {
               var match = possibleMatches[j].exec(msg);

               if (match && match.length > 0) {
                  return callback({
                     text: randomFromArray(possibilities[i][1])
                  });
               }
            }
         }
      }
   }
}


function randomFromArray(arr) {
   return arr[~~(arr.length * Math.random())];
}
// Create simple echo bot
//login({email: "batmanmanabat1", password: "batmanmanabat1"}, (err, api) =>
//login({appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))}, (err, api) =>
login({
   appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
}, (err, api) => {
   if (err) return console.error(err);

   //creates login file...use if current one expires?
   //fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));

   api.setOptions({
      logLevel: "silent",
      forceLogin: true,
      listenEvents: true
   });

   startBot(api);
});
