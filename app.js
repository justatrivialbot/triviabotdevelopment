    "use strict";
	require('dotenv').config();
    
    // =========== Includes ===========
    const Snoowrap = require('snoowrap');
    
    // =========== config =============
    // Database connection
    var mysql = require ('mysql');
    var dbcon = mysql.createConnection({
    	host: process.env.DB_HOST,
    	user: process.env.DB_USER,
    	password: process.env.DB_PASS,
    	database: process.env.DB_NAME
    });
    
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
    
    // new quiz creation
    // get a message from inbox
    var msgID, body, authorName, cleanedBody, bodyObj;
    var errorMsg = "";
    var warningMsg = "";
    r.getUnreadMessages({options:{filter:"messages", limit:1}}).then(function(result){
    	for (var i = 0; i < result.length; i++) {
    		msgID = result[i].id;
//    		console.log(msgID);
    		processMessage(msgID);
    	}
    });
    
    function processMessage(id) {
    	r.getMessage(msgID).fetch().then(parseData);
    }
    
    function parseData(data) {
    	authorName = data.author.name;
    	body = data.body;
   	
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
    	if (testdata(bodyObj[0])) {
    		if (bodyObj[0].ID == "NULL") {
    			createQuiz(authorName,bodyObj[0]);
    			return true;
    		}
    	} else {
    		console.log(errorMsg);
    	}
    	

    }
    
    // verify that all mandatory fields are completed.
    function testdata(obj) {
    	// The database requires a subreddit and scoring
    	if (obj.Subreddit == null) {
    		errorMsg += "You did not specify a Subreddit. ";
    	}
    	
    	// Make sure every question has a type, a question, an answer, incorrect answers (if multiple choice), and a point value.
    	var validquestions = true;
    	for (var i = 0; i < obj.questions.length; i++) {
    		if (typeof obj.questions[i].Type === 'undefined') {
    			validquestions = false;
    			errorMsg += "At least one of your questions is missing a type. ";
    		} else if ((obj.questions[i].Type.toUpperCase() == 'MC') && (typeof obj.questions[i].Incorrect === 'undefined')) {
    			validquestions = false;
    			errorMsg += "At least one of your Multiple Choice questions is missing a set of incorrect answers. ";
    		}
    		
    		if (typeof obj.questions[i].Text === 'undefined') {
    			validquestions = false;
    			errorMsg += "At least one of your questions is missing question text. ";
    		}
    		
    		if (typeof obj.questions[i].Correct === 'undefined') {
    			validquestions = false;
    			errorMsg += "At least one of your questions is missing a correct answer. ";
    		}
    		
    		if (typeof obj.questions[i].PV === 'undefined') {
    			validquestions = false;
    			errorMsg += "At least one of your questions is missing a point value. ";
    		}
    	}
    	
    	
    	// if this is a timed quiz, make sure that the time deduction is not excessive 
    	// 
    	if (obj.Scoring == 'Timed') {
    		var totalquestions = obj.questions.length;
    		var totalPoints = 0;
    		for (var i = 0; i < totalquestions; i++) {
    			totalPoints = totalPoints + obj.questions[i].PV;
    		}
    		var oneminutededuction = obj.TimeDeduction * totalquestions;
    		if (totalPoints/oneminutededuction < 2) {
    			warningMsg += "Your time deduction is very high! You might want to adjust it or your point values."
    		}
    	}
    	
    	if (errorMsg.length > 0) {
    		return false; 
    	}
    	return true;
    }
    
    // format our DB fields and insert. Must be done as an async series because the questions depend on the existence of the quiz ID.
    function createQuiz(an,obj) {
    	var quizID;
    	var adminName = an;
//    	console.log(adminName);
    	var subreddit = obj.Subreddit;
//    	console.log(subreddit);
    	
    	// start and end times. defaults are starting immediately with 5 days of length
    	if (obj.Start != null) {
    		var start_time = obj.Start;
    	} else {
    		var start_time = generateStart();
    	}
//    	console.log(start_time);
    	
    	if (obj.End != null) {
    		var end_time = obj.End;
    	} else {
    		var end_time = generateEnd();
    	}
//    	console.log(end_time);
    	
    	// scoring is flat or timed, default flat
    	if (['FLAT','TIMED'].indexOf(obj.Scoring.toUpperCase()) >= 0) {
    		var scoring = obj.Scoring.toUpperCase();
    	} else {
    		var scoring = "FLAT";
    	}
//    	console.log(scoring);
    	
    	// misc other variables. all have defaults set in the database but we'll define them here to be on the safe side.
    	if (obj.TPQ > 0) { // must be numeric
    		var tpq = obj.TPQ;
    	} else {
    		var tpq = 5;
    	}
//    	console.log(tpq);
    	
    	if (obj.TimeDeduction > 0) {
    		var time_deduction = obj.TimeDeduction;
    	} else {
    		var time_deduction = 5;
    	}
//    	console.log(time_deduction);
    	
    	if (['FFA','BRACKET'].indexOf(obj.Type.toUpperCase()) >=0) {
    		var game_type = obj.Type.toUpperCase();
    	} else {
    		var game_type = 'FFA';
    	}
//    	console.log(game_type);
    	
    	if (['Y','N'].indexOf(obj.Randomize.toUpperCase()) >= 0) {
    		var randomize = obj.Randomize.toUpperCase();
    	} else {
    		var randomize = 'Y';
    	}
//    	console.log(randomize);
    	
    	if ((obj.HomePost != null) && (obj.HomePost != "NULL")) {
    		var hpi = obj.HomePost;
    	} else {
    		var hpi = 'NULL';
    	}
//    	console.log(hpi);
   
    	var data = {
    		administrator: adminName,
    		subreddit: subreddit,
    		start_time: start_time,
    		end_time: end_time,
    		scoring: scoring,
    		time_per_question: tpq,
    		time_deduction: time_deduction,
    		game_type: game_type,
    		randomize: randomize,
    		home_post_id: hpi
    	};
    	
    		
    	// insert the quiz data, get the id, and then insert the quesion dat
    	var insertQuery = "INSERT INTO quizzes SET ?";
//    	console.log(insertQuery);
    	
    	dbcon.connect(function(err) {
    		if (err) throw err;
    		console.log('Connected!');
    	})
    	
    	dbcon.query(insertQuery, data, function (err, result) {
    		if (err) throw err;
    		quizID = result.insertId;
    		console.log("inserted! ID was: " + quizID);
    		
        		// Now let's loop through the questions
        		var qType, qText, correctAnswer, incorrectAnswers, pointValue;
       	    	for (var i=0; i< obj.questions.length; i++) {
	        		if (['FITB', 'TF', 'MC'].indexOf(obj.questions[i].Type.toUpperCase()) >= 0) {
	        			qType = obj.questions[i].Type.toUpperCase();
	        		} else {
	        			qType = "FITB";
	        		}
	//        		console.log("Question " + i + " Type " + qType);
	        		
	        		qText = obj.questions[i].Text;
	//        		console.log("Question " + i + " Text " + qText);
	        		correctAnswer = obj.questions[i].Correct;
	//        		console.log("Question " + i + " Correct " + correctAnswer);
	        		if (qType == 'MC') {
	        			incorrectAnswers = obj.questions[i].Incorrect;
	        		} else {
	        			incorrectAnswers = '';
	        		}
	//        		console.log("Question " + i + " Incorrect " + incorrectAnswers);
	        		pointValue = obj.questions[i].PV;
	//        		console.log("Question " + i + " points " + pointValue);
	        		
	           		var qData = {
	            			id_quizzes: quizID,
	            			question_type: qType,
	            			question_text: qText,
	            			correct_answer: correctAnswer,
	            			incorrect_answers: incorrectAnswers,
	            			point_value: pointValue
	           		};
	           		var questionQuery = "INSERT INTO questions SET ?";
	        		console.log(qData);

	           		dbcon.query(questionQuery, qData, function (err, result) {
	           			if (err) throw err;
	           			console.log("question " + i + " inserted!");
	           		});
       	    	}; // end for loop
       	    	
       	    	
    	}); // end queries
    	
    
    } // end function
    
    function generateStart() {
    	var date = new Date().toJSON().slice(0,19).replace('T'," ");
    	console.log(date);
    	return date;
    }
    
    function generateEnd() {
    	var dt = new Date();
    	dt.setDate(dt.getDate() + 5);
    	var newdate = dt.toISOString().slice(0,19).replace('T'," ");
    	
    	console.log(newdate);
    	return newdate;
    } 