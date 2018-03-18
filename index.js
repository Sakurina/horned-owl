var Alexa = require('alexa-sdk');
var https = require('https');

// Horned Owl, an Overwatch League Alexa skill by Yanik Magnan

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    // alexa.appId = '';
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var replies = {
    'LIVEGAME_REPLY': function(t1, t2, t1m, t2m) {
        var tpl = "The {TEAM1} is currently playing the {TEAM2}. The map score is {T1MAPS}-{T2MAPS}.";
        return tpl.replace("{TEAM1}", t1).replace("{TEAM2}", t2).replace("{T1MAPS}", t1m).replace("{T2MAPS}", t2m);
    },
    'UPCOMING_REPLY': "No Overwatch League game is being played right now.",
    'TEAMGAME_REPLY': function(t1, t2, t1m, t2m) {
        var tpl = "Their last game was {TEAM1} versus {TEAM2}, with a final map score of {T1MAPS}-{T2MAPS}.";
        return tpl.replace("{TEAM1}", t1).replace("{TEAM2}", t2).replace("{T1MAPS}", t1m).replace("{T2MAPS}", t2m);
    }
};

var handlers = {
    'LiveGameIntent': function() {
	httpsGet({
	    host: 'api.overwatchleague.com',
	    port: 443,
	    path: '/live-match?expand=team',
	    method: 'GET'
	}, (obj) => {
		var liveMatch = obj["data"]["liveMatch"];
		var team1Name = liveMatch["competitors"][0].name;
		var team2Name = liveMatch["competitors"][1].name;
		var liveStatus = liveMatch.liveStatus;
		if (liveStatus == "LIVE") {
		    var team1Score = liveMatch["scores"][0].value;
		    var team2Score = liveMatch["scores"][1].value;
		    this.response.speak(replies['LIVEGAME_REPLY'](team1Name, team2Name, team1Score, team2Score));
		} else if (liveStatus == "UPCOMING") {
		    this.response.speak(replies['UPCOMING_REPLY']);
		} else {
		    this.response.speak(replies['UPCOMING_REPLY']);
		}
		this.emit(':responseReady');
	});
    },
    'TeamGameIntent': function() {
        var slotValues = getSlotValues(this.event.request.intent.slots);
        var id = slotValues.TeamName.id;
        httpsGet({
            host: 'api.overwatchleague.com',
            port: 443,
            path: '/schedule',
            method: 'GET'
        }, (obj) => {
            var stages = obj["data"]["stages"];
            var unflattenedGames = stages.map(
                (s) => { return s.matches.filter(
                    (m) => { return m.state == "CONCLUDED" && 
                    (m["competitors"][0].abbreviatedName == id ||
                    m["competitors"][1].abbreviatedName == id); })});
            var flattenedGames = [].concat.apply([], unflattenedGames);
            var game = flattenedGames[flattenedGames.length - 1];
            var team1Name = game["competitors"][0].name;
		    var team2Name = game["competitors"][1].name;
            var team1Score = game["scores"][0].value;
		    var team2Score = game["scores"][1].value;
		    this.response.speak(replies['TEAMGAME_REPLY'](team1Name, team2Name, team1Score, team2Score));
		    this.emit(':responseReady');
        });
    },
    'AMAZON.StopIntent': function() {
	    this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function() {
	    this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function() {
	    this.emit(':responseReady');
    },
    'SessionEndedRequest': function() {
        
    },
    'Unhandled': function() {
        
    }
};

function httpsGet(options, callback) {
    var req = https.request(options, res => {
      res.setEncoding('utf8');
      var returnData = "";
      res.on('data', chunk => {
        returnData = returnData + chunk;
      });

      res.on('end', () => {
	    var value = JSON.parse(returnData);
	    callback(value);
      });
    });
    req.end();
}

function getSlotValues (filledSlots) {
    //given event.request.intent.slots, a slots values object so you have
    //what synonym the person said - .synonym
    //what that resolved to - .resolved
    //and if it's a word that is in your slot values - .isValidated
    let slotValues = {};

    console.log(JSON.stringify(filledSlots));

    Object.keys(filledSlots).forEach(function(item) {
        //console.log("item in filledSlots: "+JSON.stringify(filledSlots[item]));
        var name=filledSlots[item].name;
        //console.log("name: "+name);
        if(filledSlots[item]&&
           filledSlots[item].resolutions &&
           filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
           filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
           filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code ) {

            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
                case "ER_SUCCESS_MATCH":
                    slotValues[name] = {
                        "synonym": filledSlots[item].value,
                        "resolved": filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
                        "id": filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.id,
                        "isValidated": filledSlots[item].value == filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name
                    };
                    break;
                case "ER_SUCCESS_NO_MATCH":
                    slotValues[name] = {
                        "synonym":filledSlots[item].value,
                        "resolved":filledSlots[item].value,
                        "id":filledSlots[item].value,
                        "isValidated":false
                    };
                    break;
                }
            } else {
                slotValues[name] = {
                    "synonym": filledSlots[item].value,
                    "resolved":filledSlots[item].value,
                    "isValidated": false
                };
            }
        },this);
        return slotValues;
}

