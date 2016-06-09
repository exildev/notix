var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
	console.log('we are connected');
	var schema = mongoose.Schema({
	    name: Object
	});
	var Model1 = mongoose.model('model1', schema);
	//Model1.find({}).remove({}).exec();
	//var model1 = new Model1({'name': 'hola'});
	//model1.save();
	Model1.update({'name': 'hola'}, {'name': {'hola':'mundo'}}).exec();
	Model1.find({}, function (err, data){
		console.log(data);
	});
});