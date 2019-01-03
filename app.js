"use strict";
require('dotenv').config();

// =========== Includes ===========
const Snoowrap = require('snoowrap');

// =========== config =============
// Database connection
var meta = require ('./meta.js');
var quiz = require ('./quiz.js');

/*
// Test Query
var testquery = "SELECT * FROM quizzes LIMIT 1";
dbcon.query(testquery, function (err, result, fields) {
	if (err) throw err;
	console.log(result[0].administrator);
})

// Close connection
dbcon.end();
*/

// ====== constants ==========
const r = new Snoowrap({
		userAgent: 'just-trivial-bot-dev-node',
		clientId: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		username: process.env.REDDIT_USER,
		password: process.env.REDDIT_PASS
}); 

var msgID, body, authorName, subject, cleanedBody, bodyObj;
// get a message from inbox

checkMail();


function checkMail() {
	r.getUnreadMessages({options:{filter:"messages", limit:1}}).then(function(result){
		for (var i = 0; i < result.length; i++) {
			msgID = result[i].id;
			//console.log(result[i]);
			processMessage(msgID);
		}
	});
}

function processMessage(id) {
	r.getMessage(msgID).fetch().then(parseData);
}

function parseData(data) {
	authorName = data.author.name;
	body = data.body;
	subject = data.subject.toUpperCase();
	
	// available commands: !NEW QUIZ, !QUIZ ME, !EDIT, !TRANSFER, !SCORES, !ABORT
	
	if (subject.substring(0,9) == "!NEW QUIZ") {

    	// in the next line you can delete the last 3 replaces once you have a clean message to work from. 
    	bodyObj = cleanJSON(body); // returns a JSON string
    	
    	//console.log(authorName);
    	//console.log(cleanedBody);
    	//console.log(bodyObj[0]);
    	
    	//verify that all criteria are correct
    	// testdata and createQuiz methods in meta.js
    	if (meta.testdata(bodyObj)) {
    			meta.createQuiz(authorName,bodyObj);
    			r.markMessagesAsRead([msgID]);
    	} else {
    		console.log(errorMsg);
    	}
	} // end new quiz process
	
	if (subject.substring(0,8) == "!QUIZ ME") { // Let's send out a quiz! 
		console.log("Let's send out a quiz!");
		// get the ID. the subject should be Quiz Me [ID]
		var subjectParts = subject.split(" ");
		var qID = subjectParts[2];
		if (quiz.checkPlayerStatus(qID,authorName)) {
			quiz.formatQuestions(qID, authorName,msgID);
		} else {
			var replyText = "You have already taken that quiz.";
			r.getMessage(msgID).reply(replyText);
		}
		r.markMessagesAsRead([msgID]);
	} 
	
	if (subject.substring(0,12) == "RE: !QUIZ ME") { // Let's score a quiz.
		console.log("Let's score a quiz!");
		// get the ID. the subject should be Quiz Me [ID]
		var subjectParts = subject.split(" ");
		var qID = subjectParts[3];
		quiz.scoreQuestions(qID,authorName,msgID,data.body,data.created_utc);
		r.markMessagesAsRead([msgID]);
	}
	
	if (subject.substring(0,5) == "!EDIT") { // edit a quiz
		console.log("Let's edit a quiz!");
		// get the ID. subject should be EDIT [ID]
		var subjectParts = subject.split(" ");
		var qID = subjectParts[1];
		bodyObj = cleanJSON(data.body);
		meta.editQuiz(qID,authorName,msgID,bodyObj);
		r.markMessagesAsRead([msgID]);
	}
	
	if (subject.substring(0,9) == '!TRANSFER') { // transfer administrator
		// The message will just have the new administrator in the body text
		console.log("Let's transfer ownership,");
		var subjectParts = subject.split(" ");
		var qID = subjectParts[1];
		meta.transferQuiz(qID,authorName,msgID,data.body);
		r.markMessagesAsRead([msgID]);
	}
	
	if (subject.substring(0,6) == '!ABORT') { // abort quiz
		console.log("Let's abort this quiz!");
		var subjectParts = subject.split(" ");
		var qID = subjectParts[1];
		meta.abortQuiz(qID,authorName,msgID);
		r.markMessagesAsRead([msgID]);
	}
	
	if (subject.substring(0,7) == '!SCORES') { // retrieve scores to date
		console.log("Let's retrieve the scores.");
		var subjectParts = subject.split(" ");
		var qID = subjectParts[1];
		meta.scoreCheck(qID,authorName,msgID);
		r.markMessagesAsRead([msgID]);
	}
	else {
		console.log(subject);
	}
	
} // end parseData

function cleanJSON(body) {
	cleanedBody = body.replace(/\\n/g, "\\n")  
    .replace(/\\'/g, "\\'")
    .replace(/\\"/g, '\\"')
    .replace(/\\&/g, "\\&")
    .replace(/\\r/g, "\\r")
    .replace(/\\t/g, "\\t")
    .replace(/\\b/g, "\\b")
    .replace(/\\f/g, "\\f");
	
	cleanedBody = "["+cleanedBody+"]"; // you can delete this too.
	
	bodyObj = JSON.parse(cleanedBody);
	return bodyObj[0];
}