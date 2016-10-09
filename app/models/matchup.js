var mongoose = require('mongoose'), Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate');
var User = require('./user');
var Match = require('./match');

var matchupSchema = mongoose.Schema({

	participant_one : {type : Schema.Types.ObjectId, ref: 'User'},
	participant_two : {type : Schema.Types.ObjectId, ref: 'User'},
	current_match : {type : Schema.Types.ObjectId, ref: 'Match'},
	previous_matches : [{type : Schema.Types.ObjectId, ref: 'Match'}],
	
});

matchupSchema.plugin(deepPopulate, {});

module.exports = mongoose.model('Matchup', matchupSchema);