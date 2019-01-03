// Quiz logic
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

module.exports = {
	formatQuestions: function(id,playerName,msgID) {
		// get the metadata and the questions
		var replyText;
		var metaQuery = "SELECT * from quizzes, questions WHERE quizzes.id_quizzes = ? AND quizzes.id_quizzes = questions.id_quizzes";
		date = new Date();
		dbcon.query(metaQuery, id, function (err, result) {
			if (err) throw err;
			
/*			console.log("End time: " + result[0].end_time);
			console.log("Current time: " + date);
			if (date > result[0].end_time) {
				console.log("too late");
			} else {
				console.log("still running");
			}*/
			
			if (result.length == 0) { // no questions.
				replyText = "No quiz exists with that ID number.";
			} else if ((date < result[0].start_time) || (date > result[0].end_time)) { 
				replyText = "That quiz is not running right now.";
			} else {
				replyText = 'Thank you for participating in /u/' + result[0].administrator + '\'s quiz! Here are your questions. To submit your answers,';
				replyText += ' reply to this message with your answers in the same order as the questions, in a numbered list.\n\n';
				replyText += ' If you received multiple copies of this message only reply to the most recent one.\n\n';
				// loop through the questions
				var j = 1;
				var mcAnswers = {}; // multiple choice answers
				var answerText, questionText,numberString;
				
				// randomization
				var numbers = []; 
				for (var i = 0; i < result.length; i++) {
					numbers.push(i);
					// we should now have an array with numbers for each question 
				}
				if (result[0].randomize == 'Y') {
					numbers = shuffle(numbers); // Fisher-Yates shuffle
				}
				
				numberString = numbers.join(','); // so we can save the order to the DB for proper scoring.
				
				numbers.forEach(function(number) {
					replyText += j + '. '; // ordinal list
					if (result[number].question_type == 'TF') {
						replyText += "True or False: ";
						questionText = result[number].question_text;
					} else if (result[number].question_type == 'FITB') {
						questionText = result[number].question_text.replace(/_/, "\\_");
					} else {
						mcAnswers = result[number].incorrect_answers.split(",").map(item=>item.trim());
						mcAnswers.push(result[number].correct_answer);
						mcAnswers = shuffle(mcAnswers);
						questionText = result[number].question_text;
						answerText = mcAnswers.join(', ');
					}
					replyText += questionText + '\n';
					
					if (result[number].question_type == 'MC') {
						replyText += ' (Options: ' + answerText + ')\n';
					}
					j++;
				}); // end foreach loop
				
				console.log(numberString);
				
				// store the player name, quiz number and number string to the database.
				storeQuery = "INSERT INTO scores SET ? ON DUPLICATE KEY UPDATE question_order = ?"
				var date = new Date().toJSON().slice(0,19).replace('T'," ");
				var playerData = {
						id_quizzes: id,
						reddit_username: playerName,
						question_order: numberString,
						time_sent: date
				};
				
				dbcon.query(storeQuery,[playerData,numberString], function(err, result) {
					if (err) throw err;
					console.log("data stored");
					dbcon.end();
				});
				
			} // end else

			// compose and send the reply.
			r.getMessage(msgID).reply(replyText);
			console.log(replyText);
			
		}) // end query
		
		
	}, // end function

	scoreQuestions: function(id,playerName,msgID,body,time_submitted) {
		// split the body by \n
		var replyText;
		var answers = body.split('\n');
		// trim off the numbers.
		for (var i = 0; i < answers.length; i++) {
			answers[i] = answers[i].slice(answers[i].indexOf(' ')+1);
		}
		//console.log(answers);
		
		// get the quiz data
		var scoringQuery = "SELECT * from quizzes, questions, scores WHERE quizzes.id_quizzes = ? AND quizzes.id_quizzes = questions.id_quizzes and quizzes.id_quizzes = scores.id_quizzes AND scores.reddit_username = ?";
		date = new Date();
		dbcon.query(scoringQuery, [id, playerName], function (err, result) {
			if (err) throw err;
			if (result.length == 0) { // no questions.
				replyText = "No quiz exists with that ID number.";
			} else if ((date < result[0].start_time) || (date > result[0].end_time)) { 
				replyText = "That quiz is not running right now.";
			} else {
				var score = 0;
				var totalCorrect = 0;
				// scoring logic here
				console.log("No errors, we will score this quiz.");
				// put the question_order from the database into an array
				var originalOrder = result[0].question_order.split(',');
				for (var i = 0; i < answers.length; i++) {
										
					storedAnswer = result[originalOrder[i]].correct_answer;
					
					// if they want the answer to be case sensitive the first characters of the correct answer will be {CS}.
					if (storedAnswer.substring(0,4) == "{CS}") {
						playerAnswer = answers[i];
						correctAnswer = storedAnswer.substring(4);
					} else {
						playerAnswer = answers[i].toUpperCase();
						correctAnswer = storedAnswer.toUpperCase();
						//console.log("Player Answer: " + playerAnswer + ", Stored: " + correctAnswer);
					}
					
					if (playerAnswer == correctAnswer) {
						score = score + result[originalOrder[i]].point_value;
						totalCorrect++;
					} 
				}
				
				// if the quiz is timed, let's calculate the time deductions.
				if (result[0].scoring == 'TIMED') {
					// time_submitted param is a Unix timestamp so let's convert the stored start time to UNIX format
	
					var time_sent = new Date(result[0].time_sent).getTime() / 1000 ; // convert to seconds
					
					// figure out how long it took them from the time we sent the questions to the time they sent answers back.
					var minutes_elapsed = (time_submitted - time_sent) / 60;
					
					// figure out time deductions
					var total_time = result[0].time_per_question * result.length;
					var overage = total_time - minutes_elapsed;
					var deduction = 0;
					if (overage < 0) { // they took too long
						deduction = Math.ceil(overage) * result[0].time_deduction;
					}
					//console.log("Gross score: " + score);
					score = score + deduction;
					//console.log("Deducting " + result[0].time_deduction + " * " + Math.ceil(overage) + " = " + deduction);
					//console.log("Net Score: " + score);
					
				} // end timed quiz conditions
				
				// store the score and submit time
				// convert time_submitted to mysql datetime
				var sqlsubmitDate = new Date(time_submitted*1000).toJSON().slice(0,19).replace('T'," ");
				//console.log(sqlsubmitDate);
				recordscoreQuery = "UPDATE scores SET score = ?, time_received = ? WHERE id_quizzes = ? and reddit_username = ?";
				dbcon.query(recordscoreQuery, [score, sqlsubmitDate, id, playerName], function(err,result) {
					if (err) throw err;
					dbcon.end();
				}); // end query
				
				replyText = "Your answers have been received and scored. You got ";
				replyText += totalCorrect + " answers correct out of " + answers.length + ".";
				replyText += "\n\nYour final point score was " + score + ".";
				replyText += "\n\nFinal scores and correct answers for this quiz will be posted to the quiz's main thread in /r/";
				replyText += result[0].subreddit + " when the quiz ends.";
				
				// compose and send the reply.
				r.getMessage(msgID).reply(replyText);
				console.log(replyText);
				
			}
		}); // end query
		
	}, // end scoreQuestions
	
	checkPlayerStatus: function(qid,authorName) {
		queryPlayer = "SELECT id_scores FROM scores WHERE reddit_username = ? AND id_quizzes = ?";
		dbcon.query(queryPlayer,[qid, authorName], function(err,result) {
			if (err) throw err;
			if (result.length > 0) {
				return false;
			} else {
				return true;
			}
		});
	}
	
} // end module.exports

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