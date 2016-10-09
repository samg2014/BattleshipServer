var express = require('express');
var bodyParser = require("body-parser");
var path = require('path');
var fs = require('fs');
var multer = require('multer');
var app = express();
var mongoose = require('mongoose');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var flash = require('connect-flash');
var randomstring = require("randomstring");
require('./config/passport')(passport);
var upload = multer({
	dest : 'uploads/'
});

var User = require('./app/models/user');
var Matchup = require('./app/models/matchup');
var Match = require('./app/models/match');

// =======================================================
// =============Setup Server==============================
// =======================================================
mongodb_connection_string = 'mongodb://sgoldman:sgoldman@ds021166.mlab.com:21166/battleshipai';
mongoose.connect(mongodb_connection_string);

app.use(express.static(path.join(__dirname, 'public')));
// app.use(express.static(__dirname + '/app/favicon'))

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.use(session({
	secret : 'jLmaagKpt5tYU9ALD3EOxMFP5ETdx6go3M7VwC4Q5x0P1WzTm1W31cdxYz962fMMlDpiEvnUHBXDnu'
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set('view engine', 'ejs');
// =======================================================
// =============Finish Setup==============================
// =======================================================

var Tournament = require('./app/models/tournament')
var current_tournament;
Tournament.findOne({
	'name' : 'seeding'
}, function(err, tourn) {
	if (tourn)
		current_tournament = tourn;
	else {
		current_tournament = new Tournament();
		current_tournament.name = "seeding";
		current_tournament.save();
		Tournament.findOne({
			'name' : 'seeding'
		}, function(err, tourn) {
			if (tourn)
				current_tournament = tourn;
		});
	}
});

// =======================================================
// =============Routing===================================
// =======================================================
app.get('/', function(req, res) {
	res.render('landing.ejs', {
		user : req.user
	});
});

app.get('/command_center', isLoggedIn, function(req, res) {
	if(req.user.runnable_id == null){
		req.user.runnable_id = randomstring.generate(7);
		req.user.save();
		addNewMatchups(req.user);
	}
	res.render('user_home.ejs', {
		user : req.user,
		io_host : io_host
	});
});

app.get('/upload_page', isLoggedIn, function(req, res) {
	res.sendFile(path.join(__dirname, 'views/upload_page.html'));
});
app.post('/player_post', isLoggedIn, upload.single('player'), function(req, res, next) {
	if (req.file != null) {
		if (req.user.runnable_id == null) {
			req.user.runnable_id = randomstring.generate(7);
			req.user.save();
			addNewMatchups(req.user);
		} else {
			resetMatchups(req.user);
		}
		fs.renameSync(req.file.path, "./game_stuff/players/" + req.user.runnable_id + req.file.originalname.substring(req.file.originalname.indexOf(".")));

		req.user.type = req.file.originalname.substring(req.file.originalname.indexOf("."));
		req.user.last_upload = Date.now();
		req.user.save();
	}
	res.redirect('/command_center');
});

var resetPath = randomstring.generate(25);
app.get('/' + resetPath, function(req, res) {
	resetTournament();
	res.redirect("/");
});
console.log(resetPath);

app.get('/matches', function(req, res) {
	Match.find().sort([ [ 'number', 'desc' ] ]).exec(function(error, ms) {
		res.render('view_matches.ejs', {
			user : req.user,
			matches : ms
		});
	});
});

// SIGNUP ==============================
app.get('/signup', isNotLoggedIn, function(req, res) {
	res.render('signup.ejs', {
		message : req.flash('signupMessage'),
	});
});
app.post('/signup', isNotLoggedIn, passport.authenticate('local-signup', {
	successRedirect : '/command_center',
	failureRedirect : '/signup',
	failureFlash : true
}));

// LOGIN ===============================
app.get('/login', isNotLoggedIn, function(req, res) {
	res.render('login.ejs', {
		message : req.flash('loginMessage')
	});
});
app.post('/login', isNotLoggedIn, passport.authenticate('local-login', {
	successRedirect : '/command_center',
	failureRedirect : '/login',
	failureFlash : true
}));

// =====================================
// LOGOUT ==============================
// =====================================
app.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

// ROUTING UTILS =====================
function isLoggedIn(req, res, next) {
	if (req.isAuthenticated())
		return next();
	res.redirect('/login');
}

function isNotLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		res.redirect('/user_home');
	} else {
		return next();
	}

}
// =======================================================
// =============End Routing===============================
// =======================================================

var runningMatch = false;

var bunyan = require('bunyan');
var log = bunyan.createLogger({
	name : "myapp"
});

var mod_spawnasync = require('spawn-async');
var worker = mod_spawnasync.createWorker({
	'log' : log
});

setInterval(function() {
	console.log("Running next match if possible!");
	runNextMatch();
	rescore();
	io.emit('game-data-updated', {});
}, 5000);

function resetMatchups(user) {
	Matchup.find({
		$or : [ {
			participant_one : user
		}, {
			participant_two : user
		} ]
	}).deepPopulate("current_match current_match.current participant_one participant_one.runnable_id participant_one.type participant_two participant_two.runnable_id participant_two.type").exec(function(err, matchups) {
		for (var i = 0; i < matchups.length; i++) {
			var matchup = matchups[i];
			matchup.previous_matches.push(matchup.current_match);
			if (matchup.current_match != null) {
				matchup.current_match.current = false;
				matchup.current_match.save();
			}
			createNewMatch(matchup);
			matchup.save();
		}
	});
}

function createNewMatch(matchup) {
	var match = new Match();
	match.number = (current_tournament.current_match++);
	current_tournament.save();
	var swap = getRandomInt(0, 2) == 1;
	if (!swap) {
		match.user_blue = matchup.participant_one.username;
		match.user_red = matchup.participant_two.username;
		match.blue_runnable = matchup.participant_one.runnable_id + matchup.participant_one.type;
		match.red_runnable = matchup.participant_two.runnable_id + matchup.participant_two.type;
	} else {
		match.user_blue = matchup.participant_two.username;
		match.user_red = matchup.participant_one.username;
		match.blue_runnable = matchup.participant_two.runnable_id + matchup.participant_two.type;
		match.red_runnable = matchup.participant_one.runnable_id + matchup.participant_one.type;
	}

	match.winner = null;

	match.save(function(err) {
		console.log("err: " + err);
		matchup.current_match = match;
		matchup.save();
	});
}

function runNextMatch() {
	if (!runningMatch) {
		runningMatch = true;
		Match.findOne({
			winner : null
		}, function(err, match) {
			if (match == null) {
				runningMatch = false;
				return;
			}
			var m_id = match.number;

			console.log("Running match " + m_id + "...");
			var p1 = match.blue_runnable;
			var p2 = match.red_runnable;
			worker.aspawn([ 'java', '-jar', './game_stuff/BattleshipGameRunner.jar', '-p', "match_" + m_id + ".ser", "./game_stuff/players/" + p1, "./game_stuff/players/" + p2 ], function(err, stdout, stderr) {
				if (err) {
					console.log('error: %s', err.message);
					console.error(stderr);
				} else {
					console.log(stdout);
					if (stdout.includes('TIE')) {
						match.winner_color = "TIE";
						match.winner = "TIE";
					} else if (stdout.includes('BLUE')) {
						match.winner_color = "BLUE";
						match.winner = p1.substring(0, p1.indexOf("."));
					} else if (stdout.includes('RED')) {
						match.winner_color = "RED";
						match.winner = p2.substring(0, p2.indexOf("."));
					}
					match.save();

					var ndir = "./public/main_tournament/match_" + m_id;
					fs.mkdirSync(ndir);
					fs.rename("./match_" + m_id + ".ser", ndir + "/match_" + m_id + ".ser");
					fs.rename("./blue.log", ndir + "/blue.log");
					fs.rename("./red.log", ndir + "/red.log");

					console.log("\tFinished!");
					runningMatch = false;
				}
			});
		});
	}
}

function rescore() {
	User.find({
		runnable_id : {
			$ne : null
		}
	}, function(error, users) {
		for (var i = 0; i < users.length; i++) {
			users[i].score = 0;
			users[i].save();
		}

		Matchup.find().deepPopulate("participant_one participant_one.runnable_id participant_two participant_two.runnable_id current_match current_match.winner").exec(function(error, matchups) {
			for (var i = 0; i < matchups.length; i++) {
				if (matchups[i].current_match == null)
					continue;
				var winner = matchups[i].current_match.winner;
				if (winner == 'TIE') {
					for (var j = 0; j < users.length; j++) {
						if (users[j].runnable_id == matchups[i].participant_one.runnable_id || users[j].runnable_id == matchups[i].participant_two.runnable_id) {
							users[j].score += .5;
							users[j].save();
						}
					}
				} else {
					for (var j = 0; j < users.length; j++) {
						if (users[j].runnable_id == winner) {
							users[j].score += 1;
							users[j].save();
						}
					}
				}
			}

			io.emit('game-data-updated', {});
		});
	});
}

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

function addNewMatchups(user) {
	User.find({
		$and : [ {
			runnable_id : {
				$ne : null
			}
		}, {
			id : {
				$ne : user.id
			}
		} ]
	}, function(err, users) {
		for (var i = 0; i < users.length; i++) {
			var newmu = new Matchup();
			newmu.participant_one = user;
			newmu.participant_two = users[i];
			newmu.current_match = null;
			newmu.winner = null;
			newmu.save();
			current_tournament.matchups.push(newmu);
			current_tournament.save();
		}
		resetMatchups(user);
	});
}

function resetTournament() {
	current_tournament.current_match = 0;
	current_tournament.save();
	mongoose.connection.db.dropCollection('matches', function(err, result) {
	});
	Matchup.find().deepPopulate("current_match current_match.current participant_one participant_one.runnable_id participant_one.type participant_two participant_two.runnable_id participant_two.type").exec(function(err, matchups) {
		for (var i = 0; i < matchups.length; i++) {
			var m = matchups[i];
			m.current_match = null;
			var match = createNewMatch(m);
			m.previous_matches = [];
			m.save();
		}
	});
	User.find({}, function(err, users) {
		for (var i = 0; i < users.length; i++) {
			var u = users[i];
			u.score = 0;
			u.save();
		}
	});

	deleteFolder("./public/main_tournament");
	fs.mkdirSync("./public/main_tournament");

	resetMatchups();
}

function deleteFolder(path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function(file, index) {
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolder(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

var io_host;

// If this is on a production server
if (process.env.IP || process.env.OPENSHIFT_NODEJS_IP) {
	// Configure socket.io clients to look for production server
	io_host = 'node-virtualhand.rhcloud.com:8000';
} else {
	// Configure socket.io clients to look for development server
	io_host = 'localhost:8080';
}

var server = app.listen(8080, function() {
	console.log('Server listening on port 8080');
});

var io = require('socket.io')(server);

// =================SOCKET.io STUFF==============================
io.on('connection', function(socket) {

	socket.on('user-rank-request', function(data) {
		var uid = data.user;

		User.find({
			runnable_id : {
				$ne : null
			}
		}).sort([ [ 'score', 'desc' ], [ 'last_upload', 'asc' ] ]).exec(function(error, ranked_users) {
			for (var i = 0; i < ranked_users.length; i++) {
				if (ranked_users[i]._id == uid) {
					socket.emit('user-rank-response', {
						rank : (i + 1),
						total : ranked_users.length
					});
					return;
				}
			}
			socket.emit('user-rank-response', {
				rank : '-',
				total : ranked_users.length
			})
		});
	});

	socket.on('user-score-request', function(data) {
		var uid = data.user;

		User.findOne({
			_id : uid
		}).exec(function(error, user) {
			socket.emit('user-score-response', {
				score : user.score
			});
		});
	});

	socket.on('ranking-request', function(data) {
		User.find({
			runnable_id : {
				$ne : null
			}
		}).sort([ [ 'score', 'desc' ], [ 'last_upload', 'asc' ] ]).exec(function(error, ranked_users) {
			socket.emit('ranking-response', {
				rankings : ranked_users
			});
		});
	});

	socket.on('matches-request', function(data) {
		Match.find().sort([ [ 'number', 'desc' ] ]).exec(function(error, ms) {
			socket.emit('matches-response', {
				matches : ms
			});
		});
	});
});