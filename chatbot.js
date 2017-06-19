const fs = require("fs");
const login = require("facebook-chat-api");
const rp = require("request-promise");
const NodeGeocoder = require("node-geocoder");
const http = require("http");
const https = require("https");
const MongoClient = require("mongodb").MongoClient;

var config = require("./config.js");

function startBot(api) {
    var debug = false;
    var spotifyToken;
    var allThreads = [];

    setTimeout(restartBot, 86400000);
    authenticateSpotify();
    checkBirthdays();

    MongoClient.connect(config.mongoURI, function(err, db) {
        if (err) throw err;
        updateThreadsArray(db);
        //bot actually starts here
        api.listen((err, event) => {
            if (err) return console.error(err);
            api.handleMessageRequest(event.threadID, true, (err) => {
                if (err) console.log(err);
                if (debug || allThreads.indexOf(event.threadID) != -1) {
                    listen(event);
                }
                else {
                    db.collection("threads").insertOne({threadID: event.threadID}, function(err, res) {
                        if (err) throw err;
                        updateThreadsArray(db);
                        console.log("sending welcome message to new convo");
                        api.sendMessage("Hey! I'm a chatbot. Type 'max help' to see what I can do!",
                            event.threadID, (err, msgInfo) => {

                                if (err) console.log(err);
                                listen(event);
                            });
                    });
                }
            });
        });

    });

    function listen(event) {
        api.markAsRead(event.threadID, (err) => {
            if (err) console.log(err);
            if (event.type === "message") {
                console.log("Received Message:", event.body);
                var senderName = "";
                api.getUserInfo(event.senderID, (err, ret) => {
                    if (err) return console.error(err);
                    for (var prop in ret) {
                        if (ret.hasOwnProperty(prop) && ret[prop].firstName) {
                            senderName = ret[prop].firstName;
                            break;
                            //console.log("got first name:" + senderName);
                        }
                    }
                    read(event.body, senderName, event.threadID, event.senderID, event.attachments,
                        function(msg) {
                            if (!msg) return;
                            console.log("Sending Message: ", msg.text);
                            //some special commands not called back to here
                            if (msg.text && msg.text.length > 0) {
                                api.sendMessage({
                                    body: msg.text
                                }, event.threadID, (err, msgInfo) => {
                                    if (err) console.log(err);
                                });
                            }
                            else {
                                if (msg.url) {
                                    api.sendMessage({
                                        url: msg.url
                                    }, event.threadID, (err, msgInfo) => {
                                        if (err) console.log(err);
                                    });
                                }
                            }
                        }); //end read
                }); //end get user info
            }
            else {
                //console.log("non message logged");
                //if (event.logMessageType === )
            }
        });
    } //end listen
    function read(message, senderName, threadID, senderID, attachments, callback) {
        var allCommands = [basicText, answer, weather, rave, spotify, title, meme, add, kick,
            nickname, dictionary, youtube, news, restart, broadcast
        ];

        var executed = false;
        if (message) {
            message = message.toLowerCase();
            for (var i = 0; i < allCommands.length; i++) {
                allCommands[i](message, callback);
                if (executed) break;
            }
        }

        function basicText(msg, callback) {
            var possibilities = [
                [
                    [/^(hey |hi |hello |greetings |yo |sup |hallo )?max((\?|\!|\.| |)*)?$/i],
                    ["Sup", "Hey :D", "Hey " + senderName + "!", "Hi " + senderName + "!", "Hello " + senderName +
                        "!", "Yo", "Hey what's up hello!", "Hallo!", "Woof"
                    ]
                ],
                [
                    [/^(woof|bork|meow|oink|quack|moo)$/i],
                    [
                        "woof", "bork"
                    ]
                ],
                [
                    [/(who((')?s)? a )?good boy max|max good boy/i],
                    ["*wags*"]
                ],
                [
                    [/^max help( )?$/i],
                    [
                        "-greet me\n-max answer (question): answers a math/short answer question\n" +
                        "-max weather (location): gets weather for a location\n-max rave/disco/hit the lights: "
                        + "starts the party\n-max song (search): searches Spotify for song and attaches a 30 sec "
                        + "preview\n-max artist (artist name): - searches Spotify for an artist\n-max album (album"
                        + " name): - searches Spotify for an album\n-max playlist (name): searches Spotify for a" +
                        " playlist\n-max meme: gets a dank meme (may be offensive)\n-max title (title): changes chat"
                        + " title\n-max add (person): adds person to chat (only works on group chats)\n-max kick" +
                        " (person): kicks person from chat\n-max nickname \"name\" \"nickname\": sets nickname of a"
                        + " person (you need the quotes)\n-max youtube (search): searches YouTube for a video"
                        + " or channel\n-max news/news2: gets top 5 news articles from google (or reuters if you"
                        + " add the 2)"
                    ]
                ],
                [
                    [/( |^)(what(')?s up |sup |how(')?s it going|(wus|what(')?s) poppin(g)? )max(\?)?( $|$)/i],
                    ["Nothing much...", "I'm tired", "I'm hungry", "Woof"]
                ],
                [
                    [/( |^)max yes or no /i],
                    ["yea", "absolutely", "obviously", "yep", "no", "noooooooo", "nope", "ye", "nah", "ofc",
                        "uhhh... yeah", "uhhhh... no", "well duh...", "no way José", "don't bother me " + senderName
                    ]
                ],
                [
                    [/((I )?love (you )?(me )?max($| )|max i love you)/i],
                    ["Love you too " + senderName + "!", "<3"]
                ],
                [
                    [/( |^)max (coin flip|flip a coin|heads or tails)$/i],
                    ["heads", "tails"]
                ]
            ];
            for (var i = 0; i < possibilities.length; i++) {
                var possibleMatches = possibilities[i][0];
                for (var j = 0; j < possibleMatches.length; j++) {
                    var match = possibleMatches[j].exec(msg);
                    if (match && match.length > 0) {
                        executed = true;
                        callback({
                            text: randomFromArray(possibilities[i][1])
                        });
                    }
                }
            }
        }

        function restart(msg, callback) {
            var regex = /^max restart($| $)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                if (senderID.toString() === config.devID) {
                    restartBot();
                }
                else {
                    console.log("bad sender id:" + senderID);
                    return callback({text: "Permission denied."});
                }
            }
        }

        function broadcast(msg, callback){
            var regex = /^max broadcast (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                if (senderID.toString() === config.devID) {
                    var message = msg.substring(msg.indexOf("broadcast") + 10, msg.length);
                    console.log("broadcasting: " + message);
                    for (let i = 0; i < allThreads.length; i++) {
                        setTimeout(sendBroadcast, 500*i, message, i);
                    }
                }
                else {
                    console.log("bad sender id:" + senderID);
                    return callback({text: "Permission denied."});
                }
            }

            function sendBroadcast(message, i) {
                api.sendMessage({
                    body: message
                }, allThreads[i], (err, msgInfo) => {
                    if (err) console.log(err);
                });
            }
        }

        function answer(msg, callback) {
            var regex = /^max answer (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                console.log("getting answer");
                var question = msg.substring(msg.indexOf("answer") + 7, msg.length);
                question = question.replace(/\+/g, "%2B");
                question = question.replace(/ /g, "+");
                var url = "http://api.wolframalpha.com/v1/result?appid=" + config.wolframKey
                    + "&i=" + question;
                rp(url).then(function(html) {
                    return callback({
                        text: html
                    });
                }).catch(function(err) {
                    console.log("wolfram error:" + err);
                    return callback({
                        text: "error"
                    });
                });
            }
        }

        function dictionary(msg, callback) {
            //https://od-api.oxforddictionaries.com/api/v1
            var regex = /^max (define|synonym) (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                regex = /^max define/i;
                match = regex.exec(msg);
                var word;
                if (match && match.length > 0) {
                    word = msg.substring(msg.indexOf("define") + 7, msg.length);
                }
                else {
                    word = msg.substring(msg.indexOf("synonym") + 8, msg.length);
                }
                var word2 = word.replace(/ /g, "_");
                var url;
                if (match && match.length > 0) {
                    url = "https://od-api.oxforddictionaries.com/api/v1/entries/en/" + word2 +
                        "/definitions;regions=us";
                }
                else {
                    url = "https://od-api.oxforddictionaries.com/api/v1/entries/en/" + word2 + "/synonyms";
                }
                var options = {
                    uri: url,
                    headers: {
                        "Accept": "application/json",
                        "app_id": config.dictionaryID,
                        "app_key": config.dictionaryKey
                    },
                    json: true // Automatically parses the JSON string in the response
                };
                rp(options).then(function(json) {
                    console.log("got dictionary entries of " + word);
                    var data = json.results[0];
                    var response = word.toUpperCase() + "\n";
                    for (var i = 0; i < data.lexicalEntries.length; i++) {
                        response += "(" + data.lexicalEntries[i].lexicalCategory + ")\n";
                        if (match && match.length > 0) {
                            //dictionary entry
                            for (let j = 0; j < data.lexicalEntries[i].entries[0].senses.length; j++) {
                                response += "  " + (j + 1) + ". " + data.lexicalEntries[i].entries[0].senses[j]
                                    .definitions[0] + "\n";
                                if (j > 3) {
                                    break;
                                }
                            }
                        }
                        else {
                            //thesaurus
                            for (let j = 0; j < data.lexicalEntries[i].entries[0].senses[0].synonyms.length; j++) {
                                response += "  " + (j + 1) + ". " + data.lexicalEntries[i].entries[0].senses[0]
                                    .synonyms[j].text + "\n";
                                if (j > 3) {
                                    break;
                                }
                            }
                        }
                    }
                    return callback({
                        text: response
                    });
                }).catch(function(err) {
                    console.log("define error:" + err);
                    let response = "No entry for " + word;
                    return callback({
                        text: response
                    });
                });
            }
        }

        function youtube(msg, callback) {
            var regex = /^max (youtube|yt) (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed=true;
                var query= msg.substring(msg.indexOf("youtube") + 8, msg.length);
                query = query.replace(/\+/g, "%2B");
                query = query.replace(/ /g, "+");
                // try using this instead?
                /* question = encodeURI(question) */
                var url = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=" + query
                    + "&key="+ config.youtubeKey;

                rp(url).then(function(json) {
                    var response;
                    json = JSON.parse(json);
                    if (json.items[0].id.kind == "youtube#video") {
                        response = "https://www.youtube.com/watch?v=" + json.items[0].id.videoId;
                    }
                    else {
                        response = "https://www.youtube.com/user/" + json.items[0].snippet.channelTitle;
                    }
                    return callback({
                        url: response
                    });
                }).catch(function(err) {
                    console.log("youtube error:" + err);
                    return callback({
                        text: "No results"
                    });
                });
            }
        }

        function nickname(msg, callback) {
            var regex = /^max nickname "((\S( )?)+)" "((\S( )?)+)?"$/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                console.log("setting nickname");
                if (msg.includes("@")) {
                    msg = msg.replace(/@/, "");
                }
                var names = msg.substring(msg.indexOf("\"") + 1, msg.length);
                var name = names.substring(0, names.indexOf("\""));
                names = names.substring(names.indexOf("\"") + 1, names.length);
                names = names.substring(names.indexOf("\"") + 1, names.length);
                var newName = "";
                newName = names.substring(0, names.length - 1); //FIX THIS?
                if (newName.includes("\"")) {
                    newName = "";
                }
                console.log("Trying to change " + name + " to nickname: " + newName);
                findUserID(name, (err, personID, obj) => {
                    if (err) {
                        console.log(err);
                        var response = "Couldn't find " + name;
                        return callback({
                            text: response
                        });
                    }
                    else {
                        console.log("changing nickname of " + name + " to: " + newName);
                        api.changeNickname(newName, threadID, personID, (err) => {
                            if (err) {
                                console.error(err);
                                var response = "Couldn't change nickname of " + name;
                                return callback({
                                    text: response
                                });
                            }
                        });
                    }
                });
            }
        }
        //Powered By Dark Sky
        //https://darksky.net/poweredby/
        function weather(msg, callback) {
            var regex = /^max weather (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                var options = {
                    provider: "google",
                    apiKey: config.geocoderKey
                };
                var geocoder = NodeGeocoder(options);
                console.log("getting geocode");
                var query = msg.substring(msg.indexOf("weather") + 8, msg.length);
                geocoder.geocode(query).then(function(res) {
                    var latitude = res[0].latitude;
                    var longitude = res[0].longitude;
                        //https://api.darksky.net/forecast/[key]/[latitude],[longitude]
                    var url = "https://api.darksky.net/forecast/" + config.weatherkey +
                            "/" + latitude + "," + longitude;
                    console.log("getting weather");
                    rp(url).then(function(result) {
                        var data = JSON.parse(result);
                        var answer = query.toUpperCase() + "\n" + Math.round(data.currently.temperature) +
                                "\xB0F " + data.currently.summary + "\n" + data.hourly.summary + "\n" +
                                data.daily.summary;
                        return callback({
                            text: answer
                        });
                    }).catch(function(err) {
                        console.log("weather error:" + err);
                        var response = "Couldn't get weather for " + query;
                        return callback({
                            text: response
                        });
                    });
                }) //end geocode then
                    .catch(function(err) {
                        console.log("geocoder error:" + err);
                        var response = "Couldn't get weather for " + query;
                        return callback({
                            text: response
                        });
                    });
            }
        } //end weather

        function news(msg, callback) {
            var regex = /^max news(2| 2)?( $|$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                var source = "google-news";
                executed = true;
                regex = /2/;
                match = regex.exec(msg);
                if (match && match.length > 0) {
                    source = "reuters";
                }
                var url = "https://newsapi.org/v1/articles?source=" + source + "&sortBy=top&apiKey="
                + config.newsKey;
                rp(url).then(function(results) {
                    var data = JSON.parse(results);
                    for (let i=0; i < 3; i++) {
                        setTimeout(sendNews, 500*i, data, i);
                    }
                    return;
                }).catch(function(err) {
                    console.log("news error:" + err);
                    return callback({
                        text: "Couldn't get news"
                    });
                });
            }

            function sendNews(data, i) {
                api.sendMessage({
                    url: data.articles[i].url
                }, threadID, (err, msgInfo) => {
                    if (err) console.log(err);
                });
            }
        }

        function rave(msg, callback) {
            var regex = /^max (rave|disco|hit the lights)( $|$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                console.log("starting the party");
                api.getThreadInfo(threadID, (err, info) => {
                    var currentColor = info.color;
                    var times = 10;
                    changeColor(times, 0);

                    function changeColor(times, i) {
                        if (i == times) {
                            if (currentColor) setTimeout(api.changeThreadColor, 350, currentColor, threadID);
                        }
                        else {
                            var color = getRandomColor();
                            api.changeThreadColor(color, threadID, (err) => {
                                setTimeout(changeColor, 350, times, i + 1);
                            });
                        }
                    }
                });
            }
        }

        function title(msg, callback) {
            var regex = /^max title (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                var newTitle = msg.substring(msg.indexOf("title") + 6, msg.length);
                api.setTitle(newTitle, threadID, (err, obj) => {
                    if (err) {
                        console.log(err);
                        return callback({
                            text: "error"
                        });
                    }
                });
            }
        }

        function add(msg, callback) {
            var regex = /^max add (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                if (msg.includes("@")) {
                    msg = msg.replace(/@/, "");
                }
                var person = msg.substring(msg.indexOf("add") + 4, msg.length);
                console.log("adding " + person);
                //if user was in thread before
                api.getUserID(person, (err, obj) => {
                    if (err) {
                        console.log(err);
                        return callback({
                            text: "Couldn't add " + person
                        });
                    }
                    else {
                        var newPersonID;
                        for (var prop in obj) {
                            if (obj.hasOwnProperty(prop) && obj[prop].userID) {
                                newPersonID = obj[prop].userID;
                                break;
                            }
                        }
                        api.addUserToGroup(newPersonID, threadID, (err) => {
                            if (err) {
                                console.log(err);
                                return callback({
                                    text: "Couldn't add " + person
                                });
                            }
                            else {
                                api.getUserInfo(newPersonID, (err, obj2) => {
                                    if (err) {
                                        console.log(err);
                                        return callback({
                                            text: "Couldn't add " + person
                                        });
                                    }
                                    else {
                                        var response = "Welcome ";
                                        for (var id in obj2) {
                                            response = response + obj2[id].firstName;
                                        }
                                        return callback({
                                            text: response
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }

        function kick(msg, callback) {
            var regex = /^max kick (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                if (msg.includes("@")) {
                    msg = msg.replace(/@/, "");
                }
                var person = msg.substring(msg.indexOf("kick") + 5, msg.length);
                console.log("kicking " + person);
                findUserID(person, (err, personID, obj) => {
                    if (err) {
                        console.log(err);
                        var response = "Couldn't find " + person;
                        return callback({
                            text: response
                        });
                    }
                    else {
                        api.removeUserFromGroup(personID, threadID, (err) => {
                            if (err) console.log(err);
                            else {
                                if (personID != api.getCurrentUserID()) {
                                    var response = "Bye bye " + obj[personID].firstName;
                                    return callback({
                                        text: response
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }

        function meme(msg, callback) {
            var regex = /^max (fetch )?meme( $|$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                var weekly = Math.floor(Math.random() * 5);
                var url;
                var index;
                var type;
                if (weekly >= 1) {
                    url = "https://www.reddit.com/r/dankmemes/top.json?t=week&limit=100";
                    index = Math.floor(Math.random() * (100));
                    type = "weekly";
                }
                else {
                    // get meme from daily instead
                    url = "https://www.reddit.com/r/dankmemes/top.json?t=day&limit=25";
                    index = Math.floor(Math.random() * (25));
                    type = "daily";
                }
                rp(url).then(function(html) {
                    var json = JSON.parse(html);
                    console.log("index:" + index);
                    var memeTitle = json.data.children[index].data.title;
                    var memeURL = json.data.children[index].data.url;
                    var path;
                    if (memeURL.includes(".gif")) {
                        path = "./meme.gif";
                    }
                    else {
                        path = "./meme.jpg";
                    }
                    var file = fs.createWriteStream(path);
                    console.log(type + " meme title:" + memeTitle);
                    // use decodeURI?
                    memeURL = memeURL.toString().split("&amp;").join("&");
                    console.log("meme url:" + memeURL);
                    var http_or_https = http;
                    regex = /^https:\/\//i;
                    match = regex.exec(memeURL);
                    if (match && match.length > 0) http_or_https = https;
                    http_or_https.get(memeURL, function(response) {
                        response.pipe(file);
                        file.on("finish", function() {
                            file.close((err) => {
                                if (err) console.log(err);
                                console.log("downloaded meme");
                                var meme = fs.createReadStream(path);
                                api.sendMessage({
                                    body: memeTitle,
                                    attachment: meme
                                }, threadID, (err, msgInfo) => {
                                    if (err) console.log(err);
                                    if (fs.existsSync(path)) {
                                        fs.unlink(path);
                                    }
                                });
                                return callback();
                            });
                        });
                    });
                }).catch(function(err) {
                    console.log("meme error:" + err);
                    return callback({
                        text: "error"
                    });
                });
            }
        }

        function spotify(msg, callback) {
            var regex = /^max (song|album|artist|playlist) (?!$)/i;
            var match = regex.exec(msg);
            if (match && match.length > 0) {
                executed = true;
                var type = getType(msg);
                console.log("getting " + type);
                var query;
                if (type === "track") {
                    query = msg.substring(msg.indexOf("song") + 5, msg.length);
                }
                else {
                    query = msg.substring(msg.indexOf(type) + type.length + 1, msg.length);
                }
                query = query.replace(/ /g, "+");

                var url = "https://api.spotify.com/v1/search?q=" + query + "&type=" + type + "&limit=1";
                var options = {
                    url: url,
                    headers: {
                        "Authorization": "Bearer " + spotifyToken
                    },
                };
                rp(options).then(function(html) {
                    var data = JSON.parse(html);
                    var spotifyURL;
                    switch (type) {
                        case "track":
                            spotifyURL = data.tracks.items[0].external_urls.spotify;
                            console.log("got track:" + spotifyURL);
                            break;
                        case "artist":
                            spotifyURL = data.artists.items[0].external_urls.spotify;
                            console.log("got artist:" + spotifyURL);
                            break;
                        case "album":
                            spotifyURL = data.albums.items[0].external_urls.spotify;
                            console.log("got album:" + spotifyURL);
                            break;
                        case "playlist":
                            spotifyURL = data.playlists.items[0].external_urls.spotify;
                            console.log("got playlist:" + spotifyURL);
                            break;
                    }
                    return callback({
                        url: spotifyURL
                    });
                }).catch(function(err) {
                    console.log("spotify error:" + err);
                    var response = "Couldn't find " + type + " " + query;
                    return callback({
                        text: response
                    });
                });
            }

            function getType(msg) {
                regex = /^max song (?!$)/i;
                match = regex.exec(msg);
                if (match && match.length > 0) {
                    return "track";
                }
                else {
                    regex = /( |^)max album (?!$)/i;
                    match = regex.exec(msg);
                    if (match && match.length > 0) {
                        return "album";
                    }
                    else {
                        regex = /( |^)max artist (?!$)/i;
                        match = regex.exec(msg);
                        if (match && match.length > 0) {
                            return "artist";
                        }
                        else return "playlist";
                    }
                }
            }
        }

        function findUserID(person, callback) {
            api.getThreadInfo(threadID, (err, data) => {
                if (err) {
                    console.log(err);
                    return callback(1, null, null);
                }
                else {
                    var personID;
                    api.getUserInfo(data.participantIDs, (err, obj) => {
                        if (err) {
                            console.log(err);
                            return callback(2, null, null);
                        }
                        for (let i in obj) {
                            if (obj[i].name.toLowerCase() === person.toLowerCase()) {
                                personID = i;
                                break;
                            }
                        }
                        if (!personID) {
                            for (let i in obj) {
                                if (obj[i].firstName.toLowerCase() === person.toLowerCase()) {
                                    personID = i;
                                    break;
                                }
                            }
                        }
                        if (!personID) {
                            for (let i in data.nicknames) {
                                if (data.nicknames && (data.nicknames[i].toLowerCase().includes(person.toLowerCase())
                                 || person.toLowerCase().includes(data.nicknames[i].toLowerCase()))) {
                                    personID = i;
                                    break;
                                }
                            }
                        }
                        if (personID) {
                            console.log("found ID of: " + person);
                            return callback(0, personID, obj);
                        }
                        else {
                            return callback(3, null, null);
                        }
                    });
                }
            });
        } //end find user id

    } //end read
    function randomFromArray(arr) {
        return arr[~~(arr.length * Math.random())];
    }

    function getRandomColor() {
        var letters = "0123456789ABCDEF";
        var color = "#";
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    function authenticateSpotify() {
        var spotifyKey = Buffer.from(config.spotifyKey).toString("base64");
        let options = {
            uri: "https://accounts.spotify.com/api/token",
            method: "POST",
            form: {
                grant_type: "client_credentials"
            },
            headers: {
                "Authorization": "Basic " + spotifyKey
            },
            json: true // Automatically parses the JSON string in the response
        };
        rp(options).then(function(json) {
            spotifyToken = json.access_token;
        }).catch(function(err) {
            console.log("spotify authentication error:" + err);
        });
        setTimeout(authenticateSpotify, 3600000);
    }

    function updateThreadsArray(db) {
        db.collection("threads").find({}).toArray(function(err, result) {
            if (err) throw err;
            for (let i = 0; i < result.length; i++) {
                if (!allThreads || allThreads.indexOf(result[i].threadID) == -1)
                    allThreads.push(result[i].threadID);
            }
        });
    }

    function checkBirthdays() {
        api.getFriendsList((err, data) => {
            if(err) return console.error(err);

            for(var prop in data) {
                if(data.hasOwnProperty(prop) && data[prop].isBirthday) {
                    api.sendMessage("Happy birthday :)", prop);
                }
            }
        });
    }

} //end startBot



function restartBot(){
    console.log("restarting");
    process.exit();
}

login({
    appState: JSON.parse(fs.readFileSync(config.stateFile, "utf8"))
}, (err, api) => {
    if (err) return console.error(err);
    //use this to get a state file
    //fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
    api.setOptions({
        logLevel: "silent",
        forceLogin: true,
        listenEvents: true
    });
    startBot(api);
});
