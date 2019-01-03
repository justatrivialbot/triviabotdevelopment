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
var userCount;

module.exports = {    // new quiz creation
    // verify that all mandatory fields are completed.
    testdata: function (obj) {
    	// The database requires a subreddit and scoring
    	
    	if (obj.Subreddit == null) {
    		errorMsg += "You did not specify a Subreddit. ";
    	} else {
    		r.getSubreddit(obj.Subreddit).fetch().then(function(data) {
    			userCount = data.active_user_count;
    			if (userCount > 400) { // too much traffic!
    				errorMsg += "That Subreddit is too busy for this bot right now."
    			}
    		});
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
/*    	if (obj.Scoring == 'Timed') {
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
    	*/
    	if (errorMsg.length > 0) {
    		return false; 
    	}
    	return true;
    },
    
    // format our DB fields and insert. Must be done as an async series because the questions depend on the existence of the quiz ID.
    createQuiz: function (an,obj) {
    	console.log(obj);
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
    	var score_viz = 'ADMIN';
    	
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
    	
    	if (['ADMIN','PLAYERS','PUBLIC'].indexOf(obj.ScoreViz.toUpperCase()) >=0) {
    		var score_viz = obj.ScoreViz.toUpperCase();
    	} else {
    		var score_viz = 'ADMIN';
    	}
   
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
    		home_post_id: hpi,
    		score_viz: score_viz
    	};
    	
    		
    	// insert the quiz data, get the id, and then insert the quesion dat
    	var insertQuery = "INSERT INTO quizzes SET ?";
//    	console.log(insertQuery);
    	
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
	            			point_value: pointValue,
	            			question_no: i+1
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
    	
    
    }, // end function createQuiz
    
    editQuiz: function(qID,authorName,msgID,body) {
    	// console.log(body);
    	// get the quiz data
    	var replyText = "";
    	var quizQuery = "SELECT administrator, start_time, end_time FROM quizzes WHERE id_quizzes = ?";
    	var curTime = generateStart();
    	//console.log(qID);
    	   	
    	dbcon.query(quizQuery, [qID], function(err, result) {
    		if (err) throw err;
        	// verify if the author is the admin
    		if (authorName != result[0].administrator) {
    			replyText += "You are not the administrator of that quiz so you cannot make changes. Request aborted.\n\n";
    			r.getMessage(msgID).reply(replyText);
    			return true;
    		} else if (result[0].end_time < curTime) {
    			replyText += "That quiz has already ended. Request aborted.\n\n";
    			r.getMessage(msgID).reply(replyText);
    			return true;
    		} else if (result[0].start_time < curTime) {
    			replyText += "That quiz has already started so you cannot make changes. Request aborted.\n\n";
    			r.getMessage(msgID).reply(replyText);
    			return true;
    		} else { // make the edits
    			var data = [];
    			// set up meta edits
    			var metaQuery = "UPDATE quizzes SET ";
    	    	replyText += 'Quiz data updated successfully. ';
    			if (body.Subreddit != null) {
    				data.push(body.Subreddit);
    				metaQuery += "subreddit = ?, ";
    			}
    			
    			if (body.Start != null) {
    				data.push(body.Start.replace('T'," ") + ":00");
    				metaQuery += "start_time = ?, ";
    			}
    			
    			if (body.End != null) {
    				data.push(body.End.replace('T'," ") + ":00");
    				metaQuery += "end_time = ?, ";
    			}
    			
    			if (body.Scoring != null) {
    				data.push(body.Scoring.toUpperCase());
    				metaQuery += "scoring = ?, ";
    			}
    			
    			if (body.TPQ != null) {
    				data.push(body.TPQ);
    				metaQuery += "time_per_question = ?, ";
    			}
    			
    			if (body.TimeDeduction != null) {
    				data.push(body.TimeDeduction);
    				metaQuery += "time_deduction = ?, ";
    			}
    			
    			if (body.Type != null) {
    				data.push(body.Type.toUpperCase());
    				metaQuery += "game_type = ?, ";
    			}
    			
    			if (body.Randomize != null) {
    				data.push(body.Randomize.substring(0,1).toUpperCase());
    				metaQuery += "randomize = ?, ";
    			}
    			
    			if (body.HomePost != null) {
    				data.push(body.HomePost);
    				metaQuery += "home_post_id = ?, "
    			}
    			
    			metaQuery = metaQuery.substring(0, metaQuery.length-2);
    			
    			metaQuery += " WHERE id_quizzes = ?";
    			data.push(qID);
    			
    			//console.log(data);
    			//console.log(metaQuery);
    			if (data.length > 0) {
    		    	
    				var query = dbcon.query(metaQuery, data, function(err, result){
    					//console.log(query.sql);
    					if (err) throw err;
    					
    				}) // end meta updating
    			} // end meta query
    			
    			// that's all the meta fields. now for the questions.
    			if (body.questions.length > 0) { // make sure we have them.
    				var qData = [];
    				var qQuery;
    				for (var i = 0; i < body.questions.length; i++) {
    					qData = []; // empty the array
        				qQuery = "UPDATE questions SET ";
    					
    					if (body.questions[i].Type != null) {
    						qData.push(body.questions[i].Type);
    						qQuery += "question_type = ?, ";
    					}
    					if (body.questions[i].Text != null) {
    						qData.push(body.questions[i].Text);
    						qQuery += "question_text = ?, ";
    					}
    					if (body.questions[i].Correct != null) {
    						qData.push(body.questions[i].Correct);
    						qQuery += "correct_answer = ?, ";
    					}
    					if (body.questions[i].Incorrect != null) {
    						qData.push(body.questions[i].Incorrect);
    						qQuery += "incorrect_answers = ?, ";
    					}
    					if (body.questions[i].PV != null) {
    						qData.push(body.questions[i].PV);
    						qQuery += "point_value = ?, ";
    					}
    					
    					// trim off the last comma and space
    					qQuery = qQuery.substring(0, qQuery.length-2);
    					qQuery += " WHERE id_quizzes = ?";
    					qData.push(qID);
    					qQuery += " AND question_no = ?";
    					qData.push(body.questions[i].qNo);
    					
    					//console.log(qQuery);
    					//console.log(qData);

    					
    					dbcon.query(qQuery, qData, function(err, result) {
    						if (err) throw err;
    					});
    				} // end for loop

    			} // end question updating
    			
    			r.getMessage(msgID).reply(replyText);
    			return true;
    			
    		} // end edit quiz logic
    		
    	}); // end quizQuery
    	
    }, // end function editQuiz
    
    transferQuiz: function(qID,authorName,msgID,body) {
    	// verify that the sender is the administrator and that the quiz is running.
    	// also verify that the chosen administrator is an active Redditor.
    	var replyText = "";
    	var curTime = generateStart();
    	var tempFake = 'hmhmhmhmhmhmhmhmhmh';
    	r.checkUsernameAvailability(body).then(function(result){
    		if (result == true) {
    			console.log("User does not exist");
    			replyText += "Designated new admin is not a valid reddit account. Terminating process.";
    			r.getMessage(msgID).reply(replyText);
    			return true;
    		} else {
    			console.log("User exists");
    			replyText += "Designated new admin is a valid reddit account. Proceeding.\n\n";
    			var quizQuery = "SELECT administrator, start_time, end_time FROM quizzes WHERE id_quizzes = ?";
    	    	dbcon.query(quizQuery, [qID], function(err, result) {
    	    		if (err) throw err;
    	        	// verify if the author is the admin
    	    		if (authorName != result[0].administrator) {
    	    			replyText += "You are not the administrator of that quiz so you cannot make changes. Transfer aborted.\n\n";
    	    			r.getMessage(msgID).reply(replyText);
    	    			return true;
    	    		} else if (result[0].end_time < curTime) {
    	    			replyText += "That quiz has already ended. Transfer aborted.\n\n";
    	    			r.getMessage(msgID).reply(replyText);
    	    			return true;
    	    		} else if (result[0].start_time < curTime) {
    	    			replyText += "That quiz has already started so you cannot make changes. Transfer aborted.\n\n";
    	    			r.getMessage(msgID).reply(replyText);
    	    			return true;
    	    		} else { // make the edits
    	    			console.log("No errors, proceeding with transfer");
    	    			transferQuery = "UPDATE quizzes SET administrator = ? WHERE id_quizzes = ?";
    	    			dbcon.query(transferQuery, [body, qID], function(err, result) {
    	    				if (err) throw err;
    	    				replyText += "Transfer complete.";
    	    				r.getMessage(msgID).reply(replyText);
    	    				return true;
    	    			}); // end transferQuery
    	    		}
    	    	}); // end quizQuery
    		}
    		
    	});
    	
    }, // end function transferQuiz
    
    abortQuiz: function(qID,authorName,msgID) {
    	var replyText = "";
    	var quizQuery = "SELECT administrator, start_time, end_time FROM quizzes WHERE id_quizzes = ?";
    	var curTime = generateStart();
    	//console.log(qID);
    	   	
    	dbcon.query(quizQuery, [qID], function(err, result) {
    		if (err) throw err;
        	// verify if the author is the admin
    		if (authorName != result[0].administrator) {
    			replyText += "You are not the administrator of that quiz so you cannot make changes. Request aborted.\n\n";
    			r.getMessage(msgID).reply(replyText);
    			return true;
    		} else if (result[0].end_time < curTime) {
    			replyText += "That quiz has already ended. Request aborted.\n\n";
    			r.getMessage(msgID).reply(replyText);
    			return true;
    		} else { // make the edits
    			// set the start time and end time to now.
    			queryAbort = "UPDATE quizzes SET start_time = ?, end_time = ? WHERE id_quizzes = ?";
    			dbcon.query(queryAbort,[curTime,curTime,qID], function(err,result) {
    				if (err) throw err;
    				replyText +="Quiz aborted successfully.";
    				r.getMessage(msgID).reply(replyText);
    			});
    		}
    	}); // end quizQuery
    }, // end abortQuiz
    
    scoreCheck: function(qID,authorName,msgID) {
    	// Find out the scoreCheck permissions threshold, will be either Admins, Players or Public
    	var vizPermission = false;
    	var permsQuery = "SELECT administrator, score_viz FROM quizzes WHERE id_quizzes = ?";
    	dbcon.query(permsQuery,[qID], function(err,result) {
    		if (err) throw err;
    		if (result[0].administrator == authorName) { // admins can always view
    			pullScores(qID,authorName,msgID);
    			console.log("Permission granted, you are admin.")
    		} 
    		
    		if (result[0].score_viz == 'PUBLIC') { // everyone can view.
    			pullScores(qID,authorName,msgID);
    			console.log("Access open to all.")
    		} 

    		if (result[0].score_viz == 'PLAYERS') {
    			// let's find out if they played the quiz.
    			playerQuery = "SELECT id_scores FROM scores WHERE id_quizzes = ? AND reddit_username = ?";
    			dbcon.query(playerQuery,[qID,authorName], function(err, result) {
    				if (result.length > 0) {
    					pullScores(qID,authorName,msgID);
    					console.log("You've played this quiz, permission granted.");
    				} else {
    	    			replyText = "The quiz administrator only permits players to view scores.";
    	    			r.getMessage(msgID).reply(replyText);
    				}
    			});
    		}

    	});
    	
    } // end scoreCheck

}

function generateStart() {
	var date = new Date().toJSON().slice(0,19).replace('T'," ");
	//console.log(date);
	return date;
}

function generateEnd() {
	var dt = new Date();
	dt.setDate(dt.getDate() + 5);
	var newdate = dt.toISOString().slice(0,19).replace('T'," ");
	
	//console.log(newdate);
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

function pullScores(qID,authorName,msgID) {
	var scoreQuery = "SELECT reddit_username, score, time_sent, time_received FROM scores WHERE id_quizzes = ? ORDER BY score DESC";
	var curTime = generateStart();
	//console.log(qID);
	   	
	dbcon.query(scoreQuery, [qID], function(err, result) {
		dbcon.end();
		if (err) throw err;
    	var replyText = "**Scores for quiz #" + qID + "**\n\n";
    	replyText += "Player | Score | Time (min)\n:--|:--|:--\n"
    	var j = 1;
    	var timeSent, timeReceived, timeElapsed;
		for (var i = 0; i < result.length; i++) {
			timeSent = new Date(result[i].time_sent).getTime() / 1000 ; // convert to seconds
			timeReceived = new Date(result[i].time_received).getTime() / 1000 ; // convert to seconds
			timeElapsed = (timeReceived - timeSent) / 60; // convert to minutes
			replyText += j + ") " + result[i].reddit_username + "|" + result[i].score + "|" + Math.round(timeElapsed) + "\n";
			j++;
		} // end forloop
		console.log(replyText);
		r.getMessage(msgID).reply(replyText);
	}); // end scoreQuery
}