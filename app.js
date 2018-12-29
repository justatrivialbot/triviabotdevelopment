    "use strict";
	require('dotenv').config();
    
    // =========== Includes ===========
    const Snoowrap = require('snoowrap');
    
    // =========== config =============
    // Database connection
    var meta = require ('./meta.js');
    
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
    
    // get a message from inbox
    var msgID, body, authorName, subject, cleanedBody, bodyObj;
    r.getUnreadMessages({options:{filter:"messages", limit:1}}).then(function(result){
    	for (var i = 0; i < result.length; i++) {
    		msgID = result[i].id;
    		console.log(result[i]);
    		processMessage(msgID);
    	}
    });

    function processMessage(id) {
    	r.getMessage(msgID).fetch().then(parseData);
    }
    
    function parseData(data) {
    	authorName = data.author.name;
    	body = data.body;
    	subject = data.subject.toUpperCase();
    	
    	if (subject.substring(0,8) == "NEW QUIZ") {
   	
	    	// in the next line you can delete the last 3 replaces once you have a clean message to work from. 
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
	    	
	    	//console.log(authorName);
	    	//console.log(cleanedBody);
	    	console.log(bodyObj[0]);
	    	
	    	//verify that all criteria are correct
	    	// testdata and createQuiz methods in meta.js
	    	if (meta.testdata(bodyObj[0])) {
	    		if (bodyObj[0].ID == "NULL") {
	    			meta.createQuiz(authorName,bodyObj[0]);
	    			return true;
	    		}
	    	} else {
	    		console.log(errorMsg);
	    	}
    	} // end new quiz process
    	

    }
