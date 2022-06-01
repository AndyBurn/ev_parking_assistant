// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

const { QnAMaker } = require('botbuilder-ai');

const IntentRecognizer = require("./intentrecognizer")

class EchoBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        super();
        const key = '4d7435b1d1f647a3a4a059fd769b2281';
        const endpoint = 'https://ev-parking-assistant-textanalytics.cognitiveservices.azure.com/';
        const textAnalyticsClient = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key));
        if(!configuration) throw new Error('[QnaMakerBot]: Missing parameter. Configuration is required');
        // Create a QnAMaker connector
        this.qnaMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions);

        // Create a LUIS connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            // const replyText = `Echo: ${ context.activity.text }`;
            // await context.sendActivity(MessageFactory.text(replyText, replyText));

            // Call the sentiment analysis function on the context text
            await sentimentAnalysis(textAnalyticsClient,context.activity.text);
            
            // Send user input to LUIS
            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);

            // Determine which service to respond with 
            if(LuisResult.luisResult.prediction.topIntent === "findParking" &&
                LuisResult.intents.findParking.score > .6 &&
                LuisResult.entities.$instance &&
                LuisResult.entities.$instance.location &&
                LuisResult.entities.$instance.location[0]
            ){
                const location = LuisResult.entities.$instance.location[0].text;
                // Call api with location entity info
                const getLocationOfParking = "I found parking with a charging station at " + location;
                console.log(getLocationOfParking)
                await context.sendActivity(getLocationOfParking);
                await next();
                return;
            }

            // Send user input to QnA Maker
            const qnaResults = await this.qnaMaker.getAnswers(context);
            // If an answer was received from QnA Maker, send the answer back to the user.
            if(qnaResults[0]){
                console.log(qnaResults[0])
                await context.sendActivity(`${qnaResults[0].answer}`);
            }
            else{
                // If no answers were returned from QnA Amker, reply with help.
                await context.sendActivity(`I'm not sure`
                        + 'I found an answer to your question'
                        + `You can ask me questions about electric vehicles like 
                        "how can I charge my car?"`);
            }
            // const replyText = `Echo: ${ context.activity.text }`;
            // await context.sendActivity(MessageFactory.text(replyText, replyText));
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Welcome to EV Parking Assistant. I can help you find a charging station and parking. You can say "find a charging station" or "find parking" or ask a question about electric vehicle charging.';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        async function sentimentAnalysis(client,userText){
            console.log("Running sentiment analysis on: " + userText);
            const sentimentInput = [ userText ];
            const sentimentResult = await client.analyzeSentiment(sentimentInput);
            console.log("Got sentiment result");

            // This is where you send the sentimentInput and sentimentResults to a database
            // or storage instead of the console.

            sentimentResult.forEach(document => {
                console.log(`ID: ${document.id}`);
                console.log(`\tDocument Sentiment: ${document.sentiment}`);
                console.log(`\tDocument Scores:`);
                console.log(`\t\tPositive: ${document.confidenceScores.positive.toFixed(2)} \tNegative: ${document.confidenceScores.negative.
                toFixed(2)} \tNeutral: ${document.confidenceScores.neutral.toFixed(2)}`);
            })
        }
    }
}

module.exports.EchoBot = EchoBot;
