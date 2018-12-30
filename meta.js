// =========== Includes ===========
const Snoowrap = require('snoowrap');

// ====== constants ==========
const r = new Snoowrap({
		userAgent: 'just-trivial-bot-dev-node',
		clientId: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		username: process.env.REDDIT_USER,
		password: process.env.REDDIT_PASS
});

var mysql = require ('mysql');  
var dbcon = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME
});

var errorMsg = "";
var warningMsg = "";

module.exports = {    // new quiz creation
    // verify that all mandatory fields are completed.
    testdata: function (obj) {
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
    },
    
    // format our DB fields and insert. Must be done as an async series because the questions depend on the existence of the quiz ID.
    createQuiz: function (an,obj) {
    	var quizID;
    	var adminName = an;

    	// set up the defaults
    	var subreddit = "TrivialBotHQ";
    	var start_time = generateStart();
    	var end_time = generateEnd();
    	var scoring = 'FLAT';
    	var tpq = 5;
    	var time_deduction = 2;
    	var game_type = 'FFA';
    	var randomize = 'Y';
    	var hpi = '';
    	
//    	console.log(adminName);
    	if (obj.Subreddit != null) {
    		subreddit = obj.Subreddit;
    	}
//    	console.log(subreddit);
    	
    	// start and end times. defaults are starting immediately with 5 days of length
    	if (obj.Start != null) {
    		var start_time = obj.Start;
    	}
//    	console.log(start_time);
    	
    	if (obj.End != null) {
    		var end_time = obj.End;
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
       	    	
       	    generateNewQuizConfirmation(quizID);
       	    	
    	}); // end queries
    	
    
    } // end function
    
}

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

function generateNewQuizConfirmation(qID) {
	// get the meta data and the questions to go with the ID
	var metaQuery = "SELECT * from quizzes, questions WHERE quizzes.id_quizzes = ? AND quizzes.id_quizzes = questions.id_quizzes";
	//errorMsg = "Hey this is a test error!";
	dbcon.query(metaQuery, qID, function (err, result) {
		if (err) throw err;
		// format our reply.
		var replyText = "";
		var administrator = result[0].administrator;
		var subreddit = result[0].subreddit;
		var start_time = result[0].start_time;
		var end_time = result[0].end_time;
		var scoring = result[0].scoring;
		var tpq = result[0].time_per_question;
		var time_deduction = result[0].time_deduction;
		var game_type = result[0].game_type;
		var randomize = result[0].randomize;
		var hpi = result[0].home_post_id;
		var totalQuestions = result.length;
		
		var subjectText = 'Confirm Quiz #' + qID;
		
		replyText += "Dear /u/" + administrator + ",\n";
		replyText += "Thanks for making a new quiz!";
		
		// error
		if (errorMsg.length > 0) {
			replyText += ' Unfortunately I encountered some fatal errors. Please correct them and try again!\n\n';
			replyText += errorMsg;
		} else {
			replyText += ' Please review everything to make sure I recorded it correctly. If everything is OK, do nothing';
			replyText += ' and the I will post to the home post you specified when the quiz begins. Otherwise respond with a message';
			replyText += ' using the subject Edit ' + qID + ' and your corrections in the message body.';
			replyText += ' Message formatting guides can be found in a sticky post at /r/TrivialBotHQ.';
			replyText += '\n\nSubreddit: /r/' + subreddit;
			replyText += '\n\nStart Time: ' + start_time + " UTC";
			replyText += '\n\nEnd Time: ' + end_time + " UTC";
			replyText += '\n\nGame Type: ' + game_type;
			replyText += '\n\nHome Post Id: ' + hpi;
			
			if (scoring == 'TIMED') {
				replyText += '\n\nThis is a TIMED quiz. ' + time_deduction;
				replyText += ' points will be deducted per minute if the players exceed ' + tpq;
				replyText += ' minutes per question.';
			} else {
				replyText += '\n\nThis quiz is not timed.';
			}
			
			if (randomize == 'Y') {
				replyText += '\n\nThe question order will be randomized for each player to minimize cheating.';
			} else {
				replyText += '\n\nAll players will receive questions in the same order.';
			}
			
			replyText += '\n\nYou are the administrator of this quiz. I will only permit questions to be edited before your start time.';
			replyText += ' To control your quiz send private messages to me with any of the following subjects followed by your quiz number ';
			replyText += qID + '.';
			replyText += '\n\nPause, Resume, Edit, Transfer, Abort.'
			replyText += '\n\nThis quiz has ' + totalQuestions + ' questions. Below you will find an example of what your';
			replyText += ' players will receive.';
			replyText += '\n\n~~~\n\n';
			
			// everything from here on duplicates the formatQuestions method. figure out a way to simplify.
			replyText += 'Thank you for participating in /u/' + administrator + '\'s quiz! Here are your questions. To submit your answers,';
			replyText += ' reply to this message with your answers in the same order as the questions, in a numbered list.\n\n';
			// loop through the questions
			var j = 1;
			var mcAnswers = {}; // multiple choice answers
			var answerText, questionText;
			for (var i = 0; i < result.length; i++) {
				replyText += j + '. '; // ordinal list
				if (result[i].question_type == 'TF') {
					replyText += "True or False: ";
					questionText = result[i].question_text;
				} else if (result[i].question_type == 'FITB') {
					questionText = result[i].question_text.replace(/_/, "\\_");
				} else {
					mcAnswers = result[i].incorrect_answers.split(",").map(item=>item.trim());
					mcAnswers.push(result[i].correct_answer);
					mcAnswers = shuffle(mcAnswers);
					questionText = result[i].question_text;
					answerText = mcAnswers.join(', ');
				}
				replyText += questionText + '\n';
				
				if (result[i].question_type == 'MC') {
					replyText += 'Options: ' + answerText + '\n';
				}
				j++;
			} // end for loop

		}
		
		// compose and send the reply.
		r.composeMessage({
			to: administrator,
			subject: subjectText,
			text: replyText
		})
		
		console.log(replyText);
	}) // end dbcon
	
	dbcon.end();
}

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}