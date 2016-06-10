var mongoose = require('mongoose');

module.exports = {
	listenings : {},

	setup: function (callback){
		mongoose.connect('mongodb://localhost/test');
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
				'type': String,
				'webuser': String,
				'sessions': [
					{
						'socket_id': String,
						'session_id': String,
					}
				]
			});
			this.Session = mongoose.model('Session', session);

			callback();
		}.bind(this));
	},

	reset: function(){
		this.Session.remove({}).exec();
		this.Message.remove({}).exec();
	},

	add_messages_by_type: function (type, messages, callback){
		this.Session.find({'type': type}, {}, function(err, raw){
			console.log(raw);
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
						callback(doc.sessions[j].session_id, doc.sessions[j].socket_id, message);
					}
				}
			}.bind(this));
		}.bind(this));
	},

	add_messages: function (type, webuser, messages){
		for (var i in messages){
			var message = new this.Message({'type': type, 'webuser': webuser, 'data': messages[i], 'visited': false});
			message.save();
		}
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

	delete_session: function (type, webuser, session_id, socket_id){
		this.Session.update(
			{'type': type, 'webuser': webuser}, 
			{$pull: {'sessions': {'session_id': session_id, 'socket_id': socket_id}}}
		).exec();
	}

};