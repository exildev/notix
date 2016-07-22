var mongoose = require('mongoose');
var tasks = require('node-schedule');

function log(){
	console.log('The "data to append" was appended to file!');
	var message = '\n';
	for (var i=0; i < arguments.length; i++) {
        message += arguments[i] + ', ';
    }
	fs.appendFile('node.log', message, function (err) {
	  if (err) throw err;
	});
}

module.exports = {
	schedule : {},

	setup: function (db, callback){
		mongoose.connect('mongodb://localhost/' + db);
		var db = mongoose.connection;
		db.on('error', console.error.bind(console, 'connection error:'));
		db.once('open', function (){
			var message = mongoose.Schema({
				'type': String,
				'webuser': String,
				'data': Object,
				'visited': Boolean
			});
			this.Message = mongoose.model('Message', message);
			var session = mongoose.Schema({
				'type': Array,
				'webuser': String,
				'sessions': [
					{
						'socket_id': String,
						'session_id': String,
					}
				]
			});
			this.Session = mongoose.model('Session', session);

			var schedule = mongoose.Schema({
				'types': Array,
				'data': Object,
				'cron': String,
				'owner': String,
				'class': String,
			});
			this.Schedule = mongoose.model('Schedule', schedule);
			this.Schedule.find({}, function(err, raw){
			
				raw.forEach(function (doc, index, raw) {
					this.add_schedule(doc.types, doc.data, doc.cron, doc['class'], doc.owner);
				}.bind(this));
				
			}.bind(this));
			
			callback();
		}.bind(this));
		
	},

	reset: function(){
		this.Session.remove({}).exec();
		this.Message.remove({}).exec();
		this.Schedule.remove({}).exec();
	},

	delete_schedule: function(clazs, owner, callback){
		this.Schedule.findOne({'class': clazs, 'owner': owner}, function(err, doc) {
			if (doc){
				if (doc._id in this.schedule){
					this.schedule[doc._id].cancel();
					delete this.schedule[doc._id];
				}
			}
		}.bind(this));
		this.Schedule.remove({'class': clazs, 'owner': owner}, callback);
	},

	add_schedule: function(types, message, cron, clazs, owner, callback) {

		var schedule = new this.Schedule({
			'types': types, 'data':message, 'cron':cron, 'class':clazs, 'owner':owner
		});
		console.log('add_schedule', message);
		schedule.save();
		setTimeout(function (type, message, callback){
			var task = tasks.scheduleJob(cron, function(){
				for (var i in types){
					console.log('message::', message);
			    	this.add_messages_by_type(types[i], [message], callback);
				}
			}.bind(this));
			this.schedule[schedule._id] = task;
		}.bind(this), 0, types, message, callback);

	},

	update_schedule: function(type, message, cron, clazs, owner, callback) {
		this.delete_schedule(clazs, owner, function(){
			this.add_schedule(type, message, cron, clazs, owner, callback);
		}.bind(this));
	},

	add_messages_by_type: function (type, messages, callback) {
		this.Session.find({'type': type}, {}, function(err, raw){
			
			raw.forEach(function (doc, index, raw) {
				for (var i in messages) {
					var message = new this.Message({
						'type': type,
						'webuser': doc.webuser,
						'data': messages[i],
						'visited': false
					});
					message.save();
					for (var j in doc.sessions){
						if (callback){
							callback(doc.sessions[j].session_id, doc.sessions[j].socket_id, message);
						}
					}
				}
			}.bind(this));
		}.bind(this));
	},

	add_messages: function (type, webuser, messages, callback) {

		for (var i in messages){
			log("TYPE", type);
			var message = new this.Message({'type': type, 'webuser': webuser, 'data': messages[i], 'visited': false});
			message.save();
		}
		
		this.Session.find({'type': type, 'webuser': webuser}, {}, function (err, raw){
			log('type', raw);
			raw.forEach(function (doc, index, raw) {
				for (var j in doc.sessions) {
					if (callback){
						callback(doc.sessions[j].session_id, doc.sessions[j].socket_id, message);
					}
				}
			});
		});
	},

	visit_message: function (type, webuser, message_id, session_id, callback){
		this.Message.update(
			{'_id': message_id},
			{'visited': true},
			function(err, doc){
				this.Session.findOne({'type': type, 'webuser':webuser}, function(err, doc){
					callback(err, doc);
				});
			}.bind(this)
		);
	},

	update_session: function (type, webuser, session_id, socket_id, callback){
		this.delete_session(type, webuser, session_id);
		this.add_session(type, webuser, session_id, socket_id, callback);
	},
	add_session: function (type, webuser, session_id, socket_id, callback){
		var session = this.Session.find({'type': type, 'webuser': webuser}, function(err, raw){
			if (raw.length == 0){
				var session = new this.Session({
					'type': type,
					'webuser': webuser,
					'sessions': [
						{'session_id': session_id, 'socket_id': socket_id}
					]
				});
				session.save(function (){
					if (callback){
						callback(session);
					}
				});
			}else{
				this.Session.update(
					{'type': type, 'webuser': webuser}, 
					{
						$push: {'sessions': {'session_id': session_id, 'socket_id': socket_id}}
					}
				).exec(function (){
					if (callback){
						callback(session);
					}
				});
			}
		}.bind(this));
		
	},

	get_messages: function (type, webuser, callback){
		this.Message.find({'type': type, 'webuser': webuser, 'visited': false}, callback);
	},

	get_sessions: function (type, webuser, callback){
		this.Session.find({'type': type, 'webuser':webuser}, callback);
	},

	delete_message: function (message_id){
		this.Message.remove({'_id': message_id}).exec();
	},

	delete_session: function (type, webuser, session_id){
		this.Session.update(
			{'type': type, 'webuser': webuser}, 
			{$pull: {'sessions': {'session_id': session_id}}}
		).exec();
	}

};