var mongoose = require('mongoose'), Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
var deepPopulate = require('mongoose-deep-populate');

var userSchema = mongoose.Schema({

	username : String,
	password : String,
	email : String,
	runnable_id : String,
	last_upload : {type: Date, default: Date.now},
	type : String,
	score : Number
	
});

userSchema.plugin(deepPopulate, {});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function(password) {
	return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
	return bcrypt.compareSync(password, this.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);