var mongoose = require('mongoose'), Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate');
var User = require('./user');

var matchSchema = mongoose.Schema({

	blue_runnable : String, //Runnable id
	red_runnable : String, //Runnable id
	winner : String, // TIE or Runnable id
	time_stamp : {type: Date, default: Date.now},
	number : Number,
	current : Boolean,
	user_blue : String, // Username
	user_red : String, // Username
	winner_color : String // RED, BLUE or TIE
	
});

matchSchema.plugin(deepPopulate, {});

module.exports = mongoose.model('Match', matchSchema);