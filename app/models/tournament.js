var mongoose = require('mongoose'), Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate');
var Matchup = require('./matchup');

var tournamentSchema = mongoose.Schema({

	name : String,
	matchups : [{type : Schema.Types.ObjectId, ref: 'Matchup'}],
	current_match : {type : Number, default : 0}
	
});

module.exports = mongoose.model('Tournament', tournamentSchema);