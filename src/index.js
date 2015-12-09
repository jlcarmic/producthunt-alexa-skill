// Set App ID
var APP_ID = 'amzn1.echo-sdk-ams.app.a5c00e5b-91c4-4b8d-a720-79e1cce84b53';

// Require Needed Modules
var fs = require('fs');
var Client = require('node-rest-client').Client;
var AlexaSkill = require('./AlexaSkill');
var emojiStrip = require('emoji-strip');
var asciify = require('asciify-string');
var xmlescape = require('xml-escape');

// Create a REST client for calling ProductHunt API
var client = new Client();

// Create Skill Object, inheriting from AlexaSkill
var ProductHuntSkill = function() {
    AlexaSkill.call(this, APP_ID);
};

ProductHuntSkill.prototype = Object.create(AlexaSkill.prototype);
ProductHuntSkill.prototype.constructor = ProductHuntSkill;

// Handle Session Start
ProductHuntSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("ProductHuntSkill onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
};

// Handle Skill Launch
ProductHuntSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("ProductHuntSkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);

    var cardTitle = "Product Hunt";
    var repromptText = "With Product, you can get today's hunts for a given category.  For example, you could say today, or for technology. Meow, which category do you want?";
    var speechText = "<p>Product Hunt.</p> <p>Which category do you want hunts for?</p>";
    var cardOutput = "Product Hunt. Which category do you want hunts for?";

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };

    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };

    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
};

// Handle Session End
ProductHuntSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId + ", sessionId: " + session.sessionId);
};

// Set up Intent Handlers
ProductHuntSkill.prototype.intentHandlers = {

    "CategoryIntent": function (intent, session, response) {
        handleCategoryRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "With Product Hunt, you can get hunts for any category.  For example, you could say technology or books, or you can say exit. Meow, which category do you want?";
        var repromptText = "Which category do you want?";
        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: repromptText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye for meow.",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye for meow.",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    }
};

function handleCategoryRequest(intent, session, response) {
	var catSlot = intent.slots.category;
	var cat = category_disambiguate(catSlot.value);

	// Decrypt PH API Secret
	var secrets = fs.readFileSync('./secrets.txt');
	var ph_keys = JSON.parse(secrets);

	// First get oauth client key
	var args = {
		headers: { "Content-Type": "application/json" },
		data: { "client_id": ph_keys['API_KEY'], "client_secret": ph_keys['API_SECRET'], "grant_type": "client_credentials" }
	};

	client.post("https://api.producthunt.com/v1/oauth/token", args, function(data, resp) {
		if(resp.statusCode == 200) {
			var body = JSON.parse(data);
			var token = body['access_token']

			if(token != '') {
				args = {
					headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
				};

				var cat_url = "https://api.producthunt.com/v1/categories/" + cat + "/posts";
				client.get(cat_url, args, function(data, resp) {
					if(resp.statusCode == 200) {
						posts = JSON.parse(data)['posts'];

						if (posts.length > 0) {
							var date = new Date();
							var prefix = "Today's Hunts for " + cat;
							var cardTitle = prefix;
							var cardContent = prefix;
							var speechText = "<p>" + prefix + "</p> ";
							var repromptText = "With Product Hunt, you can get hunts for any category.  For example, you could say technology or books, or you can say exit. Meow, which category do you want?";

							for (var i = 0; i < posts.length; i++) {
								var entry = fixFormat(posts[i]['user']['name'] + " posted " + posts[i]['name'] + ", " + posts[i]['tagline'] + ".  ");

								cardContent = cardContent + entry + " ";
								speechText = speechText + "<p>" + entry + "</p> ";
							}

							speechText = speechText + " <p>Would you like another category meow?</p>";

							var speechOutput = {
								speech: "<speak>" + speechText + "</speak>",
								type: AlexaSkill.speechOutputType.SSML
							};

							var repromptOutput = {
								speech: repromptText,
								type: AlexaSkill.speechOutputType.PLAIN_TEXT
							};

							response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
						} else {
							speechText = "There is a problem connecting to Product Hunt at this time. Please try again later.";
							cardContent = speechText;
							response.tell(speechText);
						}
					} else {
						speechText = "There is a problem connecting to Product Hunt at this time. Please try again later.";
						cardContent = speechText;
						response.tell(speechText);		
					}
				});
			} else {
				speechText = "There is a problem connecting to Product Hunt at this time. Please try again later.";
				cardContent = speechText;
				response.tell(speechText);
			}
		} else {
			speechText = "There is a problem connecting to Product Hunt at this time. Please try again later.";
			cardContent = speechText;
			response.tell(speechText);
		}
	});
}

function fixFormat(inp) {
	var re = new RegExp(" ❄︎", 'g');
	return xmlescape(asciify(emojiStrip(inp))).replace(re, "");
}

function category_disambiguate(cat) {
	var cat_mappings = {
		"tech": "tech",
		"technology": "tech",
		"games": "games",
		"game": "games",
		"gaming": "games",
		"podcasts": "podcasts",
		"podcast": "podcasts",
		"podcasting": "podcasts",
		"books": "books",
		"book": "books"
	};

	return cat_mappings[cat];
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HistoryBuff Skill.
    var skill = new ProductHuntSkill();
    skill.execute(event, context);
};