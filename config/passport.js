// config/passport.js

// load all the things we need
var LocalStrategy = require('passport-local').Strategy;

// load up the user model
var User = require('../app/models/user');

// expose this function to our app using module.exports
module.exports = function(passport) {

	// =========================================================================
	// passport session setup ==================================================
	// =========================================================================
	passport.serializeUser(function(user, done) {
		done(null, user._id);
	});

	passport.deserializeUser(function(id, done) {
		User.findById(id).exec(function(err, user) {
			if (err) {
			}
			done(err, user);
		});
	});

	// =========================================================================
	// LOCAL SIGNUP ============================================================
	// =========================================================================
	passport.use('local-signup', new LocalStrategy({
		usernameField : 'username',
		passwordField : 'password',
		passReqToCallback : true
	}, function(req, username, password, done) {
		User.findOne({
			'username' : username
		}, function(err, user) {
			if (err) {
			}

			if (user) {
				return done(null, false, req.flash('signupMessage',
						'That username is already taken.'));
			} else {

				var newUser = new User();

				newUser.username = username;
				newUser.password = newUser.generateHash(password);
				newUser.email = req.body.email;
				
				newUser.save(function(err) {
					if (err) {
						return done(err, newUser);
					}
					return done(null, newUser);
				});
			}

		});

	}));

	// =========================================================================
	// LOCAL LOGIN =============================================================
	// =========================================================================

	passport.use('local-login', new LocalStrategy({
		usernameField : 'username',
		passwordField : 'password',
		passReqToCallback : true
	// allows us to pass back the entire request to the
	// callback
	}, function(req, username, password, done) { // callback
		// with
		// email
		// and
		// password from our form

		// find a user whose email is the same as the
		// forms email
		// we are checking to see if the user trying to
		// login already exists
		User.findOne({
			'username' : username
		}, function(err, user) {
			// if there are any errors,
			// return the error before
			// anything else
			if (err) {

				var log = new Action_Log();
				log.title = "Database Error";
				log.message = "Error: " + err;
				log.author = "passport.js:local-login:User.findOne";
				log.alert_level = 1;
				Handler.handle_log(log);
				log.save();
				return done(err);
			}

			// if no user is found,
			// return the message
			if (!user)
				return done(null, false, req.flash('loginMessage',
						'No user found.')); // req.flash

			// if the user is found but
			// the password is wrong
			if (!user.validPassword(password))
				return done(null, false, req.flash('loginMessage',
						'Oops! Wrong password.')); // create

			// the
			// loginMessage
			// and save it to session as
			// flashdata

			// all is well, return
			// successful user
			return done(null, user);
		});

	}));
};
