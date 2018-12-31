# Just a Trivial Bot
Reddit Trivia Bot development version

I've never used Node before and wanted to make a trivia bot. This is a test version that will be very broken and probably only accessible to me. 

Hopefully the bot will be able to:
* set up time-delimited trivia quizzes restricted by subreddit
* send lists of randomized questions to players
* receive answers and score them
* post scores and answers at the end of the specified time period.

# Update Dec 23 2018

The bot can now pull private messages containing a specific JSON array into a mysql database, including metadata and questions.

JSON array is as follows: 

```
[{
  "ID": "NULL",
  "Subreddit": "Your Subreddit here",
  "Start": "2018-12-25 00:00:00",
  "End": "2018-12-28 00:00:00",
  "Scoring": "Timed",
  "TPQ": 5,
  "TimeDeduction": 2,
  "Type": "FFA",
  "HomePost": ""NULL"",
  "Randomize": "Y",
  "questions" : [{
          "Type": "FITB",
          "Text": "What is 2+2?",
          "Correct": 4,
          "PV": 5
        },
  {
    "Type": "TF",
    "Text": "Is the Pope Catholic?",
    "Correct": "T",
    "PV": 5
  },
  {
    "Type": "MC",
    "Text": "What is the name of the Reddit mascot?",
    "Correct": "Snoo",
    "Incorrect": "Kevin,Mitzi,Lee",
    "PV": 5
  }]
}]
```

# Array explained
* **ID** is Null by default on a new quiz. You will receive a message back with the ID so you can make subsequent edits.
* **Subreddit** is self explanatory, no /r/ required
* **Start** and **End** dates in MYSQL format
* **Scoring** can be FLAT or TIMED. Default FLAT.
* **TPQ** is time per question in minutes. Default 5 minutes. Can be skipped.
* **Time deduction** is points deducted per minute for exceeding TPQ.
* **Type** is game type, Free for All or Bracket. Default FFA.
* **HomePost** is the hex ID of the post that you want the bot talking in. Can be omitted.
* **Randomize** is whether or not you want the questions randomized per player to prevent cheating. Default Y.
* **Questions** are a nested array.
 * **Type** can be FITB, TF or MC (Fill in the Blank, True/False, Multiple Choice.) Default FITB.
 * **Text** is the question you want to ask.
 * **Correct** is the correct answer.
 * **Incorrect** are the wrong answers for MC questions only.
 * **PV** is point value.
 
 There's a [JSON Generator here](https://justatrivialbot.github.io/triviabotdevelopment/index.html).
 
 # To do
 * [X] Get the bot's karma up so it can send private messages w/o captcha
 * [X] Send confirmations to quiz admins on quiz creation.
 * [ ] Check that generated JSON is proced properly.
 * [X] Edit Quiz method and post format.
 * [ ] Admin commands: ~~Pause, Resume~~, Edit (Done), Transfer, Scorecheck, Abort.
 * [X] Send quizzes to players.
 * [X] Score player responses.
 * [ ] Post new quizzes to the bot's home subreddit so that trivia fans can find them.
 * [ ] Install a throttle for new quizzes so we don't hit rate limit.
 * [ ] Bracket pairing.
 * [X] JSON generator.
 * [ ] Allow quiz admin to edit their quiz after it creation, e.g. adding HomePost id.
 * [ ] Methods for bot to report all scores at the end of a quiz.
 * [ ] ~~Survey mode? Maybe. Possibly too far out of scope.~~ Yup too far out of scope.
 
 If you would like to help out, message /u/JustATrivialBot on Reddit. Tx!