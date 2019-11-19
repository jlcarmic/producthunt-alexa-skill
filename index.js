const Alexa = require('ask-sdk-core')
const asciify = require('asciify-string')
const axios = require('axios')
const emojiStrip = require('emoji-strip')
const xmlescape = require('xml-escape')

function disambiguateCategory(category) {
  switch (category) {
    case 'tech':
    case 'technology':
      return 'tech'
    case 'games':
    case 'game':
    case 'gaming':
      return 'games'
    case 'podcasts':
    case 'podcast':
    case 'podcasting':
      return 'podcasts'
    case 'books':
    case 'book':
      return 'books'
    default:
      return undefined
  }
}

async function authProductHunt() {
  const response = await axios.post('https://api.producthunt.com/v1/oauth/token', {
    client_id: process.env.API_KEY,
    client_secret: process.env.API_SECRET,
    grant_type: "client_credentials"
  })

  return response.data.access_token
}

async function getCategoryPosts(category, token) {
  const response = await axios.get(`https://api.producthunt.com/v1/categories/${category}/posts`, {
    headers: { "Authorization": `Bearer ${token}` }
  })

  return response.data.posts.slice(0, 5)
}

function formatPostSpeech(post) {
  const postSpeech = `${post.user.name} posted ${post.name}, ${post.tagline}. `

  return xmlescape(asciify(emojiStrip(postSpeech))).replace(new RegExp(' ❄︎', 'g'), '')
}

const CancelAndStopAndNoIntentsHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent')
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Thanks for hunting!')
      .withShouldEndSession(true)
      .getResponse()
  },
}

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent'
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("I'm sorry, I didn't quite catch that. What category are you looking for hunts for? For example you can ask for hunts in books, technology, games or podcasts.")
      .reprompt("Which category do you want?")
      .withShouldEndSession(false)
      .getResponse()
  }
}

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent'
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("With Product Hunt, you can get hunts for any category.  For example, you could ask for hunts in technology, books, podcasts, or games. Which category do you want?")
      .reprompt("Which category do you want?")
      .withShouldEndSession(false)
      .getResponse()
  },
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest'
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Welcome, to Product Hunt! Which category do you want?')
      .reprompt('Which category do you want?')
      .withShouldEndSession(false)
      .getResponse()
  },
}

const YesIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent'
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Ok, which category would you like hunts for. For example, you could ask for hunts in technology, books, podcasts, or games.")
      .reprompt("Which category do you want?")
      .withShouldEndSession(false)
      .getResponse()
  }
}

const CategoryIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'CategoryIntent'
  },
  async handle(handlerInput) {
    const category = disambiguateCategory(handlerInput.requestEnvelope.request.intent.slots.category.value)

    if (!category) {
      return handlerInput.responseBuilder
        .speak("I'm sorry, I don't know that category. You can ask for hunts in books, technology, games or podcasts. Which category do you want?")
        .reprompt("Which category do you want?")
        .withShouldEndSession(false)
        .getResponse()
    }

    const token = await authProductHunt()

    if (!token) {
      return handlerInput.responseBuilder
        .speak("I'm sorry, Product Hunt is not responding right meow. Please try again later.")
        .withShouldEndSession(true)
        .getResponse()
    }

    const posts = await getCategoryPosts(category, token)

    const formattedPosts = posts.map(formatPostSpeech).reduce((acc, post) => {
      return acc + post
    }, '')

    return handlerInput.responseBuilder
      .speak(`Today's Hunts for ${category} are: ${formattedPosts} <break strength="strong"/> Would you like another category now?`)
      .reprompt("Would you like another category now?")
      .withShouldEndSession(false)
      .getResponse()
  }
}

const ErrorHandler = {
  canHandle() {
    return true
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("My bad, didn't catch that. Can you repeat it?")
      .reprompt("My bad, didn't catch that. Can you repeat it?")
      .withShouldEndSession(false)
      .getResponse()
  },
}

const builder = Alexa.SkillBuilders.custom()

exports.handler = builder
  .addRequestHandlers(
    CancelAndStopAndNoIntentsHandler,
    FallbackIntentHandler,
    HelpIntentHandler,
    LaunchRequestHandler,
    CategoryIntentHandler,
    YesIntentHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda()
